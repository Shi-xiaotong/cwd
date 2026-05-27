import { Context } from 'hono';
import { Bindings } from '../../bindings';

const LANZOU_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Origin': 'https://pc.woozooo.com',
    'Referer': 'https://pc.woozooo.com/mydisk.php',
};

async function deleteFromLanzou(fileId: string, folderId: string, cookie: string): Promise<{ success: boolean; detail: any }> {
    try {
        const res = await fetch('https://pc.woozooo.com/doupload.php', {
            method: 'POST',
            headers: {
                ...LANZOU_HEADERS,
                Cookie: cookie,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `task=6&file_id=${fileId}&folder_id=${folderId}`,
        });
        const data = await res.json() as any;
        console.log('Lanzou delete response:', JSON.stringify(data));
        return { success: data.zt === 1, detail: data };
    } catch (e: any) {
        console.log('Lanzou delete error:', e.message);
        return { success: false, detail: e.message };
    }
}

export async function lanzouDelete(c: Context<{ Bindings: Bindings }>) {
    try {
        const id = c.req.query('id');
        if (!id) return c.json({ message: '缺少 id 参数' }, 400);

        const file = await c.env.CWD_DB.prepare('SELECT * FROM lanzou_files WHERE id = ?')
            .bind(parseInt(id))
            .first();

        if (!file) return c.json({ message: '文件不存在' }, 404);

        // Read cookie
        let cookie = '';
        try {
            const rows = await c.env.CWD_DB.prepare(
                'SELECT value FROM Settings WHERE key = ?'
            ).bind('lanzou_cookie').first<{ value: string }>();
            cookie = rows?.value || '';
        } catch {}
        if (!cookie) cookie = c.env.LANZOU_COOKIE || '';

        // Delete from Lanzou Cloud
        let lanzouDeleted = false;
        let deleteDetail: any = null;
        if (cookie && file.lanzou_id) {
            const folderId = (file.folder_id as string) || '12888237';
            const result = await deleteFromLanzou(file.lanzou_id as string, folderId, cookie);
            lanzouDeleted = result.success;
            deleteDetail = result.detail;
        }

        // Delete cover from R2
        const coverUrl = file.cover_url as string;
        if (coverUrl) {
            try {
                const coverKey = coverUrl.split('/').slice(-2).join('/');
                await c.env.LANZOU_BUCKET.delete(coverKey);
            } catch {}
        }

        // Delete from D1
        await c.env.CWD_DB.prepare('DELETE FROM lanzou_files WHERE id = ?')
            .bind(parseInt(id))
            .run();

        return c.json({
            message: lanzouDeleted ? '已从蓝奏云和数据库删除' : '已从数据库删除（蓝奏云删除失败或未配置Cookie）',
            lanzouDeleted,
            detail: deleteDetail,
        });
    } catch (e: any) {
        return c.json({ message: e.message || '删除失败' }, 500);
    }
}
