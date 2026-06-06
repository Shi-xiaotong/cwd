import { Context } from 'hono';
import { Bindings } from '../../bindings';
import { loadCredentials, saveCredentials } from '../../utils/publishCredentials';

// GET /admin/credentials
export async function getCredentials(c: Context<{ Bindings: Bindings }>) {
  try {
    const credentials = await loadCredentials(c.env);
    // 隐藏敏感字段的中间部分
    const masked = {
      github_token: credentials.github_token ? maskString(credentials.github_token) : '',
      github_repo: credentials.github_repo,
      wx_appid: credentials.wx_appid,
      wx_appsecret: credentials.wx_appsecret ? maskString(credentials.wx_appsecret) : '',
    };
    return c.json(masked);
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
}

// POST /admin/credentials
export async function updateCredentials(c: Context<{ Bindings: Bindings }>) {
  try {
    const body = await c.req.json();
    const current = await loadCredentials(c.env);

    // 只更新有值的字段，masked 的字段不更新
    const updated = {
      github_token: (body.github_token && !body.github_token.includes('***')) ? body.github_token.trim() : current.github_token,
      github_repo: body.github_repo !== undefined ? body.github_repo.trim() : current.github_repo,
      wx_appid: body.wx_appid !== undefined ? body.wx_appid.trim() : current.wx_appid,
      wx_appsecret: (body.wx_appsecret && !body.wx_appsecret.includes('***')) ? body.wx_appsecret.trim() : current.wx_appsecret,
    };

    await saveCredentials(c.env, updated);
    return c.json({ success: true });
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
}

function maskString(s: string): string {
  if (s.length <= 8) return '***';
  return s.substring(0, 4) + '***' + s.substring(s.length - 4);
}
