<template>
  <div class="page">
    <h2 class="page-title">每日热点</h2>
    <div
      v-if="toastVisible"
      class="toast"
      :class="toastType === 'error' ? 'toast-error' : 'toast-success'"
    >
      {{ toastMessage }}
    </div>

    <div class="toolbar">
      <div class="toolbar-left"></div>
      <div class="toolbar-right">
        <button
          class="toolbar-button toolbar-button-primary"
          :disabled="regenerating"
          @click="handleRegenerate"
        >
          <PhArrowsClockwise :size="14" :class="{ 'spin': regenerating }" />
          {{ regenerating ? '生成中...' : '重新生成' }}
        </button>
        <button class="toolbar-button" @click="loadDailyNews">刷新</button>
      </div>
    </div>

    <div v-if="loading" class="page-hint">加载中...</div>
    <div v-else-if="error" class="page-error">{{ error }}</div>
    <div v-else>
      <!-- Mobile Card Layout -->
      <div v-if="isMobile" class="news-cards">
        <div v-for="item in newsList" :key="item.path" class="news-card">
          <div class="news-card-cover" v-if="item.coverUrl">
            <img :src="item.coverUrl" :alt="item.title" class="news-card-cover-img" />
          </div>
          <div class="news-card-body">
            <div class="news-card-title">{{ item.title }}</div>
            <div class="news-card-meta">
              <span class="news-card-date">{{ item.date }}</span>
              <span
                class="news-card-status"
                :class="getStatusClass(item.status)"
              >
                {{ getStatusLabel(item.status) }}
              </span>
            </div>
            <div class="news-card-actions">
              <button class="table-action" @click="editNews(item)">编辑</button>
            </div>
          </div>
        </div>
        <div v-if="newsList.length === 0" class="table-empty">暂无每日热点</div>
      </div>

      <!-- Desktop Table Layout -->
      <div v-else class="news-table">
        <div class="table-header">
          <div class="table-cell table-cell-cover">封面</div>
          <div class="table-cell table-cell-title">标题</div>
          <div class="table-cell table-cell-date">日期</div>
          <div class="table-cell table-cell-status">状态</div>
          <div class="table-cell table-cell-actions">操作</div>
        </div>
        <div v-for="item in newsList" :key="item.path" class="table-row">
          <div class="table-cell table-cell-cover">
            <img
              v-if="item.coverUrl"
              :src="item.coverUrl"
              :alt="item.title"
              class="cover-thumbnail"
            />
            <div v-else class="cover-placeholder">
              <PhImage :size="20" />
            </div>
          </div>
          <div class="table-cell table-cell-title">
            <span class="news-title-text" :title="item.title">{{ item.title }}</span>
          </div>
          <div class="table-cell table-cell-date">{{ item.date }}</div>
          <div class="table-cell table-cell-status">
            <span class="status-badge" :class="getStatusClass(item.status)">
              {{ getStatusLabel(item.status) }}
            </span>
          </div>
          <div class="table-cell table-cell-actions">
            <div class="table-actions">
              <button class="table-action" @click="editNews(item)">编辑</button>
            </div>
          </div>
        </div>
        <div v-if="newsList.length === 0" class="table-empty">暂无每日热点</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import {
  getDailyNews,
  regenerateDailyNews,
  type DailyNewsItem,
} from '../../api/admin';

const router = useRouter();

const loading = ref(false);
const error = ref('');
const newsList = ref<DailyNewsItem[]>([]);
const regenerating = ref(false);

const isMobile = ref(window.innerWidth <= 768);
function handleResize() {
  isMobile.value = window.innerWidth <= 768;
}

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

function getStatusLabel(status: string): string {
  switch (status) {
    case 'published': return '已发布';
    case 'generating': return '生成中';
    case 'draft': return '草稿';
    default: return status || '未知';
  }
}

function getStatusClass(status: string): string {
  switch (status) {
    case 'published': return 'status-published';
    case 'generating': return 'status-generating';
    case 'draft': return 'status-draft';
    default: return '';
  }
}

async function loadDailyNews() {
  loading.value = true;
  error.value = '';
  try {
    const res = await getDailyNews();
    newsList.value = res.items || [];
  } catch (e: any) {
    error.value = e.message || '加载每日热点失败';
    showToast(error.value, 'error');
  } finally {
    loading.value = false;
  }
}

async function handleRegenerate() {
  if (!window.confirm('确定要重新生成每日热点吗？这将触发 GitHub Actions。')) return;
  regenerating.value = true;
  try {
    await regenerateDailyNews();
    showToast('已触发重新生成，请稍后刷新查看');
  } catch (e: any) {
    showToast(e.message || '触发重新生成失败', 'error');
  } finally {
    regenerating.value = false;
  }
}

function editNews(item: DailyNewsItem) {
  router.push({ path: '/editor', query: { path: item.path } });
}

onMounted(() => {
  loadDailyNews();
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
}

.toolbar-left {
  display: flex;
  gap: 8px;
  align-items: center;
}

.toolbar-right {
  display: flex;
  gap: 8px;
}

.toolbar-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  background-color: var(--bg-card);
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  transition: all var(--transition-fast);

  &:hover:not(:disabled) {
    background-color: var(--bg-hover);
    border-color: var(--primary-color);
    color: var(--primary-color);
  }

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
}

.toolbar-button-primary {
  background-color: var(--primary-color);
  border-color: var(--primary-color);
  color: var(--text-inverse);

  &:hover:not(:disabled) {
    background-color: var(--primary-hover);
    border-color: var(--primary-hover);
    color: var(--text-inverse);
  }
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.news-table {
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

.table-cell-cover {
  flex: 0 0 60px;
}

.table-cell-title {
  flex: 2;
  min-width: 0;
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
  flex: 0.6;
  text-align: right;
}

.cover-thumbnail {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-sm);
  object-fit: cover;
  border: 1px solid var(--border-color);
}

.cover-placeholder {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-sm);
  background-color: var(--bg-hover);
  border: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
}

.news-title-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
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

.status-generating {
  background-color: rgba(59, 130, 246, 0.1);
  color: var(--primary-color);
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

.table-empty {
  padding: 32px 16px;
  text-align: center;
  color: var(--text-tertiary);
  font-size: 14px;
}

/* Mobile Card Layout */
.news-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.news-card {
  background-color: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-xs);
}

.news-card-cover {
  width: 100%;
  height: 120px;
  overflow: hidden;
}

.news-card-cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.news-card-body {
  padding: 14px;
}

.news-card-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.news-card-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  font-size: 12px;
}

.news-card-date {
  color: var(--text-tertiary);
}

.news-card-status {
  padding: 2px 8px;
  border-radius: var(--radius-full);
  font-size: 11px;
  font-weight: 500;
}

.news-card-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

@media (max-width: 768px) {
  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .toolbar-right {
    justify-content: flex-end;
  }
}
</style>
