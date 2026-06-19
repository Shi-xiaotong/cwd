import { Bindings } from '../bindings';
import { loadCredentials } from './publishCredentials';

/**
 * Shared GitHub API helpers for blog admin endpoints
 */

/** Extract owner/repo from credential, default fallback */
export async function getGithubRepo(env: Bindings): Promise<{ token: string; repo: string }> {
  const credentials = await loadCredentials(env);
  const token = credentials.github_token;
  const repo = credentials.github_repo || 'Shi-xiaotong/my-blog';
  if (!token) throw new Error('请先在设置中配置 GitHub Token');
  return { token, repo };
}

function ghHeaders(token: string, extra?: Record<string, string>) {
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'cwd-blog-admin',
    ...extra,
  };
}

/** GET a GitHub API URL, parse JSON */
export async function ghFetch(token: string, url: string, init?: RequestInit) {
  const resp = await fetch(url, {
    ...init,
    headers: { ...ghHeaders(token), ...(init?.headers as Record<string, string>) },
  });
  return resp;
}

/** List all .md files under source/_posts/ using the git tree API */
export async function listPostFiles(token: string, repo: string, branch = 'master') {
  const url = `https://api.github.com/repos/${repo}/git/trees/${branch}?recursive=1`;
  const resp = await ghFetch(token, url);
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`GitHub tree API error: ${resp.status} ${txt.substring(0, 200)}`);
  }
  const data = await resp.json() as { tree: Array<{ path: string; sha: string; type: string }> };
  return data.tree.filter(
    (item) => item.type === 'blob' && item.path.startsWith('source/_posts/') && item.path.endsWith('.md')
  );
}

/** Parse Hexo-style YAML front-matter from markdown content */
export function parseFrontMatter(content: string): {
  frontMatter: Record<string, any>;
  body: string;
} {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { frontMatter: {}, body: content };

  const yamlBlock = match[1];
  const body = match[2];
  const fm: Record<string, any> = {};

  let currentKey = '';
  let listMode = false;
  let listItems: string[] = [];

  for (const line of yamlBlock.split('\n')) {
    const trimmed = line.trim();

    // Top-level key: value
    const kvMatch = trimmed.match(/^(\w[\w_-]*):\s*(.*)?$/);
    if (kvMatch) {
      // Save pending list
      if (listMode && currentKey) {
        fm[currentKey] = listItems;
        listItems = [];
        listMode = false;
      }
      currentKey = kvMatch[1];
      const val = kvMatch[2]?.trim();

      if (!val || val === '' || val === '[]') {
        // Could be a list or empty
        if (val === '[]') {
          fm[currentKey] = [];
          currentKey = '';
        } else {
          listMode = true;
          listItems = [];
        }
      } else {
        // Scalar value - strip quotes
        fm[currentKey] = val.replace(/^["']|["']$/g, '');
        currentKey = '';
        listMode = false;
      }
      continue;
    }

    // List item: - value
    const listMatch = trimmed.match(/^-\s+(.+)$/);
    if (listMatch && listMode) {
      listItems.push(listMatch[1].replace(/^["']|["']$/g, ''));
      continue;
    }
  }

  // Flush any remaining list
  if (listMode && currentKey) {
    fm[currentKey] = listItems;
  }

  return { frontMatter: fm, body };
}

/** Build a Hexo front-matter string from a record */
export function buildFrontMatter(fm: Record<string, any>): string {
  const lines: string[] = ['---'];
  for (const [key, value] of Object.entries(fm)) {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`);
      } else {
        lines.push(`${key}:`);
        for (const item of value) {
          lines.push(`  - ${item}`);
        }
      }
    } else if (value === undefined || value === null) {
      lines.push(`${key}:`);
    } else {
      const str = String(value);
      // Quote strings that contain special YAML characters
      if (/[:#{}[\],&*?|>!%@`]/.test(str) || str.includes('"')) {
        lines.push(`${key}: '${str.replace(/'/g, "''")}'`);
      } else {
        lines.push(`${key}: ${str}`);
      }
    }
  }
  lines.push('---');
  return lines.join('\n');
}

/** Decode base64 to UTF-8 string (GitHub API returns base64-encoded content) */
export function decodeBase64Utf8(b64: string): string {
  const binary = atob(b64.replace(/\n/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
