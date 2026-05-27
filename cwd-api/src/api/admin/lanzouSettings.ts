import { Context } from 'hono';
import { Bindings } from '../../bindings';

const LANZOU_COOKIE_KEY = 'lanzou_cookie';
const LANZOU_FOLDER_KEY = 'lanzou_folder_id';

export async function getLanzouSettings(c: Context<{ Bindings: Bindings }>) {
	try {
		await c.env.CWD_DB.prepare('CREATE TABLE IF NOT EXISTS Settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)').run();
		const rows = await c.env.CWD_DB.prepare(
			'SELECT key, value FROM Settings WHERE key IN (?, ?)'
			).bind(LANZOU_COOKIE_KEY, LANZOU_FOLDER_KEY).all<{ key: string; value: string }>();

		const map = new Map(rows.results.map(r => [r.key, r.value]));
		const cookie = map.get(LANZOU_COOKIE_KEY) || '';

		return c.json({
			cookie,
			folderId: map.get(LANZOU_FOLDER_KEY) || c.env.DEFAULT_FOLDER_ID || '12888237',
			hasCookie: !!cookie,
		});
	} catch (e: any) {
		return c.json({ message: e.message || '获取设置失败' }, 500);
	}
}

export async function updateLanzouSettings(c: Context<{ Bindings: Bindings }>) {
	try {
		const body = await c.req.json();
		const cookie = typeof body.cookie === 'string' ? body.cookie.trim() : undefined;
		const folderId = typeof body.folderId === 'string' ? body.folderId.trim() : undefined;

		await c.env.CWD_DB.prepare('CREATE TABLE IF NOT EXISTS Settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)').run();

		if (cookie !== undefined) {
			if (cookie) {
				await c.env.CWD_DB.prepare('REPLACE INTO Settings (key, value) VALUES (?, ?)').bind(LANZOU_COOKIE_KEY, cookie).run();
			} else {
				await c.env.CWD_DB.prepare('DELETE FROM Settings WHERE key = ?').bind(LANZOU_COOKIE_KEY).run();
			}
		}

		if (folderId !== undefined) {
			if (folderId) {
				await c.env.CWD_DB.prepare('REPLACE INTO Settings (key, value) VALUES (?, ?)').bind(LANZOU_FOLDER_KEY, folderId).run();
			} else {
				await c.env.CWD_DB.prepare('DELETE FROM Settings WHERE key = ?').bind(LANZOU_FOLDER_KEY).run();
			}
		}

		return c.json({ message: '保存成功' });
	} catch (e: any) {
		return c.json({ message: e.message || '保存失败' }, 500);
	}
}
