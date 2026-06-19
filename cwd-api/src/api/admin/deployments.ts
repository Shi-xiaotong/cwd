import { Context } from 'hono';
import { Bindings } from '../../bindings';
import { loadCredentials } from '../../utils/publishCredentials';

/**
 * GET /admin/deployments
 * List Cloudflare Pages deployments
 */
export async function listDeployments(c: Context<{ Bindings: Bindings }>) {
  try {
    const cfToken = c.env.GITHUB_TOKEN; // We'll try CF_API_TOKEN from env or credentials
    const credentials = await loadCredentials(c.env);

    // CF API token from env or a dedicated setting
    const apiToken = (c.env as any).CF_API_TOKEN || '';
    const accountId = (c.env as any).CF_ACCOUNT_ID || '';
    const projectName = (c.env as any).CF_PAGES_PROJECT || '';

    if (!apiToken || !accountId || !projectName) {
      return c.json({
        message: '请先配置 Cloudflare API 凭据 (CF_API_TOKEN, CF_ACCOUNT_ID, CF_PAGES_PROJECT)',
      }, 400);
    }

    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}/deployments`;

    const resp = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!resp.ok) {
      const txt = await resp.text();
      return c.json({
        message: `Cloudflare API 错误: ${resp.status}`,
        error: txt.substring(0, 300),
      }, 502);
    }

    const data = await resp.json() as any;
    const deployments = (data.result || []).map((d: any) => ({
      id: d.id,
      url: d.url,
      date: d.created_on,
      environment: d.environment,
      status: d.latest_stage?.status || 'unknown',
    }));

    return c.json({ items: deployments, total: deployments.length });
  } catch (e: any) {
    return c.json({ message: e.message || '获取部署列表失败' }, 500);
  }
}

/**
 * POST /admin/deploy/trigger
 * Trigger a new Cloudflare Pages deployment
 */
export async function triggerDeploy(c: Context<{ Bindings: Bindings }>) {
  try {
    const apiToken = (c.env as any).CF_API_TOKEN || '';
    const accountId = (c.env as any).CF_ACCOUNT_ID || '';
    const projectName = (c.env as any).CF_PAGES_PROJECT || '';

    if (!apiToken || !accountId || !projectName) {
      return c.json({
        message: '请先配置 Cloudflare API 凭据 (CF_API_TOKEN, CF_ACCOUNT_ID, CF_PAGES_PROJECT)',
      }, 400);
    }

    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}/deployments`;

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      return c.json({
        message: `触发部署失败: ${resp.status}`,
        error: txt.substring(0, 300),
      }, 502);
    }

    const data = await resp.json() as any;
    return c.json({
      message: '部署已触发',
      deployment: data.result,
    });
  } catch (e: any) {
    return c.json({ message: e.message || '触发部署失败' }, 500);
  }
}
