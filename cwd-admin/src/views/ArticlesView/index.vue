<template>
  <div class="page">
    <h2 class="page-title">文章管理</h2>
    <div
      v-if="toastVisible"
      class="toast"
      :class="toastType === 'error' ? 'toast-error' : 'toast-success'"
    >
      {{ toastMessage }}
    </div>

    <div class="toolbar">
      <div class="toolbar-left">
        <input
          v-model="searchKeyword"
          class="toolbar-input"
          type="text"
          placeholder="搜索文章标题..."
          @keyup.enter="handleSearch"
        />
        <select v-model="categoryFilter" class="toolbar-select" @change="handleSearch">
          <option value="">全部分类</option>
          <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
        </select>
      </div>
      <div class="toolbar-right">
        <button class="toolbar-button" @click="handleSearch">搜索</button>
        <button class="toolbar-button" @click="loadArticles(1)">刷新</button>
      </div>
    </div>

    <div v-if="loading" class="page-hint">加载中...</div>
    <div v-else-if="error" class="page-error">{{ error }}</div>
    <div v-else>
      <!-- Mobile Card Layout -->
      <div v-if="isMobile" class="article-cards">
        <div v-for="item in articles" :key="item.path" class="article-card">
          <div class="article-card-title">{{ item.title }}</div>
          <div class="article-card-meta">
            <span class="article-card-category">{{ item.category || '未分类' }}</span>
            <span class="article-card-date">{{ item.date }}</span>
            <span
              class="article-card-status"
              :class="item.status === 'published' ? 'status-published' : 'status-draft'"
            >
              {{ item.status === 'published' ? '已发布' : '草稿' }}
            </span>
          </div>
          <div v-if="item.tags && item.tags.length" class="article-card-tags">
            <span v-for="tag in item.tags" :key="tag" class="article-tag">{{ tag }}</span>
          </div>
          <div class="article-card-actions">
            <button class="table-action" @click="editArticle(item)">编辑</button>
            <button class="table-action table-action-danger" @click="removeArticle(item)">删除</button>
          </div>
        </div>
        <div v-if="articles.length === 0" class="table-empty">暂无文章</div>
      </div>

      <!-- Desktop Table Layout -->
      <div v-else class="article-table">
        <div class="table-header">
          <div class="table-cell table-cell-title">标题</div>
          <div class="table-cell table-cell-category">分类</div>
          <div class="table-cell table-cell-tags">标签</div>
          <div class="table-cell table-cell-date">日期</div>
          <div class="table-cell table-cell-status">状态</div>
          <div class="table-cell table-cell-actions">操作</div>
        </div>
        <div v-for="item in articles" :key="item.path" class="table-row">
          <div class="table-cell table-cell-title">
            <span class="article-title-text" :title="item.title">{{ item.title }}</span>
          </div>
          <div class="table-cell table-cell-category">{{ item.category || '-' }}</div>
          <div class="table-cell table-cell-tags">
            <span v-for="tag in (item.tags || []).slice(0, 3)" :key="tag" class="article-tag">{{ tag }}</span>
            <span v-if="(item.tags || []).length > 3" class="article-tag-more">+{{ item.tags.length - 3 }}</span>
          </div>
          <div class="table-cell table-cell-date">{{ item.date }}</div>
          <div class="table-cell table-cell-status">
            <span
              class="status-badge"
              :class="item.status === 'published' ? 'status-published' : 'status-draft'"
            >
              {{ item.status === 'published' ? '已发布' : '草稿' }}
            </span>
          </div>
          <div class="table-cell table-cell-actions">
            <div class="table-actions">
              <button class="table-action" @click="editArticle(item)">编辑</button>
              <button class="table-action table-action-danger" @click="removeArticle(item)">删除</button>
            </div>
          </div>
        </div>
        <div v-if="articles.length === 0" class="table-empty">暂无文章</div>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="pagination">
        <button
          class="pagination-button"
          :disabled="currentPage <= 1"
          @click="goPage(currentPage - 1)"
        >
          上一页
        </button>
        <button
          v-for="page in visiblePages"
          :key="page"
          class="pagination-button"
          :class="{ 'pagination-button-active': page === currentPage }"
          :disabled="page === currentPage"
          @click="goPage(page)"
        >
          {{ page }}
        </button>
        <button
          class="pagination-button"
          :disabled="currentPage >= totalPages"
          @click="goPage(currentPage + 1)"
        >
          下一页
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import {
  getArticles,
  deleteArticle,
  getCategories,
  type ArticleItem,
} from '../../api/admin';

const router = useRouter();

const loading = ref(false);
const error = ref('');
const articles = ref<ArticleItem[]>([]);
const currentPage = ref(1);
const totalCount = ref(0);
const pageSize = 20;
const searchKeyword = ref('');
const categoryFilter = ref('');
const categories = ref<string[]>([]);

const isMobile = ref(window.innerWidth <= 768);
function handleResize() {
  isMobile.value = window.innerWidth <= 768;
}

const totalPages = computed(() => Math.max(1, Math.ceil(totalCount.value / pageSize)));

const visiblePages = computed(() => {
  const total = totalPages.value;
  const current = currentPage.value;
  const maxVisible = 5;
  if (total <= maxVisible) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  let start = current - Math.floor(maxVisible / 2);
  let end = current + Math.floor(maxVisible / 2);
  if (start < 1) {
    start = 1;
    end = maxVisible;
  } else if (end > total) {
    end = total;
    start = total - maxVisible + 1;
  }
  const pages: number[] = [];
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  return pages;
});

const toastMessage = ref('');
const toastType = ref<'success' | 'error'>('success');
const toastVisible = ref(false);

function showToast(msg: string, type: 'success' | 'error' = 'success') {
  toastMessage.value = msg;
  toastType.value = type;
  toastVisible.value = true;
  window.setTimeout(() => {
    toastVisible.value = false;
  }, 2000);
}

async function loadArticles(page?: number) {
  const targetPage = typeof page === 'number' ? page : 1;
  loading.value = true;
  error.value = '';
  try {
    const res = await getArticles(targetPage, searchKeyword.value, categoryFilter.value);
    articles.value = res.items || [];
    totalCount.value = res.total || 0;
    currentPage.value = res.page || targetPage;
  } catch (e: any) {
    error.value = e.message || '加载文章失败';
    showToast(error.value, 'error');
  } finally {
    loading.value = false;
  }
}

async function loadCategories() {
  try {
    const res = await getCategories();
    categories.value = (res.items || []).map((c) => c.name);
  } catch {
    // silent
  }
}

function handleSearch() {
  loadArticles(1);
}

function goPage(page: number) {
  if (page < 1 || page > totalPages.value) return;
  loadArticles(page);
}

function editArticle(item: ArticleItem) {
  router.push({ path: '/editor', query: { path: item.path } });
}

async function removeArticle(item: ArticleItem) {
  if (!window.confirm(`确定要删除文章「${item.title}」吗？`)) return;
  try {
    await deleteArticle(item.path);
    showToast('删除成功');
    loadArticles(currentPage.value);
  } catch (e: any) {
    showToast(e.message || '删除失败', 'error');
  }
}

onMounted(() => {
  loadArticles(1);
  loadCategories();
  window.addEventListener('resize', handleResize);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
});
</script>

<style scoped lang="less">
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.toolbar-left {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.toolbar-right {
  display: flex;
  gap: 8px;
}

.toolbar-input {
  padding: 8px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-input);
  background-color: var(--bg-input);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  width: 240px;
  transition: border-color var(--transition-fast);

  &:focus {
    border-color: var(--primary-color);
  }
}

.toolbar-select {
  padding: 8px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-input);
  background-color: var(--bg-input);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  cursor: pointer;
}

.toolbar-button {
  padding: 8px 16px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  background-color: var(--bg-card);
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  transition: all var(--transition-fast);

  &:hover {
    background-color: var(--bg-hover);
    border-color: var(--primary-color);
    color: var(--primary-color);
  }
}

.article-table {
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  overflow: hidden;
  background-color: var(--bg-card);
}

.table-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background-color: var(--bg-hover);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.table-row {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-top: 1px solid var(--border-color);
  transition: background-color var(--transition-fast);

  &:hover {
    background-color: var(--bg-hover);
  }
}

.table-cell {
  font-size: 13px;
  color: var(--text-primary);
  padding: 0 8px;
}

.table-cell-title {
  flex: 2;
  min-width: 0;
}

.table-cell-category {
  flex: 0.8;
  min-width: 0;
}

.table-cell-tags {
  flex: 1.2;
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.table-cell-date {
  flex: 0.8;
  color: var(--text-secondary);
  font-size: 12px;
}

.table-cell-status {
  flex: 0.6;
  text-align: center;
}

.table-cell-actions {
  flex: 0.8;
  text-align: right;
}

.article-title-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
}

.article-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  background-color: var(--primary-light);
  color: var(--primary-color);
  font-size: 11px;
  font-weight: 500;
}

.article-tag-more {
  display: inline-block;
  padding: 2px 6px;
  font-size: 11px;
  color: var(--text-tertiary);
}

.status-badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: var(--radius-full);
  font-size: 12px;
  font-weight: 500;
}

.status-published {
  background-color: rgba(16, 185, 129, 0.1);
  color: var(--color-success);
}

.status-draft {
  background-color: rgba(245, 158, 11, 0.1);
  color: var(--color-warning);
}

.table-actions {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
}

.table-action {
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
  background-color: var(--bg-card);
  color: var(--text-primary);
  font-size: 12px;
  cursor: pointer;
  transition: all var(--transition-fast);

  &:hover {
    background-color: var(--bg-hover);
    border-color: var(--primary-color);
    color: var(--primary-color);
  }
}

.table-action-danger {
  &:hover {
    border-color: var(--color-danger);
    color: var(--color-danger);
    background-color: rgba(239, 68, 68, 0.05);
  }
}

.table-empty {
  padding: 32px 16px;
  text-align: center;
  color: var(--text-tertiary);
  font-size: 14px;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 16px;
  flex-wrap: wrap;
}

.pagination-button {
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
  background-color: var(--bg-card);
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  transition: all var(--transition-fast);
  min-width: 36px;

  &:hover:not(:disabled) {
    border-color: var(--primary-color);
    color: var(--primary-color);
  }

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
}

.pagination-button-active {
  background-color: var(--primary-color);
  border-color: var(--primary-color);
  color: var(--text-inverse);

  &:hover:not(:disabled) {
    background-color: var(--primary-hover);
    color: var(--text-inverse);
  }
}

/* Mobile Card Layout */
.article-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.article-card {
  background-color: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 14px;
  box-shadow: var(--shadow-xs);
}

.article-card-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.article-card-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
  font-size: 12px;
}

.article-card-category {
  color: var(--primary-color);
  font-weight: 500;
}

.article-card-date {
  color: var(--text-tertiary);
}

.article-card-status {
  padding: 2px 8px;
  border-radius: var(--radius-full);
  font-size: 11px;
  font-weight: 500;
}

.article-card-tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.article-card-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

@media (max-width: 768px) {
  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .toolbar-left {
    flex-direction: column;
  }

  .toolbar-input {
    width: 100%;
  }

  .toolbar-select {
    width: 100%;
  }
}
</style>
