<template>
  <div class="page">
    <h2 class="page-title">部署管理</h2>
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
          :disabled="deploying"
          @click="handleDeploy"
        >
          <PhRocket :size="14" :class="{ 'spin': deploying }" />
          {{ deploying ? '触发中...' : '手动部署' }}
        </button>
        <button class="toolbar-button" @click="loadDeployments">刷新</button>
      </div>
    </div>

    <div v-if="loading" class="page-hint">加载中...</div>
    <div v-else-if="error" class="page-error">{{ error }}</div>
    <div v-else>
      <!-- Mobile Card Layout -->
      <div v-if="isMobile" class="deploy-cards">
        <div v-for="item in deployments" :key="item.id" class="deploy-card">
          <div class="deploy-card-header">
            <span class="deploy-card-id">{{ item.id }}</span>
            <span class="status-badge" :class="getStatusClass(item.status)">
              {{ getStatusLabel(item.status) }}
            </span>
          </div>
          <div class="deploy-card-meta">
            <div class="deploy-card-row">
              <span class="deploy-card-label">环境：</span>
              <span>{{ item.environment }}</span>
            </div>
            <div class="deploy-card-row">
              <span class="deploy-card-label">时间：</span>
              <span>{{ item.date }}</span>
            </div>
            <div v-if="item.url" class="deploy-card-row">
              <span class="deploy-card-label">URL：</span>
              <a :href="item.url" target="_blank" rel="noreferrer" class="deploy-link">{{ item.url }}</a>
            </div>
          </div>
        </div>
        <div v-if="deployments.length === 0" class="table-empty">暂无部署记录</div>
      </div>

      <!-- Desktop Table Layout -->
      <div v-else class="deploy-table">
        <div class="table-header">
          <div class="table-cell table-cell-id">ID</div>
          <div class="table-cell table-cell-url">URL</div>
          <div class="table-cell table-cell-status">状态</div>
          <div class="table-cell table-cell-date">日期</div>
          <div class="table-cell table-cell-env">环境</div>
        </div>
        <div v-for="item in deployments" :key="item.id" class="table-row">
          <div class="table-cell table-cell-id">
            <span class="deploy-id-text">{{ item.id }}</span>
          </div>
          <div class="table-cell table-cell-url">
            <a
              v-if="item.url"
              :href="item.url"
              target="_blank"
              rel="noreferrer"
              class="deploy-link"
            >
              {{ item.url }}
            </a>
            <span v-else>-</span>
          </div>
          <div class="table-cell table-cell-status">
            <span class="status-badge" :class="getStatusClass(item.status)">
              {{ getStatusLabel(item.status) }}
            </span>
          </div>
          <div class="table-cell table-cell-date">{{ item.date }}</div>
          <div class="table-cell table-cell-env">
            <span class="env-badge">{{ item.environment }}</span>
          </div>
        </div>
        <div v-if="deployments.length === 0" class="table-empty">暂无部署记录</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import {
  getDeployments,
  triggerDeploy,
  type DeploymentItem,
} from '../../api/admin';

const loading = ref(false);
const error = ref('');
const deployments = ref<DeploymentItem[]>([]);
const deploying = ref(false);

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
    case 'success': return '成功';
    case 'building': return '构建中';
    case 'failed': return '失败';
    case 'pending': return '等待中';
    case 'ready': return '就绪';
    default: return status || '未知';
  }
}

function getStatusClass(status: string): string {
  switch (status) {
    case 'success':
    case 'ready':
      return 'status-success';
    case 'building':
    case 'pending':
      return 'status-building';
    case 'failed':
      return 'status-failed';
    default:
      return '';
  }
}

async function loadDeployments() {
  loading.value = true;
  error.value = '';
  try {
    const res = await getDeployments();
    deployments.value = res.items || [];
  } catch (e: any) {
    error.value = e.message || '加载部署记录失败';
    showToast(error.value, 'error');
  } finally {
    loading.value = false;
  }
}

async function handleDeploy() {
  if (!window.confirm('确定要触发一次手动部署吗？')) return;
  deploying.value = true;
  try {
    await triggerDeploy();
    showToast('已触发部署，请稍后刷新查看');
    loadDeployments();
  } catch (e: any) {
    showToast(e.message || '触发部署失败', 'error');
  } finally {
    deploying.value = false;
  }
}

onMounted(() => {
  loadDeployments();
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

.deploy-table {
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

.table-cell-id {
  flex: 0.8;
  min-width: 0;
}

.table-cell-url {
  flex: 1.5;
  min-width: 0;
}

.table-cell-status {
  flex: 0.6;
  text-align: center;
}

.table-cell-date {
  flex: 0.8;
  color: var(--text-secondary);
  font-size: 12px;
}

.table-cell-env {
  flex: 0.6;
  text-align: center;
}

.deploy-id-text {
  font-family: monospace;
  font-size: 12px;
  color: var(--text-secondary);
}

.deploy-link {
  color: var(--text-link);
  text-decoration: none;
  font-size: 12px;
  word-break: break-all;

  &:hover {
    text-decoration: underline;
  }
}

.status-badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: var(--radius-full);
  font-size: 12px;
  font-weight: 500;
}

.status-success {
  background-color: rgba(16, 185, 129, 0.1);
  color: var(--color-success);
}

.status-building {
  background-color: rgba(59, 130, 246, 0.1);
  color: var(--primary-color);
}

.status-failed {
  background-color: rgba(239, 68, 68, 0.1);
  color: var(--color-danger);
}

.env-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  background-color: var(--bg-hover);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 500;
}

.table-empty {
  padding: 32px 16px;
  text-align: center;
  color: var(--text-tertiary);
  font-size: 14px;
}

/* Mobile Card Layout */
.deploy-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.deploy-card {
  background-color: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 14px;
  box-shadow: var(--shadow-xs);
}

.deploy-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.deploy-card-id {
  font-family: monospace;
  font-size: 13px;
  color: var(--text-secondary);
}

.deploy-card-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.deploy-card-row {
  display: flex;
  font-size: 13px;
  color: var(--text-primary);
}

.deploy-card-label {
  color: var(--text-secondary);
  flex-shrink: 0;
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
