# CWD Blog Admin System — PRD

## 1. 项目概述

将现有 CWD（Cloudflare Workers Discuss）评论系统改造为完整的博客后台管理系统。

- **后端**: Cloudflare Workers (Hono) + D1 + KV + R2
- **前端**: Vue 3 + TypeScript + Vite
- **部署**: CF Pages (前端) + CF Workers (API)
- **GitHub**: `Shi-xiaotong/cwd`

## 2. 现有模块

| 模块 | 路由 | 状态 |
|------|------|------|
| 访问统计 | `/analytics` | ✅ 已有 |
| 评论管理 | `/comments` | ✅ 已有 |
| 数据看板 | `/stats` | ✅ 已有 |
| 写文章 | `/editor` | ✅ 已有 |
| 数据管理 | `/data` | ✅ 已有 |
| 网站设置 | `/settings` | ✅ 已有 |
| 用户管理 | `/users` | ✅ 已有 |
| 发布凭证 | `/credentials` | ✅ 已有 |
| R2 图片管理 | (内嵌) | ✅ 已有 |

## 3. 新增模块

### 3.1 仪表盘 `/dashboard` (替换 `/analytics` 为首页)

**功能**:
- 文章总数 / 本月新增
- 评论总数 / 待审核数
- 今日PV / 本月PV
- R2 存储用量
- 最近 7 天访问趋势图
- 最近评论列表
- 快捷操作入口

**API**: `GET /admin/dashboard` — 聚合现有 stats + analytics 数据

### 3.2 文章管理 `/articles`

**功能**:
- 文章列表（分页、搜索、按分类/标签筛选）
- 文章状态：已发布 / 草稿
- 编辑 → 跳转到 `/editor?slug=xxx`
- 删除（GitHub API 删除文件）
- 取消发布（改为草稿）
- 批量操作

**API**:
- `GET /admin/articles` — 从 GitHub API 读取 `source/_posts/` 目录树
- `GET /admin/articles/:slug` — 读取单篇文章内容
- `DELETE /admin/articles/:slug` — 删除 GitHub 文件
- `PUT /admin/articles/:slug/status` — 修改发布状态（front-matter）

### 3.3 标签管理 `/tags`

**功能**:
- 标签列表（文章数统计）
- 重命名标签（批量更新所有文章 front-matter）
- 合并标签（A 合并到 B）
- 删除标签（从所有文章移除）

**API**:
- `GET /admin/tags` — 扫描所有文章 front-matter 提取标签
- `PUT /admin/tags/rename` — 批量重命名
- `POST /admin/tags/merge` — 合并标签
- `DELETE /admin/tags/:name` — 删除标签

### 3.4 分类管理 `/categories`

**功能**:
- 分类树（文章数统计）
- 重命名分类
- 移动分类
- 新建/删除分类

**API**:
- `GET /admin/categories` — 扫描所有文章 front-matter
- `PUT /admin/categories/rename` — 重命名
- `POST /admin/categories` — 新建

### 3.5 每日热点管理 `/daily-news`

**功能**:
- 列表：已发布的每日热点文章
- 编辑内容
- 重新生成（触发 GitHub Actions workflow_dispatch）
- 手动发布

**API**:
- `GET /admin/daily-news` — 读取 `source/_posts/daily-news/` 目录
- `POST /admin/daily-news/regenerate` — 触发 GitHub Actions

### 3.6 SEO 工具 `/seo`

**功能**:
- 百度推送（手动推送 URL）
- 收录检查（百度搜索 API）
- 推送历史记录

**API**:
- `POST /admin/seo/baidu-push` — 调用百度站长 API
- `GET /admin/seo/history` — 推送记录

### 3.7 部署管理 `/deploy`

**功能**:
- CF Pages 部署历史
- 手动触发部署
- 部署状态

**API**:
- `GET /admin/deployments` — CF API 查询部署记录
- `POST /admin/deploy/trigger` — 触发部署

## 4. 侧边栏重新组织

```
📊 仪表盘          → /dashboard
📝 内容管理
  ├── 写文章       → /editor
  ├── 文章管理     → /articles
  ├── 标签管理     → /tags
  └── 分类管理     → /categories
📰 每日热点        → /daily-news
💬 评论系统
  ├── 评论管理     → /comments
  └── 数据看板     → /stats
📈 访问统计        → /analytics
🔧 系统设置
  ├── SEO 工具     → /seo
  ├── 部署管理     → /deploy
  ├── R2 图片管理  → /r2
  ├── 数据管理     → /data
  ├── 用户管理     → /users
  ├── 发布凭证     → /credentials
  └── 网站设置     → /settings
```

## 5. 技术约束

- 所有 GitHub 操作通过已有凭证（D1 Settings 表 `publish_credentials`）
- 标签/分类管理需要批量更新 GitHub 文件，使用 GitHub API batch
- 新增 D1 表：`seo_push_history`, `deployments`
- 前端复用现有 CSS 变量和组件模式
- Phosphor Icons 全局注册，直接使用 `<PhXxx />`

## 6. 交付标准

- [ ] 所有新模块可用
- [ ] 移动端适配
- [ ] 无 lint 错误
- [ ] API 可正常调用
- [ ] GitHub push 后 CF Pages 自动部署
