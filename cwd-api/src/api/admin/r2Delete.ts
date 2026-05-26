import { Context } from 'hono';
import { Bindings } from '../../bindings';

function resolveBucket(c: Context<{ Bindings: Bindings }>, bucket?: string): R2Bucket | Response {
	const name = bucket || 'wallpaper';
	if (name === 'wallpaper') return c.env.WALLPAPER_BUCKET;
	if (name === 'myblog') return c.env.MYBLOG_BUCKET;
	return c.json({ message: `未知的 bucket: ${name}，支持的值: wallpaper, myblog` }, 400);
}

export async function r2Delete(c: Context<{ Bindings: Bindings }>) {
	try {
		const key = c.req.query('key');
		if (!key) {
			return c.json({ message: '缺少 key 参数' }, 400);
		}

		const bucketParam = c.req.query('bucket');
		const bucket = resolveBucket(c, bucketParam);
		if (bucket instanceof Response) return bucket;

		await bucket.delete(key);

		return c.json({ message: '删除成功', key });
	} catch (e: any) {
		console.error('R2 Delete Error:', e);
		return c.json({ message: e.message || '删除文件失败' }, 500);
	}
}
