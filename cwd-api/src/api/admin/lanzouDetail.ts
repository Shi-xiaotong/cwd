import { Context } from 'hono';
import { Bindings } from '../../bindings';

export async function lanzouDetail(c: Context<{ Bindings: Bindings }>) {
    try {
        const id = c.req.query('id');
        if (!id) return c.json({ message: '缺少 id 参数' }, 400);

        const file = await c.env.CWD_DB.prepare('SELECT * FROM lanzou_files WHERE id = ?')
            .bind(parseInt(id))
            .first();

        if (!file) return c.json({ message: '文件不存在' }, 404);

        return c.json({ data: file });
    } catch (e: any) {
        return c.json({ message: e.message || '获取详情失败' }, 500);
    }
}
