import { Context } from 'hono';
import { Bindings } from '../../bindings';

interface PublishRequest {
  title: string;
  slug: string;
  category: string;
  content: string;       // Markdown content (with R2 image URLs already replaced)
  digest?: string;       // WeChat digest
  coverUrl?: string;     // Cover image URL (R2)
  author?: string;       // WeChat author
  blogUrl?: string;      // Original blog link for WeChat
  createWechatDraft?: boolean;
  wechatImageUrls?: string[];  // WeChat media URLs for inline images
  thumbMediaId?: string;       // WeChat thumb media_id
}

/**
 * POST /admin/editor/publish
 * 
 * Publishes an article to the blog (GitHub commit) and optionally creates a WeChat draft.
 */
export async function editorPublish(c: Context<{ Bindings: Bindings }>) {
  try {
    const body = await c.req.json<PublishRequest>();
    const { title, slug, category, content, digest, coverUrl, author, blogUrl, createWechatDraft, wechatImageUrls, thumbMediaId } = body;

    if (!title || !slug || !category || !content) {
      return c.json({ message: '缺少必填字段: title, slug, category, content' }, 400);
    }

    const githubToken = c.env.GITHUB_TOKEN;
    const blogRepo = c.env.BLOG_REPO || 'Shi-xiaotong/my-blog';

    if (!githubToken) {
      return c.json({ message: 'GITHUB_TOKEN 未配置' }, 500);
    }

    // 1. Build Hexo markdown file
    const now = new Date();
    const dateStr = now.toISOString().replace('T', ' ').substring(0, 19);
    const frontMatter = [
      '---',
      `title: "${title.replace(/"/g, '\\"')}"`,
      `date: ${dateStr}`,
      'categories:',
      `  - ${category}`,
      'tags: []',
      coverUrl ? `cover: ${coverUrl}` : '',
      '---',
      '',
    ].filter(Boolean).join('\n');

    const fullContent = frontMatter + content;
    const filePath = `source/_posts/${category}/${slug}.md`;
    const encodedContent = btoa(unescape(encodeURIComponent(fullContent)));

    // 2. Check if file already exists (get SHA for update)
    let sha: string | null = null;
    const checkUrl = `https://api.github.com/repos/${blogRepo}/contents/${filePath}`;
    const checkResp = await fetch(checkUrl, {
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'cwd-editor',
      },
    });
    if (checkResp.ok) {
      const checkData = await checkResp.json() as any;
      sha = checkData.sha;
    }

    // 3. Commit to GitHub
    const commitUrl = `https://api.github.com/repos/${blogRepo}/contents/${filePath}`;
    const commitBody: any = {
      message: sha ? `post: update ${slug}` : `post: ${slug}`,
      content: encodedContent,
      branch: 'master',
    };
    if (sha) commitBody.sha = sha;

    const commitResp = await fetch(commitUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'cwd-editor',
      },
      body: JSON.stringify(commitBody),
    });

    if (!commitResp.ok) {
      const errText = await commitResp.text();
      console.error('GitHub commit failed:', errText);
      return c.json({ 
        message: `GitHub 提交失败: ${commitResp.status}`,
        error: errText.substring(0, 200),
      }, 502);
    }

    const commitData = await commitResp.json() as any;
    const result: any = {
      message: sha ? '文章已更新' : '文章已发布',
      blog: {
        url: blogUrl || `https://www.233002.xyz/${category}/${slug}.html`,
        commitSha: commitData.commit?.sha?.substring(0, 7),
        path: filePath,
      },
    };

    // 4. Optionally create WeChat draft
    if (createWechatDraft && thumbMediaId) {
      const wxResult = await wxCreateDraft(c, {
        title,
        content,
        digest: digest || '',
        author: author || '贰叁叁零零贰',
        thumbMediaId,
        blogUrl: blogUrl || `https://www.233002.xyz/${category}/${slug}.html`,
        imageUrls: wechatImageUrls || [],
      });
      result.wechat = wxResult;
    }

    return c.json(result);
  } catch (e: any) {
    console.error('Editor publish error:', e);
    return c.json({ message: e.message || '发布失败' }, 500);
  }
}

/**
 * Create a WeChat draft with inline images
 */
async function wxCreateDraft(
  c: Context<{ Bindings: Bindings }>,
  opts: {
    title: string;
    content: string;
    digest: string;
    author: string;
    thumbMediaId: string;
    blogUrl: string;
    imageUrls: string[];
  }
): Promise<any> {
  const appId = c.env.WECHAT_APP_ID;
  const appSecret = c.env.WECHAT_APP_SECRET;

  if (!appId || !appSecret) {
    return { success: false, error: '微信凭据未配置' };
  }

  // Get access token
  const tokenUrl = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`;
  const tokenResp = await fetch(tokenUrl);
  const tokenData = await tokenResp.json() as any;
  if (!tokenData.access_token) {
    return { success: false, error: `Token 获取失败: ${JSON.stringify(tokenData)}` };
  }
  const token = tokenData.access_token;

  // Convert markdown to WeChat HTML (basic conversion)
  const wxHtml = mdToWxHtml(opts.content, opts.imageUrls);

  // Create draft
  const draftUrl = `https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${token}`;
  const article: any = {
    title: opts.title,
    author: opts.author,
    content: wxHtml,
    thumb_media_id: opts.thumbMediaId,
    content_source_url: opts.blogUrl,
    need_open_comment: 1,
    only_fans_can_comment: 0,
  };
  if (opts.digest) {
    article.digest = opts.digest.substring(0, 120);
  }

  const draftResp = await fetch(draftUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ articles: [article] }),
  });
  const draftData = await draftResp.json() as any;

  if (draftData.media_id) {
    return { success: true, mediaId: draftData.media_id };
  }
  return { success: false, error: JSON.stringify(draftData) };
}

/**
 * Basic Markdown → WeChat HTML converter (inline styles)
 */
function mdToWxHtml(md: string, imageUrls: string[]): string {
  const primary = '#1a73e8';
  const sectionStyle = `margin:0;padding:0 8px;max-width:100%;box-sizing:border-box;font-size:15px;line-height:1.8;color:#333;word-break:break-all;`;
  const imgStyle = `margin:0;padding:0;display:block;width:100%;border-radius:8px;`;

  let html = md;

  // Replace image placeholders
  imageUrls.forEach((url, i) => {
    html = html.replace(new RegExp(`!\\[img\\]\\(IMG_${i + 1}\\)`, 'g'),
      `<p style="margin:0 0 15px;padding:0;text-align:center;"><img data-ratio="0.5625" data-w="1080" src="${url}" style="${imgStyle}" /></p>`);
  });

  // Remaining markdown images
  html = html.replace(/!\[img\]\(([^)]+)\)/g,
    `<p style="margin:0 0 15px;padding:0;text-align:center;"><img data-ratio="0.5625" data-w="1080" src="$1" style="${imgStyle}" /></p>`);

  // Headers
  html = html.replace(/^### (.+)$/gm,
    `<h3 style="margin:15px 0 10px;padding:0;font-size:16px;font-weight:bold;color:#333;">$1</h3>`);
  html = html.replace(/^## (.+)$/gm,
    `<h2 style="margin:20px 0 12px;padding:0;font-size:18px;font-weight:bold;color:${primary};">$1</h2>`);
  html = html.replace(/^# (.+)$/gm,
    `<h1 style="margin:25px 0 15px;padding:0;font-size:22px;font-weight:bold;color:${primary};text-align:center;">$1</h1>`);

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g,
    `<strong style="font-weight:bold;">$1</strong>`);

  // Blockquotes
  html = html.replace(/^> (.+)$/gm,
    `<blockquote style="margin:0 0 15px;padding:12px 16px;background:#f0f7ff;border-left:4px solid ${primary};border-radius:0 8px 8px 0;">$1</blockquote>`);

  // HR
  html = html.replace(/^---$/gm,
    `<hr style="margin:20px 0;padding:0;border:none;border-top:1px solid #e0e0e0;" />`);

  // Unordered list items
  html = html.replace(/^- (.+)$/gm,
    `<li style="margin:0;padding:0;line-height:1.8;">$1</li>`);

  // Wrap consecutive <li> in <ul>
  html = html.replace(/((?:<li[^>]*>.*?<\/li>\n?)+)/g,
    `<ul style="margin:10px 0 15px;padding-left:20px;">$1</ul>`);

  // Paragraphs (lines that aren't already HTML)
  html = html.split('\n').map(line => {
    const trimmed = line.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('<')) return line;
    return `<p style="margin:0 0 15px;padding:0;">${trimmed}</p>`;
  }).join('\n');

  // Clean up empty lines
  html = html.replace(/\n{3,}/g, '\n\n');

  return `<section style="${sectionStyle}">\n${html}\n</section>`;
}
