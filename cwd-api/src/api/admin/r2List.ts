import { Context } from 'hono';
import { Bindings } from '../../bindings';

function resolveBucket(c: Context<{ Bindings: Bindings }>, bucket?: string): R2Bucket | Response {
	const name = bucket || 'wallpaper';
	if (name === 'wallpaper') return c.env.WALLPAPER_BUCKET;
	if (name === 'myblog') return c.env.MYBLOG_BUCKET;
	return c.json({ message: `未知的 bucket: ${name}，支持的值: wallpaper, myblog` }, 400);
}

export async function r2List(c: Context<{ Bindings: Bindings }>) {
	try {
		const prefix = c.req.query('prefix') || '';
		const bucketParam = c.req.query('bucket');
		const limit = Math.min(Number(c.req.query('limit') || '100'), 1000);
		const cursor = c.req.query('cursor') || undefined;

		const bucket = resolveBucket(c, bucketParam);
		if (bucket instanceof Response) return bucket;

		const result = await bucket.list({
			prefix: prefix || undefined,
			limit,
			cursor: cursor || undefined,
		});

		const response: any = {
			objects: result.objects,
			truncated: result.truncated,
		};
		if (result.truncated && 'cursor' in result) {
			response.cursor = (result as any).cursor;
		}
		return c.json(response);
	} catch (e: any) {
		console.error('R2 List Error:', e);
		return c.json({ message: e.message || '列出文件失败' }, 500);
	}
}
