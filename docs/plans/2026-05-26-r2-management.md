# CWD Admin R2 图片管理集成

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 在 CWD 后台管理中集成 R2 图片 CRUD 管理功能，实现上传、浏览、删除、复制链接。

**Architecture:** 在 cwd-api Worker 中添加 R2 bucket binding，新增 `/admin/r2/*` API 端点；在 cwd-admin 前端新增 R2View 页面，复用现有侧边栏导航和 i18n 体系。

**Tech Stack:** Hono (后端), R2 binding (Cloudflare Workers), Vue 3 + TypeScript (前端), vue-i18n

---

## Task 1: 添加 R2 binding 配置

**Objective:** 在 Worker 配置中添加 R2 bucket binding

**Files:**
- Modify: `cwd-api/wrangler.jsonc`
- Modify: `cwd-api/src/bindings.ts`

**Step 1: 更新 wrangler.jsonc**

在 `kv_namespaces` 之后添加：

```jsonc
"r2_buckets": [
  {
    "binding": "WALLPAPER_BUCKET",
    "bucket_name": "wallpaper"
  },
  {
    "binding": "MYBLOG_BUCKET",
    "bucket_name": "myblog"
  }
]
```

**Step 2: 更新 bindings.ts**

```typescript
export type Bindings = {
  CWD_DB: D1Database
  CWD_AUTH_KV: KVNamespace;
  WALLPAPER_BUCKET: R2Bucket;
  MYBLOG_BUCKET: R2Bucket;
  ALLOW_ORIGIN: string
  MAIL_GATEWAY_URL?: string
  MAIL_GATEWAY_TOKEN?: string
  ADMIN_NAME: string
  ADMIN_PASSWORD: string
}
```

**Step 3: 验证**

```bash
cd cwd-api && npx wrangler deploy --dry-run 2>&1 | head -20
```

---

## Task 2: 创建 R2 API 端点

**Objective:** 实现 R2 文件的 list、upload、delete、get 操作

**Files:**
- Create: `cwd-api/src/api/admin/r2List.ts`
- Create: `cwd-api/src/api/admin/r2Upload.ts`
- Create: `cwd-api/src/api/admin/r2Delete.ts`
- Create: `cwd-api/src/api/admin/r2Get.ts`

**Step 1: 创建 r2List.ts**

```typescript
import { Hono } from 'hono';
import { Bindings } from '../../bindings';

export const r2List = async (c: any) => {
  const env = c.env as Bindings;
  const prefix = c.req.query('prefix') || '';
  const bucket = c.req.query('bucket') || 'wallpaper';
  const limit = parseInt(c.req.query('limit') || '100');
  const cursor = c.req.query('cursor') || '';

  const bucketBinding = bucket === 'myblog' ? env.MYBLOG_BUCKET : env.WALLPAPER_BUCKET;
  
  if (!bucketBinding) {
    return c.json({ message: 'R2 bucket 未配置' }, 500);
  }

  const options: R2ListOptions = { limit };
  if (prefix) options.prefix = prefix;
  if (cursor) options.cursor = cursor;

  const listed = await bucketBinding.list(options);
  
  const cdnDomain = bucket === 'myblog' 
    ? 'https://img.233002.xyz' 
    : 'https://wallpaper.233002.xyz';

  const objects = listed.objects.map(obj => ({
    key: obj.key,
    size: obj.size,
    lastModified: obj.uploaded.toISOString(),
    etag: obj.etag,
    url: `${cdnDomain}/${obj.key}`,
  }));

  return c.json({
    objects,
    truncated: listed.truncated,
    cursor: listed.cursor,
  });
};
```

**Step 2: 创建 r2Upload.ts**

```typescript
import { Bindings } from '../../bindings';

export const r2Upload = async (c: any) => {
  const env = c.env as Bindings;
  const bucket = c.req.query('bucket') || 'wallpaper';
  const bucketBinding = bucket === 'myblog' ? env.MYBLOG_BUCKET : env.WALLPAPER_BUCKET;

  if (!bucketBinding) {
    return c.json({ message: 'R2 bucket 未配置' }, 500);
  }

  const formData = await c.req.formData();
  const file = formData.get('file') as File;
  const prefix = (formData.get('prefix') as string) || '';

  if (!file) {
    return c.json({ message: '请选择文件' }, 400);
  }

  const filename = file.name || 'upload.jpg';
  const stem = filename.replace(/\.[^.]+$/, '');
  const ext = filename.match(/\.[^.]+$/)?.[0] || '.jpg';
  const key = prefix ? `${prefix.replace(/^\/+|\/+$/g, '')}/${stem}${ext}` : `${stem}${ext}`;

  const buffer = await file.arrayBuffer();
  await bucketBinding.put(key, buffer, {
    httpMetadata: { contentType: file.type || 'image/jpeg' },
  });

  const cdnDomain = bucket === 'myblog' 
    ? 'https://img.233002.xyz' 
    : 'https://wallpaper.233002.xyz';

  return c.json({
    message: '上传成功',
    key,
    url: `${cdnDomain}/${key}`,
    size: buffer.byteLength,
  });
};
```

**Step 3: 创建 r2Delete.ts**

```typescript
import { Bindings } from '../../bindings';

export const r2Delete = async (c: any) => {
  const env = c.env as Bindings;
  const key = c.req.query('key');
  const bucket = c.req.query('bucket') || 'wallpaper';

  if (!key) {
    return c.json({ message: '缺少 key 参数' }, 400);
  }

  const bucketBinding = bucket === 'myblog' ? env.MYBLOG_BUCKET : env.WALLPAPER_BUCKET;

  if (!bucketBinding) {
    return c.json({ message: 'R2 bucket 未配置' }, 500);
  }

  await bucketBinding.delete(key);

  return c.json({ message: '删除成功' });
};
```

**Step 4: 创建 r2Get.ts (获取预签名 URL)**

```typescript
import { Bindings } from '../../bindings';

export const r2Get = async (c: any) => {
  const env = c.env as Bindings;
  const key = c.req.query('key');
  const bucket = c.req.query('bucket') || 'wallpaper';

  if (!key) {
    return c.json({ message: '缺少 key 参数' }, 400);
  }

  const bucketBinding = bucket === 'myblog' ? env.MYBLOG_BUCKET : env.WALLPAPER_BUCKET;

  if (!bucketBinding) {
    return c.json({ message: 'R2 bucket 未配置' }, 500);
  }

  const object = await bucketBinding.get(key);
  if (!object) {
    return c.json({ message: '文件不存在' }, 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);

  return new Response(object.body, { headers });
};
```

**Step 5: 注册路由 (在 index.ts 中)**

```typescript
import { r2List } from './api/admin/r2List';
import { r2Upload } from './api/admin/r2Upload';
import { r2Delete } from './api/admin/r2Delete';
import { r2Get } from './api/admin/r2Get';

// 在 admin 路由区域添加：
app.get('/admin/r2/list', r2List);
app.post('/admin/r2/upload', r2Upload);
app.delete('/admin/r2/delete', r2Delete);
app.get('/admin/r2/get', r2Get);
```

**Step 6: 验证**

```bash
cd cwd-api && npx wrangler deploy 2>&1 | head -10
```

---

## Task 3: 前端 API 层

**Objective:** 添加 R2 相关的 API 函数

**Files:**
- Modify: `cwd-admin/src/api/admin.ts`

**Step 1: 在 admin.ts 末尾添加**

```typescript
// R2 Management
export type R2Object = {
  key: string;
  size: number;
  lastModified: string;
  etag: string;
  url: string;
};

export type R2ListResponse = {
  objects: R2Object[];
  truncated: boolean;
  cursor: string;
};

export function fetchR2List(prefix: string, bucket: string = 'wallpaper', limit: number = 100, cursor?: string): Promise<R2ListResponse> {
  const params = new URLSearchParams({ prefix, bucket, limit: String(limit) });
  if (cursor) params.set('cursor', cursor);
  return get<R2ListResponse>(`/admin/r2/list?${params.toString()}`);
}

export function uploadR2File(file: File, prefix: string, bucket: string = 'wallpaper'): Promise<{ message: string; key: string; url: string; size: number }> {
  const formData = new FormData();
  formData.append('file', file);
  if (prefix) formData.append('prefix', prefix);
  
  const apiBaseUrl = getApiBaseUrl();
  const token = localStorage.getItem('cwd_admin_token');
  
  return fetch(`${apiBaseUrl}/admin/r2/upload?bucket=${bucket}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  }).then(res => res.json());
}

export function deleteR2File(key: string, bucket: string = 'wallpaper'): Promise<{ message: string }> {
  return del<{ message: string }>(`/admin/r2/delete?key=${encodeURIComponent(key)}&bucket=${bucket}`);
}
```

**Step 2: 验证**

```bash
cd cwd-admin && npx vue-tsc --noEmit 2>&1 | head -20
```

---

## Task 4: 前端 R2 管理页面

**Objective:** 创建 R2 图片管理 Vue 组件

**Files:**
- Create: `cwd-admin/src/views/R2View/index.vue`

**Step 1: 创建 R2View 组件**

```vue
<template>
  <div class="r2-view">
    <div class="r2-header">
      <h2 class="r2-title">
        <PhImage :size="20" />
        R2 图片管理
      </h2>
      <div class="r2-actions">
        <select v-model="currentBucket" class="r2-select">
          <option value="wallpaper">Wallpaper</option>
          <option value="myblog">MyBlog</option>
        </select>
        <button class="r2-btn r2-btn-primary" @click="showUpload = true">
          <PhUpload :size="16" />
          上传
        </button>
      </div>
    </div>

    <!-- 文件夹导航 -->
    <div class="r2-breadcrumb">
      <span class="r2-breadcrumb-item" @click="navigateTo('')">根目录</span>
      <span v-for="(part, i) in currentPathParts" :key="i" class="r2-breadcrumb-item"
        @click="navigateTo(currentPathParts.slice(0, i + 1).join('/'))">
        / {{ part }}
      </span>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="r2-loading">加载中...</div>

    <!-- 文件列表 -->
    <div v-else class="r2-grid">
      <div v-for="item in items" :key="item.key" class="r2-item"
        :class="{ 'r2-item-folder': item.isFolder }" @click="handleClick(item)">
        <div class="r2-item-preview">
          <img v-if="!item.isFolder && isImage(item.key)" :src="item.url" :alt="item.name"
            loading="lazy" @error="handleImageError" />
          <PhFolder v-else :size="32" />
        </div>
        <div class="r2-item-info">
          <div class="r2-item-name" :title="item.name">{{ item.name }}</div>
          <div v-if="!item.isFolder" class="r2-item-meta">
            {{ formatSize(item.size) }} · {{ formatDate(item.lastModified) }}
          </div>
        </div>
        <div v-if="!item.isFolder" class="r2-item-actions" @click.stop>
          <button class="r2-icon-btn" @click="copyUrl(item.url)" title="复制链接">
            <PhCopy :size="14" />
          </button>
          <button class="r2-icon-btn r2-icon-btn-danger" @click="confirmDelete(item)" title="删除">
            <PhTrash :size="14" />
          </button>
        </div>
      </div>
      <div v-if="!loading && items.length === 0" class="r2-empty">
        <PhFolderOpen :size="48" />
        <p>此文件夹为空</p>
      </div>
    </div>

    <!-- 分页 -->
    <div v-if="truncated" class="r2-pagination">
      <button class="r2-btn" @click="loadMore">加载更多</button>
    </div>

    <!-- 上传弹窗 -->
    <div v-if="showUpload" class="modal-overlay" @click.self="showUpload = false">
      <div class="modal">
        <h3 class="modal-title">上传文件</h3>
        <div class="modal-body">
          <input type="file" ref="fileInput" accept="image/*" multiple @change="handleFileSelect" />
          <div v-if="uploadFiles.length" class="r2-upload-list">
            <div v-for="(f, i) in uploadFiles" :key="i" class="r2-upload-item">
              {{ f.name }} ({{ formatSize(f.size) }})
            </div>
          </div>
          <div v-if="uploading" class="r2-upload-progress">
            上传中... {{ uploadProgress }}
          </div>
        </div>
        <div class="modal-actions">
          <button class="modal-btn" @click="showUpload = false">取消</button>
          <button class="modal-btn modal-btn-primary" @click="handleUpload" :disabled="uploading || !uploadFiles.length">
            上传 {{ uploadFiles.length }} 个文件
          </button>
        </div>
      </div>
    </div>

    <!-- 删除确认弹窗 -->
    <div v-if="deleteTarget" class="modal-overlay" @click.self="deleteTarget = null">
      <div class="modal">
        <h3 class="modal-title">确认删除</h3>
        <div class="modal-body">
          <p>确定要删除 <strong>{{ deleteTarget.name }}</strong> 吗？</p>
          <p class="r2-delete-hint">此操作不可恢复</p>
        </div>
        <div class="modal-actions">
          <button class="modal-btn" @click="deleteTarget = null">取消</button>
          <button class="modal-btn modal-btn-danger" @click="handleDelete">删除</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { PhImage, PhUpload, PhFolder, PhFolderOpen, PhCopy, PhTrash } from '@phosphor-icons/vue';
import { fetchR2List, uploadR2File, deleteR2File, type R2Object } from '../../api/admin';

const currentBucket = ref('wallpaper');
const currentPrefix = ref('');
const items = ref<(R2Object & { isFolder: boolean; name: string })[]>([]);
const loading = ref(false);
const truncated = ref(false);
const cursor = ref('');
const showUpload = ref(false);
const uploadFiles = ref<File[]>([]);
const uploading = ref(false);
const uploadProgress = ref('');
const deleteTarget = ref<R2Object | null>(null);
const fileInput = ref<HTMLInputElement>();

const currentPathParts = computed(() => {
  if (!currentPrefix.value) return [];
  return currentPrefix.value.replace(/\/$/, '').split('/');
});

function isImage(key: string) {
  return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(key);
}

function formatSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('zh-CN');
}

function navigateTo(prefix: string) {
  currentPrefix.value = prefix;
  loadFiles();
}

async function loadFiles(reset = true) {
  loading.value = true;
  try {
    const res = await fetchR2List(currentPrefix.value, currentBucket.value, 100, reset ? undefined : cursor.value);
    const newItems = res.objects.map(obj => {
      const parts = obj.key.replace(currentPrefix.value, '').split('/').filter(Boolean);
      const isFolder = parts.length > 1 || obj.key.endsWith('/');
      return {
        ...obj,
        isFolder,
        name: parts[0] || obj.key.split('/').pop() || obj.key,
      };
    });
    
    if (reset) {
      // 合并文件夹和文件，文件夹在前
      const folders = newItems.filter(i => i.isFolder);
      const files = newItems.filter(i => !i.isFolder);
      // 去重文件夹
      const uniqueFolders = [...new Map(folders.map(f => [f.name, f])).values()];
      items.value = [...uniqueFolders, ...files];
    } else {
      items.value.push(...newItems);
    }
    
    truncated.value = res.truncated;
    cursor.value = res.cursor;
  } catch (e: any) {
    alert('加载失败: ' + e.message);
  } finally {
    loading.value = false;
  }
}

function handleClick(item: any) {
  if (item.isFolder) {
    navigateTo(item.key);
  } else {
    window.open(item.url, '_blank');
  }
}

function handleFileSelect(e: Event) {
  const input = e.target as HTMLInputElement;
  uploadFiles.value = Array.from(input.files || []);
}

async function handleUpload() {
  if (!uploadFiles.value.length) return;
  uploading.value = true;
  let done = 0;
  const total = uploadFiles.value.length;
  
  try {
    for (const file of uploadFiles.value) {
      uploadProgress.value = `${done}/${total}`;
      await uploadR2File(file, currentPrefix.value, currentBucket.value);
      done++;
    }
    uploadProgress.value = `${done}/${total} 完成`;
    showUpload.value = false;
    uploadFiles.value = [];
    loadFiles();
  } catch (e: any) {
    alert('上传失败: ' + e.message);
  } finally {
    uploading.value = false;
  }
}

function confirmDelete(item: R2Object) {
  deleteTarget.value = item;
}

async function handleDelete() {
  if (!deleteTarget.value) return;
  try {
    await deleteR2File(deleteTarget.value.key, currentBucket.value);
    deleteTarget.value = null;
    loadFiles();
  } catch (e: any) {
    alert('删除失败: ' + e.message);
  }
}

function copyUrl(url: string) {
  navigator.clipboard.writeText(url).then(() => {
    alert('已复制');
  });
}

function handleImageError(e: Event) {
  (e.target as HTMLImageElement).style.display = 'none';
}

function loadMore() {
  loadFiles(false);
}

watch(currentBucket, () => {
  currentPrefix.value = '';
  loadFiles();
});

onMounted(() => {
  loadFiles();
});
</script>

<style scoped>
.r2-view { padding: 20px; }
.r2-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.r2-title { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 18px; }
.r2-actions { display: flex; gap: 8px; }
.r2-select { padding: 6px 12px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); }
.r2-btn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); cursor: pointer; font-size: 13px; }
.r2-btn-primary { background: var(--primary-color); color: white; border-color: var(--primary-color); }
.r2-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.r2-breadcrumb { margin-bottom: 16px; font-size: 13px; color: var(--text-secondary); }
.r2-breadcrumb-item { cursor: pointer; }
.r2-breadcrumb-item:hover { color: var(--primary-color); }
.r2-loading { text-align: center; padding: 40px; color: var(--text-secondary); }
.r2-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
.r2-item { position: relative; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-card); overflow: hidden; cursor: pointer; transition: box-shadow 0.2s; }
.r2-item:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
.r2-item-preview { width: 100%; height: 120px; display: flex; align-items: center; justify-content: center; background: var(--bg-secondary); }
.r2-item-preview img { width: 100%; height: 100%; object-fit: cover; }
.r2-item-info { padding: 8px; }
.r2-item-name { font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.r2-item-meta { font-size: 11px; color: var(--text-secondary); margin-top: 2px; }
.r2-item-actions { position: absolute; top: 4px; right: 4px; display: flex; gap: 4px; opacity: 0; transition: opacity 0.2s; }
.r2-item:hover .r2-item-actions { opacity: 1; }
.r2-icon-btn { width: 24px; height: 24px; border-radius: 4px; border: none; background: rgba(0,0,0,0.5); color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.r2-icon-btn-danger:hover { background: #e53e3e; }
.r2-empty { grid-column: 1/-1; text-align: center; padding: 60px; color: var(--text-secondary); }
.r2-pagination { text-align: center; padding: 20px; }
.r2-upload-list { margin-top: 12px; max-height: 200px; overflow-y: auto; }
.r2-upload-item { padding: 4px 0; font-size: 13px; border-bottom: 1px solid var(--border-color); }
.r2-upload-progress { margin-top: 8px; font-size: 13px; color: var(--primary-color); }
.r2-delete-hint { font-size: 12px; color: #e53e3e; }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 2000; }
.modal { background: var(--bg-card); border-radius: 10px; max-width: 420px; width: 100%; margin: 10px; padding: 20px; }
.modal-title { margin: 0 0 12px; font-size: 16px; font-weight: 600; }
.modal-body { font-size: 13px; color: var(--text-secondary); }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
.modal-btn { padding: 6px 14px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-card); cursor: pointer; font-size: 13px; }
.modal-btn-primary { background: var(--primary-color); color: white; border-color: var(--primary-color); }
.modal-btn-danger { background: #e53e3e; color: white; border-color: #e53e3e; }
</style>
```

**Step 2: 验证**

```bash
cd cwd-admin && npx vue-tsc --noEmit 2>&1 | head -20
```

---

## Task 5: 注册路由和侧边栏

**Objective:** 将 R2View 添加到路由和侧边栏导航

**Files:**
- Modify: `cwd-admin/src/router/index.ts`
- Modify: `cwd-admin/src/views/LayoutView/index.vue`

**Step 1: 更新 router/index.ts**

```typescript
import R2View from '../views/R2View/index.vue';

// 在 children 数组中添加：
{
  path: 'r2',
  name: 'r2',
  component: R2View,
  meta: {
    title: 'R2 图片管理',
  },
},
```

**Step 2: 更新 LayoutView/index.vue 侧边栏**

在 `<ul class="menu">` 中 data 菜单项之前添加：

```vue
<li
  class="menu-item"
  :class="{ active: isRouteActive('r2') }"
  @click="goR2"
>
  <PhImage class="menu-item-icon" :size="18" />
  <span>{{ t("menu.r2") }}</span>
</li>
```

在 `<script setup>` 中添加：

```typescript
import { PhImage } from '@phosphor-icons/vue';

function goR2() {
  router.push({ name: 'r2' });
  closeSider();
}
```

**Step 3: 验证**

```bash
cd cwd-admin && npx vue-tsc --noEmit 2>&1 | head -20
```

---

## Task 6: 添加 i18n 翻译

**Objective:** 为 R2 管理页面添加多语言支持

**Files:**
- Modify: `cwd-admin/src/locales/zh-CN.json`
- Modify: `cwd-admin/src/locales/en-US.json`

**Step 1: 更新 zh-CN.json**

在 `menu` 对象中添加：

```json
"r2": "R2 图片"
```

**Step 2: 更新 en-US.json**

在 `menu` 对象中添加：

```json
"r2": "R2 Images"
```

**Step 3: 验证**

```bash
cd cwd-admin && npx vue-tsc --noEmit 2>&1 | head -20
```

---

## Task 7: 构建和部署

**Objective:** 构建前端并部署两个 Worker

**Step 1: 构建前端**

```bash
cd cwd-admin && npm run build 2>&1 | tail -10
```

**Step 2: 部署 API**

```bash
cd cwd-api && npx wrangler deploy 2>&1 | tail -10
```

**Step 3: 部署 Admin**

```bash
cd cwd-admin && npx wrangler pages deploy dist --project-name=cwd-admin 2>&1 | tail -10
```

**Step 4: 验证**

1. 访问 https://admin.233002.xyz
2. 登录后查看侧边栏是否有 "R2 图片" 菜单
3. 点击进入 R2 管理页面
4. 测试上传、浏览、删除功能
