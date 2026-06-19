import { Context } from 'hono';
import { Bindings } from '../../bindings';

function resolveBucket(c: Context<{ Bindings: Bindings }>, bucket?: string): R2Bucket | Response {
	const name = bucket || 'wallpaper';
	if (name === 'wallpaper') return c.env.WALLPAPER_BUCKET;
	if (name === 'myblog') return c.env.MYBLOG_BUCKET;
	return c.json({ message: `未知的 bucket: ${name}，支持的值: wallpaper, myblog` }, 400);
}

export async function r2Upload(c: Context<{ Bindings: Bindings }>) {
	try {
		const bucketParam = c.req.query('bucket');
		const prefix = c.req.query('prefix') || '';

		const bucket = resolveBucket(c, bucketParam);
		if (bucket instanceof Response) return bucket;

		const formData = await c.req.formData();
		const file = formData.get('file') as File | null;
		const thumbFile = formData.get('thumb') as File | null;

		if (!file) {
			return c.json({ message: '缺少 file 字段' }, 400);
		}

		const basePrefix = prefix.replace(/\/$/, '');
		const bucketName = bucketParam || 'wallpaper';
		// For myblog bucket: store directly in prefix (no original/ subfolder)
		// For wallpaper bucket: keep original/ subfolder for compatibility
		const dirPrefix = basePrefix ? `${basePrefix}/` : '';
		const originalKey = (bucketName === 'myblog')
			? `${dirPrefix}${file.name}`
			: `${dirPrefix}original/${file.name}`;

		// Upload original
		const arrayBuffer = await file.arrayBuffer();
		const headers: Record<string, string> = {};
		const contentType = file.type || (file as any).contentType;
		if (contentType) headers['Content-Type'] = contentType;

		await bucket.put(originalKey, arrayBuffer, { httpMetadata: headers });

		// Upload thumbnail — thumb/photo.jpg (same filename)
		let thumbKey: string | null = null;
		if (thumbFile) {
			const thumbDirPrefix = basePrefix ? `${basePrefix.replace(/original\/?$/, '')}thumb/` : 'thumb/';
			thumbKey = `${thumbDirPrefix}${file.name}`;

			const thumbBuffer = await thumbFile.arrayBuffer();
			const thumbHeaders: Record<string, string> = {};
			const thumbContentType = thumbFile.type || 'image/jpeg';
			thumbHeaders['Content-Type'] = thumbContentType;

			await bucket.put(thumbKey, thumbBuffer, { httpMetadata: thumbHeaders });
		}

		// Build URLs using custom domain for myblog bucket
		const myblogDomain = 'https://img.233002.xyz';
		const isMyblog = bucketName === 'myblog';

		const originalUrl = isMyblog
			? `${myblogDomain}/${originalKey}`
			: `${new URL(c.req.url).origin}/r2/file?bucket=${encodeURIComponent(bucketName)}&key=${encodeURIComponent(originalKey)}`;
		const thumbnailUrl = thumbKey
			? (isMyblog
				? `${myblogDomain}/${thumbKey}`
				: `${new URL(c.req.url).origin}/r2/file?bucket=${encodeURIComponent(bucketName)}&key=${encodeURIComponent(thumbKey)}`)
			: originalUrl;

		return c.json({
			message: '上传成功',
			key: originalKey,
			thumbKey,
			size: arrayBuffer.byteLength,
			originalUrl,
			thumbnailUrl,
		});
	} catch (e: any) {
		console.error('R2 Upload Error:', e);
		return c.json({ message: e.message || '上传文件失败' }, 500);
	}
}
