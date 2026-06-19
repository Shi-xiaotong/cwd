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

/**
 * GET /admin/articles
 * List all articles from GitHub repo source/_posts/
 */
export async function listArticles(c: Context<{ Bindings: Bindings }>) {
  try {
    const { token, repo } = await getGithubRepo(c.env);
    const files = await listPostFiles(token, repo);

    const page = parseInt(c.req.query('page') || '1', 10);
    const pageSize = parseInt(c.req.query('pageSize') || '20', 10);

    const items: any[] = [];
    // Process files to extract front-matter (batch with concurrency limit)
    const batch = files.slice(0, 200); // Safety limit

    // Fetch content in parallel (limit to 10 at a time)
    const chunks: typeof batch[] = [];
    for (let i = 0; i < batch.length; i += 10) {
      chunks.push(batch.slice(i, i + 10));
    }

    for (const chunk of chunks) {
      const promises = chunk.map(async (file) => {
        try {
          const resp = await ghFetch(
            token,
            `https://api.github.com/repos/${repo}/contents/${file.path}`
          );
          if (!resp.ok) return null;
          const data = await resp.json() as any;
          const content = decodeBase64Utf8(data.content);
          const { frontMatter } = parseFrontMatter(content);

          return {
            path: file.path,
            title: frontMatter.title || file.path.split('/').pop()?.replace('.md', '') || '',
            date: frontMatter.date || '',
            category: Array.isArray(frontMatter.categories)
              ? frontMatter.categories[0] || ''
              : frontMatter.categories || '',
            tags: Array.isArray(frontMatter.tags) ? frontMatter.tags : [],
            status: frontMatter.published === false ? 'draft' : 'published',
            sha: file.sha,
          };
        } catch {
          return null;
        }
      });
      const results = await Promise.all(promises);
      for (const r of results) {
        if (r) items.push(r);
      }
    }

    // Sort by date descending
    items.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    const total = items.length;
    const start = (page - 1) * pageSize;
    const paged = items.slice(start, start + pageSize);

    return c.json({ items: paged, total, page, pageSize });
  } catch (e: any) {
    return c.json({ message: e.message || '获取文章列表失败' }, 500);
  }
}

/**
 * GET /admin/articles/:path(*)
 * Read single article content
 */
export async function getArticle(c: Context<{ Bindings: Bindings }>) {
  try {
    const filePath = c.req.param('path') || c.req.path.replace('/admin/articles/', '');
    if (!filePath) return c.json({ message: '缺少文章路径' }, 400);

    const { token, repo } = await getGithubRepo(c.env);
    const resp = await ghFetch(
      token,
      `https://api.github.com/repos/${repo}/contents/${filePath}`
    );

    if (!resp.ok) {
      const txt = await resp.text();
      return c.json({ message: `GitHub API 错误: ${resp.status}`, error: txt.substring(0, 200) }, resp.status as any);
    }

    const data = await resp.json() as any;
    const content = decodeBase64Utf8(data.content);
    const { frontMatter, body } = parseFrontMatter(content);

    return c.json({ content, body, frontMatter, sha: data.sha, path: filePath });
  } catch (e: any) {
    return c.json({ message: e.message || '获取文章失败' }, 500);
  }
}

/**
 * DELETE /admin/articles/:path(*)
 * Delete article via GitHub API
 */
export async function deleteArticle(c: Context<{ Bindings: Bindings }>) {
  try {
    const filePath = c.req.param('path') || c.req.path.replace('/admin/articles/', '');
    if (!filePath) return c.json({ message: '缺少文章路径' }, 400);

    const body = await c.req.json().catch(() => ({}));
    const sha = body.sha;

    if (!sha) {
      // Need to get current sha first
      const { token, repo } = await getGithubRepo(c.env);
      const checkResp = await ghFetch(
        token,
        `https://api.github.com/repos/${repo}/contents/${filePath}`
      );
      if (!checkResp.ok) return c.json({ message: '文章不存在或无法访问' }, 404);
      const checkData = await checkResp.json() as any;

      const deleteResp = await ghFetch(
        token,
        `https://api.github.com/repos/${repo}/contents/${filePath}`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: `post: delete ${filePath.split('/').pop()}`,
            sha: checkData.sha,
            branch: 'master',
          }),
        }
      );

      if (!deleteResp.ok) {
        const txt = await deleteResp.text();
        return c.json({ message: `删除失败: ${deleteResp.status}`, error: txt.substring(0, 200) }, 502);
      }
      return c.json({ message: '文章已删除' });
    }

    const { token, repo } = await getGithubRepo(c.env);
    const resp = await ghFetch(
      token,
      `https://api.github.com/repos/${repo}/contents/${filePath}`,
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `post: delete ${filePath.split('/').pop()}`,
          sha,
          branch: 'master',
        }),
      }
    );

    if (!resp.ok) {
      const txt = await resp.text();
      return c.json({ message: `删除失败: ${resp.status}`, error: txt.substring(0, 200) }, 502);
    }

    return c.json({ message: '文章已删除' });
  } catch (e: any) {
    return c.json({ message: e.message || '删除文章失败' }, 500);
  }
}

/**
 * PUT /admin/articles/:path(*)/status
 * Change article status (draft/published) by modifying front-matter
 */
export async function updateArticleStatus(c: Context<{ Bindings: Bindings }>) {
  try {
    // Extract path: everything between /admin/articles/ and /status
    const fullPath = c.req.path;
    const match = fullPath.match(/^\/admin\/articles\/(.+)\/status$/);
    const filePath = match ? match[1] : '';
    if (!filePath) return c.json({ message: '缺少文章路径' }, 400);

    const body = await c.req.json();
    const status = body.status; // 'draft' or 'published'
    if (!status || !['draft', 'published'].includes(status)) {
      return c.json({ message: 'status 必须是 draft 或 published' }, 400);
    }

    const { token, repo } = await getGithubRepo(c.env);

    // Read current file
    const readResp = await ghFetch(
      token,
      `https://api.github.com/repos/${repo}/contents/${filePath}`
    );
    if (!readResp.ok) return c.json({ message: '文章不存在' }, 404);
    const fileData = await readResp.json() as any;

    const content = decodeBase64Utf8(fileData.content);
    const { frontMatter, body: mdBody } = parseFrontMatter(content);

    // Modify status
    if (status === 'draft') {
      frontMatter.published = false;
    } else {
      delete frontMatter.published;
    }

    // Rebuild file
    const newContent = buildFrontMatter(frontMatter) + '\n' + mdBody;
    const encoded = btoa(unescape(encodeURIComponent(newContent)));

    const updateResp = await ghFetch(
      token,
      `https://api.github.com/repos/${repo}/contents/${filePath}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `post: ${status === 'draft' ? 'unpublish' : 'publish'} ${filePath.split('/').pop()}`,
          content: encoded,
          sha: fileData.sha,
          branch: 'master',
        }),
      }
    );

    if (!updateResp.ok) {
      const txt = await updateResp.text();
      return c.json({ message: `更新失败: ${updateResp.status}`, error: txt.substring(0, 200) }, 502);
    }

    return c.json({ message: `文章状态已更新为 ${status}`, status });
  } catch (e: any) {
    return c.json({ message: e.message || '更新文章状态失败' }, 500);
  }
}

/** Decode base64 to UTF-8 string */
