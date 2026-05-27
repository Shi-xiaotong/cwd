import { Context } from 'hono';
import { Bindings } from '../../bindings';

export async function lanzouList(c: Context<{ Bindings: Bindings }>) {
    try {
        const page = Math.max(1, parseInt(c.req.query('page') || '1'));
        const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query('pageSize') || '20')));
        const search = c.req.query('search') || '';
        const offset = (page - 1) * pageSize;

        let where = '';
        let params: any[] = [];
        if (search) {
            where = 'WHERE name LIKE ?';
            params = [`%${search}%`];
        }

        const countRow = await c.env.CWD_DB.prepare(`SELECT COUNT(*) as total FROM lanzou_files ${where}`)
            .bind(...params)
            .first<{ total: number }>();

        const { results } = await c.env.CWD_DB.prepare(
            `SELECT * FROM lanzou_files ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
        )
            .bind(...params, pageSize, offset)
            .all();

        return c.json({
            data: results,
            total: countRow?.total || 0,
            page,
            pageSize,
        });
    } catch (e: any) {
        return c.json({ message: e.message || '获取列表失败' }, 500);
    }
}
