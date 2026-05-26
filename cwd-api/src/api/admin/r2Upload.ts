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

		if (!file) {
			return c.json({ message: '缺少 file 字段' }, 400);
		}

		const key = prefix ? `${prefix.replace(/\/$/, '')}/${file.name}` : file.name;

		const arrayBuffer = await file.arrayBuffer();

		const headers: Record<string, string> = {};
		const contentType = file.type || (file as any).contentType;
		if (contentType) {
			headers['Content-Type'] = contentType;
		}

		await bucket.put(key, arrayBuffer, {
			httpMetadata: headers,
		});

		return c.json({
			message: '上传成功',
			key,
			size: arrayBuffer.byteLength,
		});
	} catch (e: any) {
		console.error('R2 Upload Error:', e);
		return c.json({ message: e.message || '上传文件失败' }, 500);
	}
}
