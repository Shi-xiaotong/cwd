<template>
  <div class="page">
    <h2 class="page-title">SEO 工具</h2>
    <div
      v-if="toastVisible"
      class="toast"
      :class="toastType === 'error' ? 'toast-error' : 'toast-success'"
    >
      {{ toastMessage }}
    </div>

    <!-- Baidu Push -->
    <div class="card">
      <div class="card-title-row">
        <h3 class="card-title">百度推送</h3>
      </div>
      <div class="seo-form">
        <div class="form-group">
          <label class="form-label">URL 列表（每行一个）</label>
          <textarea
            v-model="pushUrls"
            class="form-textarea"
            rows="6"
            placeholder="https://example.com/post-1&#10;https://example.com/post-2&#10;..."
          ></textarea>
        </div>
        <div class="seo-form-actions">
          <button
            class="card-button"
            :disabled="!pushUrls.trim() || pushing"
            @click="handlePush"
          >
            {{ pushing ? '推送中...' : '推送到百度' }}
          </button>
        </div>
      </div>
      <div v-if="pushResult" class="push-result">
        <div class="push-result-item push-result-success">
          <PhCheckCircle :size="16" />
          成功: {{ pushResult.success }} 条
        </div>
        <div class="push-result-item push-result-fail">
          <PhXCircle :size="16" />
          失败: {{ pushResult.fail }} 条
        </div>
      </div>
    </div>

    <!-- Push History -->
    <div class="card">
      <div class="card-title-row">
        <h3 class="card-title">推送历史</h3>
        <button class="card-button secondary" style="min-width: auto; padding: 6px 14px;" @click="loadHistory">
          刷新
        </button>
      </div>
      <div v-if="historyLoading" class="page-hint">加载中...</div>
      <div v-else-if="historyError" class="page-error">{{ historyError }}</div>
      <div v-else>
        <!-- Desktop -->
        <div v-if="!isMobile" class="history-table">
          <div class="table-header">
            <div class="table-cell table-cell-date">日期</div>
            <div class="table-cell table-cell-count">URL数</div>
            <div class="table-cell table-cell-count">成功</div>
            <div class="table-cell table-cell-count">失败</div>
          </div>
          <div v-for="(item, index) in history" :key="index" class="table-row">
            <div class="table-cell table-cell-date">{{ item.date }}</div>
            <div class="table-cell table-cell-count">{{ item.urlCount }}</div>
            <div class="table-cell table-cell-count">
              <span class="count-success">{{ item.successCount }}</span>
            </div>
            <div class="table-cell table-cell-count">
              <span class="count-fail">{{ item.failCount }}</span>
            </div>
          </div>
          <div v-if="history.length === 0" class="table-empty">暂无推送记录</div>
        </div>
        <!-- Mobile -->
        <div v-else class="history-cards">
          <div v-for="(item, index) in history" :key="index" class="history-card">
            <div class="history-card-date">{{ item.date }}</div>
            <div class="history-card-stats">
              <span>URL: {{ item.urlCount }}</span>
              <span class="count-success">成功: {{ item.successCount }}</span>
              <span class="count-fail">失败: {{ item.failCount }}</span>
            </div>
          </div>
          <div v-if="history.length === 0" class="table-empty">暂无推送记录</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import {
  baiduPush,
  getSeoHistory,
  type BaiduPushResponse,
  type SeoHistoryItem,
} from '../../api/admin';

const pushUrls = ref('');
const pushing = ref(false);
const pushResult = ref<BaiduPushResponse | null>(null);

const historyLoading = ref(false);
const historyError = ref('');
const history = ref<SeoHistoryItem[]>([]);

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

async function handlePush() {
  const lines = pushUrls.value
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return;
  pushing.value = true;
  pushResult.value = null;
  try {
    const res = await baiduPush(lines);
    pushResult.value = res;
    showToast(`推送完成：成功 ${res.success}，失败 ${res.fail}`);
    loadHistory();
  } catch (e: any) {
    showToast(e.message || '推送失败', 'error');
  } finally {
    pushing.value = false;
  }
}

async function loadHistory() {
  historyLoading.value = true;
  historyError.value = '';
  try {
    const res = await getSeoHistory();
    history.value = res.items || [];
  } catch (e: any) {
    historyError.value = e.message || '加载历史记录失败';
  } finally {
    historyLoading.value = false;
  }
}

onMounted(() => {
  loadHistory();
  window.addEventListener('resize', handleResize);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
});
</script>

<style scoped lang="less">
.seo-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
}

.form-textarea {
  width: 100%;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-input);
  background-color: var(--bg-input);
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
  outline: none;
  resize: vertical;
  transition: border-color var(--transition-fast);

  &:focus {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px var(--primary-light);
  }
}

.seo-form-actions {
  display: flex;
  justify-content: flex-end;
}

.push-result {
  display: flex;
  gap: 20px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
}

.push-result-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
}

.push-result-success {
  color: var(--color-success);
}

.push-result-fail {
  color: var(--color-danger);
}

.history-table {
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  overflow: hidden;
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

.table-cell-date {
  flex: 1;
}

.table-cell-count {
  flex: 0.6;
  text-align: center;
}

.count-success {
  color: var(--color-success);
  font-weight: 500;
}

.count-fail {
  color: var(--color-danger);
  font-weight: 500;
}

.table-empty {
  padding: 32px 16px;
  text-align: center;
  color: var(--text-tertiary);
  font-size: 14px;
}

.history-cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.history-card {
  padding: 12px 14px;
  background-color: var(--bg-body);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
}

.history-card-date {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.history-card-stats {
  display: flex;
  gap: 12px;
  font-size: 13px;
  color: var(--text-secondary);
}
</style>
