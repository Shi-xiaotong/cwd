import { Context } from 'hono';
import { Bindings } from '../../bindings';

/**
 * POST /admin/seo/baidu-push
 * Push URLs to Baidu for indexing
 */
export async function baiduPush(c: Context<{ Bindings: Bindings }>) {
  try {
    const body = await c.req.json();
    const urls: string[] = Array.isArray(body.urls) ? body.urls : [];
    if (urls.length === 0) return c.json({ message: '缺少 urls 参数' }, 400);

    // Validate URLs
    const validUrls = urls.filter((u) => typeof u === 'string' && u.startsWith('http'));
    if (validUrls.length === 0) return c.json({ message: '没有有效的 URL' }, 400);

    const site = c.env.BAIDU_PUSH_SITE || '233002.xyz';
    const token = c.env.BAIDU_PUSH_TOKEN || '';
    if (!token) return c.json({ message: '请先配置 BAIDU_PUSH_TOKEN 环境变量' }, 400);
    const pushUrl = `http://data.zz.baidu.com/urls?site=${site}&token=${token}`;

    const resp = await fetch(pushUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: validUrls.join('\n'),
    });

    const data = await resp.json() as any;
    const successCount = data.success || 0;
    const failCount = validUrls.length - successCount;

    // Save to D1 history
    try {
      await c.env.CWD_DB.prepare(
        'CREATE TABLE IF NOT EXISTS seo_push_history (id INTEGER PRIMARY KEY AUTOINCREMENT, urls TEXT NOT NULL, success_count INTEGER NOT NULL DEFAULT 0, fail_count INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)'
      ).run();

      await c.env.CWD_DB.prepare(
        'INSERT INTO seo_push_history (urls, success_count, fail_count, created_at) VALUES (?, ?, ?, ?)'
      )
        .bind(JSON.stringify(validUrls), successCount, failCount, Math.floor(Date.now() / 1000))
        .run();
    } catch (dbErr) {
      console.error('Failed to save SEO push history:', dbErr);
    }

    return c.json({
      message: `推送完成: 成功 ${successCount}, 失败 ${failCount}`,
      success: successCount,
      fail: failCount,
      not_valid: data.not_valid || 0,
      remain: data.remain || 0,
    });
  } catch (e: any) {
    return c.json({ message: e.message || '百度推送失败' }, 500);
  }
}

/**
 * GET /admin/seo/history
 * Get Baidu push history
 */
export async function seoHistory(c: Context<{ Bindings: Bindings }>) {
  try {
    // Ensure table exists
    await c.env.CWD_DB.prepare(
      'CREATE TABLE IF NOT EXISTS seo_push_history (id INTEGER PRIMARY KEY AUTOINCREMENT, urls TEXT NOT NULL, success_count INTEGER NOT NULL DEFAULT 0, fail_count INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)'
    ).run();

    const page = parseInt(c.req.query('page') || '1', 10);
    const pageSize = parseInt(c.req.query('pageSize') || '20', 10);
    const offset = (page - 1) * pageSize;

    const countRow = await c.env.CWD_DB.prepare(
      'SELECT COUNT(*) as total FROM seo_push_history'
    ).first<{ total: number }>();

    const { results } = await c.env.CWD_DB.prepare(
      'SELECT id, urls, success_count, fail_count, created_at FROM seo_push_history ORDER BY created_at DESC LIMIT ? OFFSET ?'
    )
      .bind(pageSize, offset)
      .all<{
        id: number;
        urls: string;
        success_count: number;
        fail_count: number;
        created_at: number;
      }>();

    const items = (results || []).map((row) => ({
      id: row.id,
      date: new Date(row.created_at * 1000).toISOString().slice(0, 19).replace('T', ' '),
      urlCount: JSON.parse(row.urls).length,
      successCount: row.success_count,
      failCount: row.fail_count,
    }));

    return c.json({
      items,
      total: countRow?.total || 0,
      page,
      pageSize,
    });
  } catch (e: any) {
    return c.json({ message: e.message || '获取推送历史失败' }, 500);
  }
}
