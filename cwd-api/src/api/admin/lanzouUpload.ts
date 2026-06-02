import { Context } from 'hono';
import { Bindings } from '../../bindings';

const LANZOU_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Origin': 'https://pc.woozooo.com',
    'Referer': 'https://pc.woozooo.com/mydisk.php',
};

async function uploadToLanzou(file: File, folderId: string, cookie: string): Promise<any> {
    const formData = new FormData();
    formData.append('upload_file', file, file.name);
    formData.append('task', '1');
    formData.append('folder_id_bb_n', folderId);
    formData.append('vie', '2');
    formData.append('ve', '2');

    const res = await fetch('https://pc.woozooo.com/html5up.php', {
        method: 'POST',
        headers: { ...LANZOU_HEADERS, Cookie: cookie },
        body: formData,
    });
    const data = await res.json() as any;
    if (data.zt !== 1 || !data.text?.[0]) {
        throw new Error(data.inf || data.msg || '蓝奏云上传失败');
    }
    return data.text[0];
}

async function getFilePassword(fileId: string, cookie: string): Promise<string> {
    const res = await fetch('https://pc.woozooo.com/doupload.php', {
        method: 'POST',
        headers: {
            ...LANZOU_HEADERS,
            Cookie: cookie,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `task=22&file_id=${fileId}`,
    });
    const data = await res.json() as any;
    return data.info?.pwd || '';
}

export async function lanzouUpload(c: Context<{ Bindings: Bindings }>) {
    try {
        // Read cookie from D1 first, fallback to env
        let cookie = '';
        let folderId = c.env.DEFAULT_FOLDER_ID || '12888237';
        try {
            await c.env.CWD_DB.prepare('CREATE TABLE IF NOT EXISTS Settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)').run();
            const rows = await c.env.CWD_DB.prepare(
                'SELECT key, value FROM Settings WHERE key IN (?, ?)'
            ).bind('lanzou_cookie', 'lanzou_folder_id').all<{ key: string; value: string }>();
            const map = new Map(rows.results.map(r => [r.key, r.value]));
            cookie = map.get('lanzou_cookie') || '';
            folderId = map.get('lanzou_folder_id') || folderId;
        } catch {}
        if (!cookie) cookie = c.env.LANZOU_COOKIE || '';
        if (!cookie) return c.json({ message: '蓝奏云 Cookie 未配置，请在设置中填写' }, 400);

        const formData = await c.req.formData();
        const file = formData.get('file') as File | null;
        const coverFile = formData.get('cover') as File | null;
        const reqFolderId = (formData.get('folder_id') as string) || folderId;

        if (!file) return c.json({ message: '缺少 file 字段' }, 400);

        // Upload original file
        const uploaded = await uploadToLanzou(file, reqFolderId, cookie);
        const password = await getFilePassword(uploaded.id, cookie);
        const shareUrl = `${uploaded.is_newd}/${uploaded.f_id}`;
        const directUrl = password
            ? `https://lanzou-api.233002.xyz/api/direct?url=${encodeURIComponent(shareUrl)}&pwd=${password}`
            : `https://lanzou-api.233002.xyz/api/direct?url=${encodeURIComponent(shareUrl)}`;

        // Upload cover image to R2 (faster access)
        let coverUrl = '';
        if (coverFile) {
            const stem = file.name.replace(/\.[^.]+$/, '');
            const ext = coverFile.name.split('.').pop() || 'jpg';
            const coverKey = `covers/${stem}.${ext}`;
            const coverBuffer = await coverFile.arrayBuffer();
            const coverHeaders: Record<string, string> = {};
            const coverContentType = coverFile.type || 'image/jpeg';
            coverHeaders['Content-Type'] = coverContentType;
            await c.env.WALLPAPER_BUCKET.put(coverKey, coverBuffer, { httpMetadata: coverHeaders });
            // Use custom domain for cover
            coverUrl = `https://wallpaper.233002.xyz/${coverKey}`;
        }

        // Save to D1
        const now = Date.now();
        await c.env.CWD_DB.prepare(`
            INSERT INTO lanzou_files (name, size, mime_type, cover_url, lanzou_id, lanzou_fid, lanzou_password, lanzou_share_url, direct_url, folder_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            file.name,
            file.size,
            file.type || '',
            coverUrl,
            uploaded.id,
            uploaded.f_id,
            password,
            shareUrl,
            directUrl,
            reqFolderId,
            now,
        ).run();

        return c.json({
            message: '上传成功',
            data: {
                name: file.name,
                size: file.size,
                mimeType: file.type,
                coverUrl,
                shareUrl,
                directUrl,
                password,
                lanzouId: uploaded.id,
            },
        });
    } catch (e: any) {
        console.error('Lanzou Upload Error:', e);
        return c.json({ message: e.message || '上传失败' }, 500);
    }
}
