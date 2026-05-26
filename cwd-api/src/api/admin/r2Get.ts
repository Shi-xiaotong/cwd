import { Context } from 'hono';
import { Bindings } from '../../bindings';

function resolveBucket(c: Context<{ Bindings: Bindings }>, bucket?: string): R2Bucket | Response {
	const name = bucket || 'wallpaper';
	if (name === 'wallpaper') return c.env.WALLPAPER_BUCKET;
	if (name === 'myblog') return c.env.MYBLOG_BUCKET;
	return c.json({ message: `未知的 bucket: ${name}，支持的值: wallpaper, myblog` }, 400);
}

export async function r2Get(c: Context<{ Bindings: Bindings }>) {
	try {
		const key = c.req.query('key');
		if (!key) {
			return c.json({ message: '缺少 key 参数' }, 400);
		}

		const bucketParam = c.req.query('bucket');
		const bucket = resolveBucket(c, bucketParam);
		if (bucket instanceof Response) return bucket;

		const object = await bucket.get(key);
		if (!object) {
			return c.json({ message: `文件不存在: ${key}` }, 404);
		}

		const headers: Record<string, string> = {};
		const contentType = object.httpMetadata?.contentType;
		const contentDisposition = object.httpMetadata?.contentDisposition;
		if (contentType) {
			headers['Content-Type'] = contentType;
		}
		if (contentDisposition) {
			headers['Content-Disposition'] = contentDisposition;
		}
		headers['Content-Length'] = String(object.size);
		headers['ETag'] = object.httpEtag;
		headers['Last-Modified'] = object.uploaded.toUTCString();

		return new Response(object.body, {
			headers,
		});
	} catch (e: any) {
		console.error('R2 Get Error:', e);
		return c.json({ message: e.message || '获取文件失败' }, 500);
	}
}
