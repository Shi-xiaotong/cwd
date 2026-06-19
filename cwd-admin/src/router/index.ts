import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';
import LoginView from '../views/LoginView/index.vue';
import LayoutView from '../views/LayoutView/index.vue';
import CommentsView from '../views/CommentsView/index.vue';
import SettingsView from '../views/SettingsView/index.vue';
import DataView from '../views/DataView/index.vue';
import StatsView from '../views/StatsView/index.vue';
import AnalyticsVisitView from '../views/AnalyticsVisitView/index.vue';
import UsersView from '../views/UsersView/index.vue';
import EditorView from '../views/EditorView/index.vue';
import CredentialsView from '../views/CredentialsView/index.vue';
import DashboardView from '../views/DashboardView/index.vue';
import ArticlesView from '../views/ArticlesView/index.vue';
import TagsView from '../views/TagsView/index.vue';
import CategoriesView from '../views/CategoriesView/index.vue';
import DailyNewsView from '../views/DailyNewsView/index.vue';
import SeoView from '../views/SeoView/index.vue';
import DeployView from '../views/DeployView/index.vue';


const routes: RouteRecordRaw[] = [
	{
		path: '/login',
		name: 'login',
		component: LoginView,
	},
	{
		path: '/',
		component: LayoutView,
		children: [
		{
			path: '',
			redirect: '/dashboard',
		},
			{
				path: 'dashboard',
				name: 'dashboard',
				component: DashboardView,
				meta: {
					title: '仪表盘',
				},
			},
			{
				path: 'comments',
				name: 'comments',
				component: CommentsView,
				meta: {
					title: '评论管理',
				},
			},
			{
				path: 'stats',
				name: 'stats',
				component: StatsView,
				meta: {
					title: '数据看板',
				},
			},
			{
				path: 'analytics',
				name: 'analytics',
				component: AnalyticsVisitView,
				meta: {
					title: '访问统计',
				},
			},
			{
				path: 'settings',
				name: 'settings',
				component: SettingsView,
				meta: {
					title: '网站设置',
				},
			},
		{
			path: 'data',
			name: 'data',
			component: DataView,
			meta: {
				title: '数据管理',
			},
	},
	{
		path: 'users',
		name: 'users',
		component: UsersView,
		meta: {
			title: '用户管理',
		},
	},
	{
		path: 'editor',
		name: 'editor',
		component: EditorView,
		meta: {
			title: '写文章',
		},
	},
	{
		path: 'credentials',
		name: 'credentials',
		component: CredentialsView,
		meta: {
			title: '发布凭证',
		},
	},
	{
		path: 'articles',
		name: 'articles',
		component: ArticlesView,
		meta: {
			title: '文章管理',
		},
	},
	{
		path: 'tags',
		name: 'tags',
		component: TagsView,
		meta: {
			title: '标签管理',
		},
	},
	{
		path: 'categories',
		name: 'categories',
		component: CategoriesView,
		meta: {
			title: '分类管理',
		},
	},
	{
		path: 'daily-news',
		name: 'daily-news',
		component: DailyNewsView,
		meta: {
			title: '每日热点',
		},
	},
	{
		path: 'seo',
		name: 'seo',
		component: SeoView,
		meta: {
			title: 'SEO工具',
		},
	},
	{
		path: 'deploy',
		name: 'deploy',
		component: DeployView,
		meta: {
			title: '部署管理',
		},
	},

	],
	},
];

export const router = createRouter({
	history: createWebHistory(),
	routes,
});

router.beforeEach((to, from, next) => {
	const storedTitle = localStorage.getItem('cwd_admin_site_title');
	const defaultTitle = storedTitle || 'CWD 评论系统';
	if (to.meta && to.meta.title) {
		document.title = (to.meta.title + ' - ' + defaultTitle) as string;
	} else {
		document.title = defaultTitle as string;
	}
	if (to.name === 'login') {
		next();
		return;
	}
	const token = localStorage.getItem('cwd_admin_token');
	if (!token) {
		next({ name: 'login' });
		return;
	}
	next();
});

router.afterEach((to, from) => {
	if (to.name !== from.name) {
		const layoutContent = document.querySelector('.layout-content');
		if (layoutContent instanceof HTMLElement) {
			layoutContent.scrollTop = 0;
		}
		window.scrollTo(0, 0);
	}
});
