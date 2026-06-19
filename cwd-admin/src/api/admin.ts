import { get, post, put, del, getApiBaseUrl } from './http';

export type AdminLoginResponse = {
	data: {
		key: string;
	};
};

export type CommentItem = {
	id: number;
	created: number;
	name: string;
	email: string;
	avatar: string;
	postSlug: string;
	postUrl: string | null;
	url: string | null;
	ipAddress: string | null;
	contentText: string;
	contentHtml: string;
	status: string;
	priority?: number;
	likes?: number;
	ua?: string | null;
	isAdmin?: boolean;
	siteId?: string;
};

export type CommentListResponse = {
	data: CommentItem[];
	pagination: {
		page: number;
		limit: number;
		total: number;
	};
};

export type AdminEmailResponse = {
	email: string | null;
};

export type CommentSettingsResponse = {
	adminEmail: string | null;
	adminBadge: string | null;
	avatarPrefix: string | null;
	adminEnabled: boolean;
	allowedDomains?: string[];
	adminKey?: string | null;
	adminKeySet?: boolean;
	requireReview?: boolean;
	blockedIps?: string[];
	blockedEmails?: string[];
};

export type EmailNotifySettingsResponse = {
	globalEnabled: boolean;
	smtp?: {
		host: string;
		port: number;
		user: string;
		pass: string;
		secure: boolean;
	};
	templates?: {
		reply?: string;
		admin?: string;
	};
};

export type CommentStatsResponse = {
	summary: {
		total: number;
		approved: number;
		pending: number;
		rejected: number;
	};
	domains: {
		domain: string;
		total: number;
		approved: number;
		pending: number;
		rejected: number;
	}[];
	last7Days: {
		date: string;
		total: number;
	}[];
};

export type VisitOverviewResponse = {
	totalPv: number;
	totalPages: number;
	todayPv: number;
	yesterdayPv?: number;
	weekPv: number;
	lastWeekPv?: number;
	monthPv: number;
	lastMonthPv?: number;
	last30Days?: {
		date: string;
		total: number;
	}[];
};

export type VisitPageItem = {
	postSlug: string;
	postTitle: string | null;
	postUrl: string | null;
	pv: number;
	lastVisitAt: number | null;
};

export type VisitPagesResponse = {
	items: VisitPageItem[];
	itemsByPv?: VisitPageItem[];
	itemsByLatest?: VisitPageItem[];
};

export type SiteListResponse = {
	sites: string[];
};

export type LikeStatsItem = {
	pageSlug: string;
	pageTitle: string | null;
	pageUrl: string | null;
	likes: number;
};

export type LikeStatsResponse = {
	items: LikeStatsItem[];
};

export type FeatureSettingsResponse = {
	enableCommentLike: boolean;
	enableArticleLike: boolean;
	enableImageLightbox: boolean;
	commentPlaceholder?: string;
	visibleDomains?: string[];
	adminLanguage?: string;
	widgetLanguage?: string;
};

export type AdminDisplaySettingsResponse = {
	layoutTitle: string | null;
};

export async function loginAdmin(name: string, password: string): Promise<string> {
	const res = await post<AdminLoginResponse>('/admin/login', { name, password });
	const key = res.data.key;
	localStorage.setItem('cwd_admin_token', key);
	return key;
}

export function logoutAdmin(): void {
	localStorage.removeItem('cwd_admin_token');
}

export function fetchComments(page: number, siteId?: string): Promise<CommentListResponse> {
	const searchParams = new URLSearchParams();
	searchParams.set('page', String(page));
	if (siteId && siteId !== 'default') {
		searchParams.set('siteId', siteId);
	}
	return get<CommentListResponse>(`/admin/comments/list?${searchParams.toString()}`);
}

export function deleteComment(id: number): Promise<{ message: string }> {
	return del<{ message: string }>(`/admin/comments/delete?id=${id}`);
}

export function updateCommentStatus(id: number, status: string): Promise<{ message: string }> {
	return put<{ message: string }>(`/admin/comments/status?id=${id}&status=${encodeURIComponent(status)}`);
}

export function updateComment(data: {
	id: number;
	name: string;
	email: string;
	url?: string | null;
	postUrl?: string | null;
	postSlug?: string;
	contentText: string;
	status?: string;
	priority?: number;
}): Promise<{ message: string }> {
	return put<{ message: string }>('/admin/comments/update', {
		id: data.id,
		name: data.name,
		email: data.email,
		url: data.url ?? null,
		postUrl: data.postUrl ?? null,
		postSlug: data.postSlug,
		content: data.contentText,
		status: data.status,
		priority: data.priority,
	});
}

export function fetchAdminEmail(): Promise<AdminEmailResponse> {
	return get<AdminEmailResponse>('/admin/settings/email');
}

export function saveAdminEmail(email: string): Promise<{ message: string }> {
	return put<{ message: string }>('/admin/settings/email', { email });
}

export function fetchEmailNotifySettings(): Promise<EmailNotifySettingsResponse> {
	return get<EmailNotifySettingsResponse>('/admin/settings/email-notify');
}

export function saveEmailNotifySettings(data: {
	globalEnabled?: boolean;
	smtp?: {
		host?: string;
		port?: number;
		user?: string;
		pass?: string;
		secure?: boolean;
	};
	templates?: {
		reply?: string;
		admin?: string;
	};
}): Promise<{ message: string }> {
	return put<{ message: string }>('/admin/settings/email-notify', data);
}

export function sendTestEmail(data: {
	toEmail: string;
	smtp?: {
		host?: string;
		port?: number;
		user?: string;
		pass?: string;
		secure?: boolean;
	};
}): Promise<{ message: string }> {
	return post<{ message: string }>('/admin/settings/email-test', data);
}

export function fetchCommentSettings(): Promise<CommentSettingsResponse> {
	return get<CommentSettingsResponse>('/admin/settings/comments');
}

export function saveCommentSettings(data: {
	adminEmail?: string;
	adminBadge?: string;
	avatarPrefix?: string;
	adminEnabled?: boolean;
	allowedDomains?: string[];
	adminKey?: string;
	requireReview?: boolean;
	blockedIps?: string[];
	blockedEmails?: string[];
}): Promise<{ message: string }> {
	return put<{ message: string }>('/admin/settings/comments', data);
}

export function blockIp(ip: string): Promise<{ message: string }> {
	return post<{ message: string }>('/admin/comments/block-ip', { ip });
}

export function blockEmail(email: string): Promise<{ message: string }> {
	return post<{ message: string }>('/admin/comments/block-email', { email });
}

export function exportComments(): Promise<any[]> {
	return get<any[]>('/admin/comments/export');
}

export function importComments(data: any[]): Promise<{ message: string }> {
	return post<{ message: string }>('/admin/comments/import', data);
}

export function exportConfig(): Promise<any[]> {
	return get<any[]>('/admin/export/config');
}

export function importConfig(data: any[]): Promise<{ message: string }> {
	return post<{ message: string }>('/admin/import/config', data);
}

export function exportStats(siteId?: string): Promise<any> {
	const searchParams = new URLSearchParams();
	if (siteId && siteId !== 'default') {
		searchParams.set('siteId', siteId);
	}
	const query = searchParams.toString();
	return get<any>(query ? `/admin/export/stats?${query}` : '/admin/export/stats');
}

export function importStats(data: any): Promise<{ message: string }> {
	return post<{ message: string }>('/admin/import/stats', data);
}

export function exportBackup(): Promise<any> {
	return get<any>('/admin/export/backup');
}

export function importBackup(data: any): Promise<{ message: string }> {
	return post<{ message: string }>('/admin/import/backup', data);
}

export function fetchCommentStats(siteId?: string): Promise<CommentStatsResponse> {
	const searchParams = new URLSearchParams();
	if (siteId && siteId !== 'default') {
		searchParams.set('siteId', siteId);
	}
	const query = searchParams.toString();
	const url = query ? `/admin/stats/comments?${query}` : '/admin/stats/comments';
	return get<CommentStatsResponse>(url);
}

export function fetchVisitOverview(siteId?: string): Promise<VisitOverviewResponse> {
	const searchParams = new URLSearchParams();
	if (siteId && siteId !== 'default') {
		searchParams.set('siteId', siteId);
	}
	const query = searchParams.toString();
	const url = query ? `/admin/analytics/overview?${query}` : '/admin/analytics/overview';
	return get<VisitOverviewResponse>(url);
}

export function fetchVisitPages(siteId?: string, order?: 'pv' | 'latest'): Promise<VisitPagesResponse> {
	const searchParams = new URLSearchParams();
	if (siteId && siteId !== 'default') {
		searchParams.set('siteId', siteId);
	}
	if (order) {
		searchParams.set('order', order);
	}
	const query = searchParams.toString();
	const url = query ? `/admin/analytics/pages?${query}` : '/admin/analytics/pages';
	return get<VisitPagesResponse>(url);
}

export function fetchSiteList(): Promise<SiteListResponse> {
	return get<SiteListResponse>('/admin/stats/sites');
}

export function fetchLikeStats(siteId?: string): Promise<LikeStatsResponse> {
	const searchParams = new URLSearchParams();
	if (siteId && siteId !== 'default') {
		searchParams.set('siteId', siteId);
	}
	const query = searchParams.toString();
	const url = query ? `/admin/likes/stats?${query}` : '/admin/likes/stats';
	return get<LikeStatsResponse>(url);
}

export function fetchFeatureSettings(): Promise<FeatureSettingsResponse> {
	return get<FeatureSettingsResponse>('/admin/settings/features');
}

export function saveFeatureSettings(data: { enableCommentLike?: boolean; enableArticleLike?: boolean; enableImageLightbox?: boolean; commentPlaceholder?: string; visibleDomains?: string[]; adminLanguage?: string; widgetLanguage?: string }): Promise<{ message: string }> {
	return put<{ message: string }>('/admin/settings/features', data);
}

export function fetchAdminDisplaySettings(): Promise<AdminDisplaySettingsResponse> {
	return get<AdminDisplaySettingsResponse>('/admin/settings/admin-display');
}

export function saveAdminDisplaySettings(data: {
	layoutTitle?: string;
}): Promise<{ message: string }> {
	return put<{ message: string }>('/admin/settings/admin-display', data);
}

export type TelegramSettingsResponse = {
	botToken: string | null;
	chatId: string | null;
	notifyEnabled: boolean;
};

export function fetchTelegramSettings(): Promise<TelegramSettingsResponse> {
	return get<TelegramSettingsResponse>('/admin/settings/telegram');
}

export function saveTelegramSettings(data: { botToken?: string; chatId?: string; notifyEnabled?: boolean }): Promise<{ message: string }> {
	return put<{ message: string }>('/admin/settings/telegram', data);
}

export function setupTelegramWebhook(): Promise<{ message: string; webhookUrl: string }> {
	return post<{ message: string; webhookUrl: string }>('/admin/settings/telegram/setup', {});
}

export function sendTelegramTestMessage(): Promise<{ message: string }> {
	return post<{ message: string }>('/admin/settings/telegram/test', {});
}

export type S3SettingsResponse = {
	endpoint: string;
	accessKeyId: string;
	secretAccessKey: string;
	bucket: string;
	region: string;
};

export function fetchS3Settings(): Promise<S3SettingsResponse> {
	return get<S3SettingsResponse>('/admin/settings/s3');
}

export function saveS3Settings(data: S3SettingsResponse): Promise<{ message: string }> {
	return put<{ message: string }>('/admin/settings/s3', data);
}

export function triggerS3Backup(): Promise<{ message: string; file: string }> {
	return post<{ message: string; file: string }>('/admin/backup/s3', {});
}

export type S3BackupItem = {
	key: string;
	size: number;
	lastModified: string;
};

export function fetchS3BackupList(): Promise<{ files: S3BackupItem[] }> {
	return get<{ files: S3BackupItem[] }>('/admin/backup/s3/list');
}

export function deleteS3Backup(key: string): Promise<{ message: string }> {
	return del<{ message: string }>(`/admin/backup/s3?key=${encodeURIComponent(key)}`);
}

export function downloadS3BackupUrl(key: string): string {
	const rawEnvApiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim();
	const stored = (localStorage.getItem('cwd_admin_api_base_url') || '').trim();
	const source = stored || rawEnvApiBaseUrl;
	const apiBaseUrl = source.replace(/\/+$/, '');
	return `${apiBaseUrl}/admin/backup/s3/download?key=${encodeURIComponent(key)}`;
}

export type R2FileItem = {
	key: string;
	name: string;
	size: number;
	lastModified?: string;
	url?: string;
	thumbnailUrl?: string;
	isFolder: boolean;
	isImage: boolean;
};

export type R2ListResponse = {
	items: R2FileItem[];
	total: number;
};

export function fetchR2List(
	bucket: string,
	prefix: string,
	page: number,
	limit: number
): Promise<R2ListResponse> {
	const searchParams = new URLSearchParams();
	searchParams.set('bucket', bucket);
	searchParams.set('prefix', prefix);
	searchParams.set('page', String(page));
	searchParams.set('limit', String(limit));
	return get<R2ListResponse>(`/admin/r2/list?${searchParams.toString()}`);
}

export function getR2FileUrl(bucket: string, key: string): string {
	const apiBaseUrl = getApiBaseUrl();
	return `${apiBaseUrl}/r2/file?bucket=${encodeURIComponent(bucket)}&key=${encodeURIComponent(key)}`;
}

export async function uploadR2Files(
	bucket: string,
	prefix: string,
	file: File,
	thumbFile?: File | null
): Promise<{ message: string; key: string }> {
	const apiBaseUrl = getApiBaseUrl();
	const token = localStorage.getItem('cwd_admin_token');
	const formData = new FormData();
	formData.append('bucket', bucket);
	formData.append('prefix', prefix);
	formData.append('file', file);
	if (thumbFile) {
		formData.append('thumb', thumbFile);
	}

	const res = await fetch(`${apiBaseUrl}/admin/r2/upload`, {
		method: 'POST',
		headers: {
			...(token ? { Authorization: `Bearer ${token}` } : {}),
		},
		body: formData,
	});

	let data: any = null;
	try {
		data = await res.json();
	} catch {
		data = null;
	}
	if (!res.ok) {
		const message = data && data.message ? data.message : `上传失败，状态码 ${res.status}`;
		throw new Error(message);
	}
	return data;
}

export function deleteR2File(bucket: string, key: string): Promise<{ message: string }> {
	return del<{ message: string }>(
		`/admin/r2/delete?bucket=${encodeURIComponent(bucket)}&key=${encodeURIComponent(key)}`
	);
}

// ===== Editor =====

export async function uploadR2File(file: File, bucket: string, prefix: string): Promise<any> {
	const apiBaseUrl = getApiBaseUrl();
	const token = localStorage.getItem('cwd_admin_token');
	const formData = new FormData();
	formData.append('file', file);
	const res = await fetch(
		`${apiBaseUrl}/admin/r2/upload?bucket=${encodeURIComponent(bucket)}&prefix=${encodeURIComponent(prefix)}`,
		{
			method: 'POST',
			headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
			body: formData,
		}
	);
	if (!res.ok) {
		const data = await res.json().catch(() => ({}));
		throw new Error(data.message || `上传失败 ${res.status}`);
	}
	return res.json();
}

export function editorPublish(data: {
	title: string;
	slug: string;
	category: string;
	content: string;
	digest?: string;
	coverUrl?: string;
	createWechatDraft?: boolean;
	wechatImageUrls?: string[];
	thumbMediaId?: string;
}): Promise<any> {
	return post('/admin/editor/publish', data);
}

export async function uploadWechatImage(imageUrl: string): Promise<string> {
	const apiBaseUrl = getApiBaseUrl();
	const token = localStorage.getItem('cwd_admin_token');
	// First download the image, then upload to WeChat
	const res = await fetch(`${apiBaseUrl}/admin/r2/upload?bucket=myblog&prefix=wechat`, {
		method: 'POST',
		headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
	});
	// For now, return the URL directly — Worker will handle WeChat upload
	return imageUrl;
}

export async function uploadWechatThumb(imageUrl: string): Promise<string> {
	// Placeholder — actual WeChat upload happens in Worker during publish
	return '';
}

// --- Credentials Management ---

export function getCredentials(): Promise<{
	github_token: string;
	github_repo: string;
	wx_appid: string;
	wx_appsecret: string;
}> {
	return get('/admin/credentials');
}

export function updateCredentials(data: {
	github_token?: string;
	github_repo?: string;
	wx_appid?: string;
	wx_appsecret?: string;
}): Promise<{ success: boolean }> {
	return post('/admin/credentials', data);
}

// ===== Dashboard =====

export type DashboardResponse = {
	articleCount: number;
	commentCount: number;
	todayPv: number;
	monthPv: number;
	trend: { date: string; pv: number }[];
	recentComments: CommentItem[];
};

export function getDashboard(): Promise<DashboardResponse> {
	return get<DashboardResponse>('/admin/dashboard');
}

// ===== Articles =====

export type ArticleItem = {
	path: string;
	title: string;
	date: string;
	category: string;
	tags: string[];
	status: string;
	sha: string;
};

export type ArticleListResponse = {
	items: ArticleItem[];
	total: number;
	page: number;
	pageSize: number;
};

export function getArticles(page?: number, search?: string, category?: string): Promise<ArticleListResponse> {
	const params = new URLSearchParams();
	if (page) params.set('page', String(page));
	if (search) params.set('search', search);
	if (category) params.set('category', category);
	const query = params.toString();
	return get<ArticleListResponse>(query ? `/admin/articles?${query}` : '/admin/articles');
}

export function deleteArticle(path: string): Promise<{ message: string }> {
	return del<{ message: string }>(`/admin/articles/${encodeURIComponent(path)}`);
}

// ===== Tags =====

export type TagItem = {
	name: string;
	count: number;
};

export type TagListResponse = {
	items: TagItem[];
	total: number;
};

export function getTags(): Promise<TagListResponse> {
	return get<TagListResponse>('/admin/tags');
}

export function renameTag(oldName: string, newName: string): Promise<{ message: string }> {
	return put<{ message: string }>('/admin/tags/rename', { oldName, newName });
}

export function mergeTags(source: string, target: string): Promise<{ message: string }> {
	return post<{ message: string }>('/admin/tags/merge', { source, target });
}

export function deleteTag(name: string): Promise<{ message: string }> {
	return del<{ message: string }>(`/admin/tags/${encodeURIComponent(name)}`);
}

// ===== Categories =====

export type CategoryItem = {
	name: string;
	count: number;
};

export type CategoryListResponse = {
	items: CategoryItem[];
	total: number;
};

export function getCategories(): Promise<CategoryListResponse> {
	return get<CategoryListResponse>('/admin/categories');
}

export function renameCategory(oldName: string, newName: string): Promise<{ message: string }> {
	return put<{ message: string }>('/admin/categories/rename', { oldName, newName });
}

export function deleteCategory(name: string): Promise<{ message: string }> {
	return del<{ message: string }>(`/admin/categories/${encodeURIComponent(name)}`);
}

// ===== Daily News =====

export type DailyNewsItem = {
	title: string;
	date: string;
	coverUrl: string;
	path: string;
	status: string;
};

export type DailyNewsListResponse = {
	items: DailyNewsItem[];
	total: number;
};

export function getDailyNews(): Promise<DailyNewsListResponse> {
	return get<DailyNewsListResponse>('/admin/daily-news');
}

export function regenerateDailyNews(): Promise<{ message: string }> {
	return post<{ message: string }>('/admin/daily-news/regenerate');
}

// ===== SEO =====

export type BaiduPushResponse = {
	success: number;
	fail: number;
	errors: string[];
};

export function baiduPush(urls: string[]): Promise<BaiduPushResponse> {
	return post<BaiduPushResponse>('/admin/seo/baidu-push', { urls });
}

export type SeoHistoryItem = {
	date: string;
	urlCount: number;
	successCount: number;
	failCount: number;
};

export type SeoHistoryResponse = {
	items: SeoHistoryItem[];
};

export function getSeoHistory(): Promise<SeoHistoryResponse> {
	return get<SeoHistoryResponse>('/admin/seo/history');
}

// ===== Deployments =====

export type DeploymentItem = {
	id: string;
	url: string;
	status: string;
	date: string;
	environment: string;
};

export type DeploymentListResponse = {
	items: DeploymentItem[];
};

export function getDeployments(): Promise<DeploymentListResponse> {
	return get<DeploymentListResponse>('/admin/deployments');
}

export function triggerDeploy(): Promise<{ message: string }> {
	return post<{ message: string }>('/admin/deploy/trigger');
}
