import { Context } from 'hono';
import { Bindings } from '../../bindings';

function resolveBucket(c: Context<{ Bindings: Bindings }>, bucket?: string): R2Bucket | Response {
	const name = bucket || 'wallpaper';
	if (name === 'wallpaper') return c.env.WALLPAPER_BUCKET;
	if (name === 'myblog') return c.env.MYBLOG_BUCKET;
	return c.json({ message: `未知的 bucket: ${name}，支持的值: wallpaper, myblog` }, 400);
}

function buildFileUrl(bucketName: string, key: string, origin: string): string {
	if (bucketName === 'myblog') {
		return `https://img.233002.xyz/${key}`;
	}
	return `${origin}/r2/file?bucket=${encodeURIComponent(bucketName)}&key=${encodeURIComponent(key)}`;
}

export async function r2List(c: Context<{ Bindings: Bindings }>) {
	try {
		const prefix = c.req.query('prefix') || '';
		const bucketParam = c.req.query('bucket');
		const limit = Math.min(Number(c.req.query('limit') || '100'), 1000);
		const bn = bucketParam || 'wallpaper';

		const bucket = resolveBucket(c, bucketParam);
		if (bucket instanceof Response) return bucket;

		const result = await bucket.list({
			prefix: prefix || undefined,
			limit: Math.min(limit * 3, 3000),
		});

		const origin = new URL(c.req.url).origin;

		// Collect all keys for thumb existence check
		const allKeys = new Set(result.objects.map((o: any) => o.key));

		// Parse directories from object keys
		const dirSet = new Set<string>();
		const files: any[] = [];

		// Determine if we're in an "original/" directory — if so, thumb sibling is in "thumb/"
		const inOriginalDir = prefix.endsWith('original/') || prefix === 'original';
		const thumbBaseDir = inOriginalDir ? prefix.replace(/original\/?$/, 'thumb') : '';

		for (const obj of result.objects) {
			const relativeKey = prefix ? obj.key.slice(prefix.length) : obj.key;
			if (!relativeKey) continue;

			const slashIndex = relativeKey.indexOf('/');
			if (slashIndex !== -1) {
				const dirName = relativeKey.slice(0, slashIndex);
				dirSet.add(dirName);
			} else {
				const fileName = relativeKey;
				// Skip _thumb files (legacy) and files inside thumb/ directory
				if (/_thumb\.[^.]+$/.test(fileName)) continue;

				// Check if thumb version exists: thumb/photo.jpg (same filename)
				let thumbKey = '';
				let hasThumb = false;
				if (inOriginalDir && thumbBaseDir) {
					thumbKey = `${thumbBaseDir}${fileName}`;
					hasThumb = allKeys.has(thumbKey);
				} else {
					// Also check in same directory for legacy _thumb
					const legacyThumbKey = obj.key.replace(/\.([^./]+)$/, '_thumb.$1');
					hasThumb = allKeys.has(legacyThumbKey);
					if (hasThumb) thumbKey = legacyThumbKey;
				}

				const thumbUrl = hasThumb
					? buildFileUrl(bn, thumbKey, origin)
					: buildFileUrl(bn, obj.key, origin);

				files.push({
					key: obj.key,
					name: fileName,
					size: obj.size,
					lastModified: obj.uploaded,
					url: buildFileUrl(bn, obj.key, origin),
					thumbnailUrl: thumbUrl,
					isFolder: false,
					isImage: /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(fileName),
				});
			}
		}

		const folders = Array.from(dirSet).sort().map((dirName) => ({
			key: `${prefix}${dirName}/`,
			name: dirName,
			size: 0,
			lastModified: undefined,
			url: undefined,
			thumbnailUrl: undefined,
			isFolder: true,
			isImage: false,
		}));

		const items = [...folders, ...files].slice(0, limit);

		return c.json({
			items,
			total: items.length,
			truncated: result.truncated,
		});
	} catch (e: any) {
		console.error('R2 List Error:', e);
		return c.json({ message: e.message || '列出文件失败' }, 500);
	}
}
