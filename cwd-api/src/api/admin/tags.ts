import { Context } from 'hono';
import { Bindings } from '../../bindings';
import {
  getGithubRepo,
  listPostFiles,
  ghFetch,
  parseFrontMatter,
  buildFrontMatter,
  decodeBase64Utf8
} from '../../utils/github';

const KV_CACHE_KEY = 'blog_tags_cache';
const KV_CACHE_TTL = 300; // 5 minutes

/**
 * Helper: fetch all articles' tags, with KV caching
 */
async function getAllTags(env: Bindings): Promise<{ name: string; count: number }[]> {
  // Try KV cache
  try {
    const cached = await env.CWD_AUTH_KV.get(KV_CACHE_KEY, 'json');
    if (cached && Array.isArray(cached)) return cached as { name: string; count: number }[];
  } catch {}

  const { token, repo } = await getGithubRepo(env);
  const files = await listPostFiles(token, repo);

  const tagMap = new Map<string, number>();

  // Process in batches of 10
  const chunks: typeof files[] = [];
  for (let i = 0; i < files.length; i += 10) {
    chunks.push(files.slice(i, i + 10));
  }

  for (const chunk of chunks) {
    const promises = chunk.map(async (file) => {
      try {
        const resp = await ghFetch(
          token,
          `https://api.github.com/repos/${repo}/contents/${file.path}`
        );
        if (!resp.ok) return [];
        const data = await resp.json() as any;
        const content = decodeBase64Utf8(data.content);
        const { frontMatter } = parseFrontMatter(content);
        const tags: string[] = Array.isArray(frontMatter.tags) ? frontMatter.tags : [];
        return tags;
      } catch {
        return [];
      }
    });
    const results = await Promise.all(promises);
    for (const tags of results) {
      for (const tag of tags) {
        tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
      }
    }
  }

  const items = Array.from(tagMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // Cache in KV
  try {
    await env.CWD_AUTH_KV.put(KV_CACHE_KEY, JSON.stringify(items), { expirationTtl: KV_CACHE_TTL });
  } catch {}

  return items;
}

/**
 * GET /admin/tags
 */
export async function listTags(c: Context<{ Bindings: Bindings }>) {
  try {
    const items = await getAllTags(c.env);
    return c.json({ items, total: items.length });
  } catch (e: any) {
    return c.json({ message: e.message || '获取标签列表失败' }, 500);
  }
}

/**
 * PUT /admin/tags/rename
 * Body: { oldName, newName }
 * Rename a tag across all articles.
 */
export async function renameTag(c: Context<{ Bindings: Bindings }>) {
  try {
    const { oldName, newName } = await c.req.json();
    if (!oldName || !newName) return c.json({ message: '缺少 oldName 或 newName' }, 400);
    if (oldName === newName) return c.json({ message: '新旧标签名相同' }, 400);

    const { token, repo } = await getGithubRepo(c.env);
    const files = await listPostFiles(token, repo);

    let updated = 0;
    const chunks: typeof files[] = [];
    for (let i = 0; i < files.length; i += 5) {
      chunks.push(files.slice(i, i + 5));
    }

    for (const chunk of chunks) {
      for (const file of chunk) {
        try {
          const resp = await ghFetch(
            token,
            `https://api.github.com/repos/${repo}/contents/${file.path}`
          );
          if (!resp.ok) continue;
          const fileData = await resp.json() as any;
          const content = decodeBase64Utf8(fileData.content);
          const { frontMatter, body: mdBody } = parseFrontMatter(content);

          const tags: string[] = Array.isArray(frontMatter.tags) ? frontMatter.tags : [];
          if (!tags.includes(oldName)) continue;

          const idx = tags.indexOf(oldName);
          if (tags.includes(newName)) {
            tags.splice(idx, 1);
          } else {
            tags[idx] = newName;
          }
          frontMatter.tags = tags;

          const newContent = buildFrontMatter(frontMatter) + '\n' + mdBody;
          const encoded = btoa(unescape(encodeURIComponent(newContent)));

          const putResp = await ghFetch(
            token,
            `https://api.github.com/repos/${repo}/contents/${file.path}`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                message: `tag: rename "${oldName}" to "${newName}" in ${file.path.split('/').pop()}`,
                content: encoded,
                sha: fileData.sha,
                branch: 'master',
              }),
            }
          );
          if (putResp.ok) updated++;
        } catch {
          // Skip file on error
        }
      }
    }

    // Invalidate cache
    await c.env.CWD_AUTH_KV.delete(KV_CACHE_KEY).catch(() => {});

    return c.json({ message: `已重命名标签，更新了 ${updated} 篇文章`, updated });
  } catch (e: any) {
    return c.json({ message: e.message || '重命名标签失败' }, 500);
  }
}

/**
 * POST /admin/tags/merge
 * Body: { source, target }
 * Merge source tag into target tag across all articles.
 */
export async function mergeTags(c: Context<{ Bindings: Bindings }>) {
  try {
    const { source, target } = await c.req.json();
    if (!source || !target) return c.json({ message: '缺少 source 或 target' }, 400);
    if (source === target) return c.json({ message: '源标签和目标标签相同' }, 400);

    const { token, repo } = await getGithubRepo(c.env);
    const files = await listPostFiles(token, repo);

    let updated = 0;
    for (const file of files) {
      try {
        const resp = await ghFetch(
          token,
          `https://api.github.com/repos/${repo}/contents/${file.path}`
        );
        if (!resp.ok) continue;
        const fileData = await resp.json() as any;
        const content = decodeBase64Utf8(fileData.content);
        const { frontMatter, body: mdBody } = parseFrontMatter(content);

        const tags: string[] = Array.isArray(frontMatter.tags) ? frontMatter.tags : [];
        if (!tags.includes(source)) continue;

        // Remove source, add target if not exists
        frontMatter.tags = tags.filter((t) => t !== source);
        if (!frontMatter.tags.includes(target)) {
          frontMatter.tags.push(target);
        }

        const newContent = buildFrontMatter(frontMatter) + '\n' + mdBody;
        const encoded = btoa(unescape(encodeURIComponent(newContent)));

        const putResp = await ghFetch(
          token,
          `https://api.github.com/repos/${repo}/contents/${file.path}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: `tag: merge "${source}" into "${target}" in ${file.path.split('/').pop()}`,
              content: encoded,
              sha: fileData.sha,
              branch: 'master',
            }),
          }
        );
        if (putResp.ok) updated++;
      } catch {
        // Skip
      }
    }

    await c.env.CWD_AUTH_KV.delete(KV_CACHE_KEY).catch(() => {});

    return c.json({ message: `已合并标签，更新了 ${updated} 篇文章`, updated });
  } catch (e: any) {
    return c.json({ message: e.message || '合并标签失败' }, 500);
  }
}

/**
 * DELETE /admin/tags/:name
 * Remove a tag from all articles.
 */
export async function deleteTag(c: Context<{ Bindings: Bindings }>) {
  try {
    const tagName = c.req.param('name');
    if (!tagName) return c.json({ message: '缺少标签名' }, 400);

    const { token, repo } = await getGithubRepo(c.env);
    const files = await listPostFiles(token, repo);

    let updated = 0;
    for (const file of files) {
      try {
        const resp = await ghFetch(
          token,
          `https://api.github.com/repos/${repo}/contents/${file.path}`
        );
        if (!resp.ok) continue;
        const fileData = await resp.json() as any;
        const content = decodeBase64Utf8(fileData.content);
        const { frontMatter, body: mdBody } = parseFrontMatter(content);

        const tags: string[] = Array.isArray(frontMatter.tags) ? frontMatter.tags : [];
        if (!tags.includes(tagName)) continue;

        frontMatter.tags = tags.filter((t) => t !== tagName);

        const newContent = buildFrontMatter(frontMatter) + '\n' + mdBody;
        const encoded = btoa(unescape(encodeURIComponent(newContent)));

        const putResp = await ghFetch(
          token,
          `https://api.github.com/repos/${repo}/contents/${file.path}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: `tag: remove "${tagName}" from ${file.path.split('/').pop()}`,
              content: encoded,
              sha: fileData.sha,
              branch: 'master',
            }),
          }
        );
        if (putResp.ok) updated++;
      } catch {
        // Skip
      }
    }

    await c.env.CWD_AUTH_KV.delete(KV_CACHE_KEY).catch(() => {});

    return c.json({ message: `已删除标签，更新了 ${updated} 篇文章`, updated });
  } catch (e: any) {
    return c.json({ message: e.message || '删除标签失败' }, 500);
  }
}

