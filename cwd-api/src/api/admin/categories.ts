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

const KV_CACHE_KEY = 'blog_categories_cache';
const KV_CACHE_TTL = 300; // 5 minutes

/**
 * Helper: fetch all articles' categories, with KV caching
 */
async function getAllCategories(env: Bindings): Promise<{ name: string; count: number }[]> {
  try {
    const cached = await env.CWD_AUTH_KV.get(KV_CACHE_KEY, 'json');
    if (cached && Array.isArray(cached)) return cached as { name: string; count: number }[];
  } catch {}

  const { token, repo } = await getGithubRepo(env);
  const files = await listPostFiles(token, repo);

  const catMap = new Map<string, number>();

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
        if (!resp.ok) return '';
        const data = await resp.json() as any;
        const content = decodeBase64Utf8(data.content);
        const { frontMatter } = parseFrontMatter(content);

        if (Array.isArray(frontMatter.categories) && frontMatter.categories.length > 0) {
          return frontMatter.categories[0] as string;
        }
        if (typeof frontMatter.categories === 'string' && frontMatter.categories) {
          return frontMatter.categories;
        }
        // Fallback: infer from path source/_posts/{category}/file.md
        const parts = file.path.split('/');
        if (parts.length >= 3) {
          return parts[2];
        }
        return '';
      } catch {
        return '';
      }
    });
    const results = await Promise.all(promises);
    for (const cat of results) {
      if (cat) catMap.set(cat, (catMap.get(cat) || 0) + 1);
    }
  }

  const items = Array.from(catMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  try {
    await env.CWD_AUTH_KV.put(KV_CACHE_KEY, JSON.stringify(items), { expirationTtl: KV_CACHE_TTL });
  } catch {}

  return items;
}

/**
 * GET /admin/categories
 */
export async function listCategories(c: Context<{ Bindings: Bindings }>) {
  try {
    const items = await getAllCategories(c.env);
    return c.json({ items, total: items.length });
  } catch (e: any) {
    return c.json({ message: e.message || '获取分类列表失败' }, 500);
  }
}

/**
 * PUT /admin/categories/rename
 * Body: { oldName, newName }
 * Rename a category across all articles (front-matter + file path).
 */
export async function renameCategory(c: Context<{ Bindings: Bindings }>) {
  try {
    const { oldName, newName } = await c.req.json();
    if (!oldName || !newName) return c.json({ message: '缺少 oldName 或 newName' }, 400);
    if (oldName === newName) return c.json({ message: '新旧分类名相同' }, 400);

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

        let catChanged = false;

        // Update categories in front-matter
        if (Array.isArray(frontMatter.categories)) {
          const idx = frontMatter.categories.indexOf(oldName);
          if (idx !== -1) {
            frontMatter.categories[idx] = newName;
            catChanged = true;
          }
        } else if (frontMatter.categories === oldName) {
          frontMatter.categories = newName;
          catChanged = true;
        }

        // Check if category matches from path
        const pathParts = file.path.split('/');
        const pathCat = pathParts.length >= 3 ? pathParts[2] : '';
        const pathChanged = pathCat === oldName;

        if (!catChanged && !pathChanged) continue;

        const newContent = buildFrontMatter(frontMatter) + '\n' + mdBody;
        const encoded = btoa(unescape(encodeURIComponent(newContent)));

        // If path needs to change: create new file, delete old
        const newPath = pathChanged
          ? file.path.replace(`source/_posts/${oldName}/`, `source/_posts/${newName}/`)
          : file.path;

        // Create/update at new path
        const putResp = await ghFetch(
          token,
          `https://api.github.com/repos/${repo}/contents/${newPath}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: `category: rename "${oldName}" to "${newName}" in ${file.path.split('/').pop()}`,
              content: encoded,
              branch: 'master',
            }),
          }
        );

        if (putResp.ok && pathChanged) {
          // Delete old file
          await ghFetch(
            token,
            `https://api.github.com/repos/${repo}/contents/${file.path}`,
            {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                message: `category: delete old path after rename "${oldName}" to "${newName}"`,
                sha: fileData.sha,
                branch: 'master',
              }),
            }
          );
        }

        if (putResp.ok) updated++;
      } catch {
        // Skip
      }
    }

    await c.env.CWD_AUTH_KV.delete(KV_CACHE_KEY).catch(() => {});

    return c.json({ message: `已重命名分类，更新了 ${updated} 篇文章`, updated });
  } catch (e: any) {
    return c.json({ message: e.message || '重命名分类失败' }, 500);
  }
}

