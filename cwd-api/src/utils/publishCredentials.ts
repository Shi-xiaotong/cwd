import { Bindings } from '../bindings';

const CREDENTIALS_KEY = 'publish_credentials';

export interface PublishCredentials {
  github_token: string;
  github_repo: string;  // 格式: owner/repo
  wx_appid: string;
  wx_appsecret: string;
}

const defaults: PublishCredentials = {
  github_token: '',
  github_repo: '',
  wx_appid: '',
  wx_appsecret: '',
};

export async function loadCredentials(env: Bindings): Promise<PublishCredentials> {
  await env.CWD_DB.prepare('CREATE TABLE IF NOT EXISTS Settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)').run();
  const row = await env.CWD_DB.prepare('SELECT value FROM Settings WHERE key = ?')
    .bind(CREDENTIALS_KEY)
    .first<{ value: string }>();

  if (!row || !row.value) {
    return defaults;
  }

  try {
    const parsed = JSON.parse(row.value);
    return {
      github_token: parsed.github_token || '',
      github_repo: parsed.github_repo || '',
      wx_appid: parsed.wx_appid || '',
      wx_appsecret: parsed.wx_appsecret || '',
    };
  } catch {
    return defaults;
  }
}

export async function saveCredentials(env: Bindings, credentials: PublishCredentials) {
  await env.CWD_DB.prepare('CREATE TABLE IF NOT EXISTS Settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)').run();
  const value = JSON.stringify(credentials);
  await env.CWD_DB.prepare('REPLACE INTO Settings (key, value) VALUES (?, ?)').bind(CREDENTIALS_KEY, value).run();
}
