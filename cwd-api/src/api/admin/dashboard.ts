import { Context } from 'hono';
import { Bindings } from '../../bindings';
import { getGithubRepo, listPostFiles } from '../../utils/github';

/**
 * GET /admin/dashboard
 *
 * Aggregate stats: article count, comment stats, PV stats, recent visits/comments.
 */
export async function getDashboard(c: Context<{ Bindings: Bindings }>) {
  try {
    const { token, repo } = await getGithubRepo(c.env);

    // --- Articles count (GitHub tree) ---
    let totalArticles = 0;
    let monthlyArticles = 0;
    try {
      const files = await listPostFiles(token, repo);
      totalArticles = files.length;

      const now = new Date();
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const monthStartTs = Math.floor(monthStart.getTime() / 1000);

      // We count by file listing; for monthly we'll try to use commit date later.
      // For now use a simple heuristic: files are dated by name prefix or content.
      monthlyArticles = totalArticles; // Placeholder; frontend can refine
    } catch {
      // GitHub API might fail; continue with 0
    }

    // --- Comment stats ---
    let totalComments = 0;
    let pendingComments = 0;
    try {
      const row = await c.env.CWD_DB.prepare(
        'SELECT COUNT(*) as total FROM Comment'
      ).first<{ total: number }>();
      totalComments = row?.total || 0;

      const pendingRow = await c.env.CWD_DB.prepare(
        "SELECT COUNT(*) as total FROM Comment WHERE status = 'pending'"
      ).first<{ total: number }>();
      pendingComments = pendingRow?.total || 0;
    } catch {
      // Table might not exist yet
    }

    // --- PV stats ---
    const now = new Date();
    const todayKey = dateKey(now);
    const monthStartDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthStartKey = dateKey(monthStartDate);

    let todayPv = 0;
    let monthPv = 0;
    try {
      const todayRow = await c.env.CWD_DB.prepare(
        'SELECT COALESCE(SUM(count), 0) as total FROM page_visit_daily WHERE date = ?'
      ).bind(todayKey).first<{ total: number }>();
      todayPv = todayRow?.total || 0;

      const monthRow = await c.env.CWD_DB.prepare(
        'SELECT COALESCE(SUM(count), 0) as total FROM page_visit_daily WHERE date >= ?'
      ).bind(monthStartKey).first<{ total: number }>();
      monthPv = monthRow?.total || 0;
    } catch {
      // Tables might not exist
    }

    // --- Recent 30 days visits ---
    const trend: { date: string; pv: number }[] = [];
    try {
      const startDate = dateKey(new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000));
      const { results } = await c.env.CWD_DB.prepare(
        'SELECT date, count FROM page_visit_daily WHERE date >= ? ORDER BY date'
      ).bind(startDate).all<{ date: string; count: number }>();

      const dayMap = new Map<string, number>();
      for (const row of results) {
        dayMap.set(row.date, (dayMap.get(row.date) || 0) + (row.count || 0));
      }
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const key = dateKey(d);
        trend.push({ date: key, pv: dayMap.get(key) || 0 });
      }
    } catch {
      // Fallback empty
    }

    // --- Recent comments ---
    let recentComments: any[] = [];
    try {
      const { results } = await c.env.CWD_DB.prepare(
        'SELECT id, name, email, content_text as contentText, post_slug as postSlug, status, created FROM Comment ORDER BY created DESC LIMIT 10'
      ).all<any>();
      recentComments = results || [];
    } catch {
      // Table might not exist
    }

    return c.json({
      articleCount: totalArticles,
      commentCount: totalComments,
      todayPv,
      monthPv,
      trend,
      recentComments,
    });
  } catch (e: any) {
    return c.json({ message: e.message || '获取仪表盘数据失败' }, 500);
  }
}

function dateKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
