import { Context } from 'hono';
import { Bindings } from '../../bindings';
import {
  getGithubRepo,
  listPostFiles,
  ghFetch,
  parseFrontMatter,
  decodeBase64Utf8
} from '../../utils/github';

/**
 * GET /admin/daily-news
 * List articles in source/_posts/daily-news/
 */
export async function listDailyNews(c: Context<{ Bindings: Bindings }>) {
  try {
    const { token, repo } = await getGithubRepo(c.env);
    const files = await listPostFiles(token, repo);

    const dailyNewsFiles = files.filter((f) =>
      f.path.startsWith('source/_posts/daily-news/') || f.path.startsWith('source/_posts/dailynews/')
    );

    const items: any[] = [];
    const chunks: typeof dailyNewsFiles[] = [];
    for (let i = 0; i < dailyNewsFiles.length; i += 10) {
      chunks.push(dailyNewsFiles.slice(i, i + 10));
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
            tags: Array.isArray(frontMatter.tags) ? frontMatter.tags : [],
            coverUrl: frontMatter.cover || frontMatter.coverUrl || '',
            status: 'published',
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

    items.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    return c.json({ items, total: items.length });
  } catch (e: any) {
    return c.json({ message: e.message || '获取每日资讯列表失败' }, 500);
  }
}

/**
 * POST /admin/daily-news/regenerate
 * Trigger GitHub Actions workflow for daily news generation
 */
export async function regenerateDailyNews(c: Context<{ Bindings: Bindings }>) {
  try {
    const { token, repo } = await getGithubRepo(c.env);

    const body = await c.req.json().catch(() => ({}));
    const inputs = body.inputs || {};

    const workflowFile = 'daily-news.yml';
    const url = `https://api.github.com/repos/${repo}/actions/workflows/${workflowFile}/dispatches`;

    const resp = await ghFetch(token, url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ref: 'master',
        inputs,
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      return c.json({
        message: `触发工作流失败: ${resp.status}`,
        error: txt.substring(0, 300),
      }, 502);
    }

    return c.json({ message: '已触发每日资讯生成工作流' });
  } catch (e: any) {
    return c.json({ message: e.message || '触发工作流失败' }, 500);
  }
}

