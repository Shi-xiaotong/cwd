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

async function fetchWithRetry(url: string, maxRetries = 3): Promise<Response> {
    let lastError: Error | null = null;
    for (let i = 0; i < maxRetries; i++) {
        try {
            const res = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                signal: AbortSignal.timeout(60000),
            });
            if (res.ok) return res;
            lastError = new Error(`HTTP ${res.status}`);
        } catch (e: any) {
            lastError = e;
            if (i < maxRetries - 1) {
                await new Promise(r => setTimeout(r, 1000 * (i + 1)));
            }
        }
    }
    throw lastError || new Error('请求失败');
}

export async function lanzouUploadUrl(c: Context<{ Bindings: Bindings }>) {
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
        if (!cookie) return c.json({ message: '蓝奏云 Cookie 未配置' }, 400);

        const body = await c.req.json();
        const fileUrl = typeof body.url === 'string' ? body.url.trim() : '';
        if (!fileUrl) return c.json({ message: '缺少 url 参数' }, 400);

        // Validate URL
        let parsedUrl: URL;
        try {
            parsedUrl = new URL(fileUrl);
        } catch {
            return c.json({ message: 'URL 格式无效' }, 400);
        }

        // Fetch file from URL with retry
        const fileRes = await fetchWithRetry(fileUrl);
        const contentType = fileRes.headers.get('content-type') || 'application/octet-stream';
        const contentLength = fileRes.headers.get('content-length');

        // Extract filename from URL or Content-Disposition
        let fileName = '';
        const disposition = fileRes.headers.get('content-disposition');
        if (disposition) {
            const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
            if (match) fileName = match[1].replace(/['"]/g, '');
        }
        if (!fileName) {
            fileName = decodeURIComponent(parsedUrl.pathname.split('/').pop() || 'file');
        }
        if (!fileName || fileName === '/' || fileName === '.') {
            fileName = `file_${Date.now()}`;
        }

        // Convert to File object
        const arrayBuffer = await fileRes.arrayBuffer();
        const file = new File([arrayBuffer], fileName, { type: contentType });

        // Validate size (100MB limit)
        if (file.size > 100 * 1024 * 1024) {
            return c.json({ message: '文件超过 100MB 限制' }, 400);
        }

        // Upload to Lanzou
        const reqFolderId = body.folder_id || folderId;
        const uploaded = await uploadToLanzou(file, reqFolderId, cookie);
        const password = await getFilePassword(uploaded.id, cookie);
        const shareUrl = `${uploaded.is_newd}/${uploaded.f_id}`;
        const directUrl = password
            ? `https://lanzou-api.233002.xyz/api/direct?url=${encodeURIComponent(shareUrl)}&pwd=${password}`
            : `https://lanzou-api.233002.xyz/api/direct?url=${encodeURIComponent(shareUrl)}`;

        // Generate cover for images
        let coverUrl = '';
        if (contentType.startsWith('image/')) {
            try {
                // Use CF Image Resizing or just store the original URL as cover
                // For now, store a small version by uploading to R2
                const stem = fileName.replace(/\.[^.]+$/, '');
                const ext = fileName.split('.').pop() || 'jpg';
                const coverKey = `cover/${stem}.${ext}`;
                await c.env.LANZOU_BUCKET.put(coverKey, arrayBuffer, {
                    httpMetadata: { contentType: contentType },
                });
                coverUrl = `https://lanzou-thumb.233002.xyz/${coverKey}`;
            } catch {}
        }

        // Save to D1
        const now = Date.now();
        await c.env.CWD_DB.prepare(`
            INSERT INTO lanzou_files (name, size, mime_type, cover_url, lanzou_id, lanzou_fid, lanzou_password, lanzou_share_url, direct_url, folder_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            file.name,
            file.size,
            contentType,
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
                mimeType: contentType,
                coverUrl,
                shareUrl,
                directUrl,
                password,
            },
        });
    } catch (e: any) {
        console.error('Lanzou Upload URL Error:', e);
        return c.json({ message: e.message || '上传失败' }, 500);
    }
}
