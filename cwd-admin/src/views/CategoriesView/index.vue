<template>
  <div class="page">
    <h2 class="page-title">分类管理</h2>
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
          placeholder="搜索分类..."
        />
      </div>
      <div class="toolbar-right">
        <button class="toolbar-button" @click="loadCategories">刷新</button>
      </div>
    </div>

    <div v-if="loading" class="page-hint">加载中...</div>
    <div v-else-if="error" class="page-error">{{ error }}</div>
    <div v-else>
      <!-- Mobile Card Layout -->
      <div v-if="isMobile" class="category-cards">
        <div v-for="item in filteredCategories" :key="item.name" class="category-card">
          <div class="category-card-header">
            <span class="category-card-name">{{ item.name }}</span>
            <span class="category-card-count">{{ item.count }} 篇文章</span>
          </div>
          <div class="category-card-actions">
            <button class="table-action" @click="openRename(item)">重命名</button>
            <button class="table-action table-action-danger" @click="handleDelete(item)">删除</button>
          </div>
        </div>
        <div v-if="filteredCategories.length === 0" class="table-empty">暂无分类</div>
      </div>

      <!-- Desktop Table Layout -->
      <div v-else class="category-table">
        <div class="table-header">
          <div class="table-cell table-cell-name">分类名</div>
          <div class="table-cell table-cell-count">文章数</div>
          <div class="table-cell table-cell-actions">操作</div>
        </div>
        <div v-for="item in filteredCategories" :key="item.name" class="table-row">
          <div class="table-cell table-cell-name">
            <span class="category-name-badge">{{ item.name }}</span>
          </div>
          <div class="table-cell table-cell-count">{{ item.count }}</div>
          <div class="table-cell table-cell-actions">
            <div class="table-actions">
              <button class="table-action" @click="openRename(item)">重命名</button>
              <button class="table-action table-action-danger" @click="handleDelete(item)">删除</button>
            </div>
          </div>
        </div>
        <div v-if="filteredCategories.length === 0" class="table-empty">暂无分类</div>
      </div>
    </div>

    <!-- Rename Modal -->
    <div v-if="renameVisible" class="modal-overlay" @click.self="closeRename">
      <div class="modal">
        <h3 class="modal-title">重命名分类</h3>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">当前分类名</label>
            <div class="form-static">{{ renameForm.oldName }}</div>
          </div>
          <div class="form-group">
            <label class="form-label">新分类名</label>
            <input
              v-model="renameForm.newName"
              class="form-input"
              type="text"
              placeholder="输入新的分类名"
            />
          </div>
        </div>
        <div class="modal-actions">
          <button class="modal-btn secondary" @click="closeRename">取消</button>
          <button class="modal-btn" :disabled="!renameForm.newName.trim()" @click="submitRename">确定</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import {
  getCategories,
  renameCategory,
  deleteCategory,
  type CategoryItem,
} from '../../api/admin';

const loading = ref(false);
const error = ref('');
const categories = ref<CategoryItem[]>([]);
const searchKeyword = ref('');

const isMobile = ref(window.innerWidth <= 768);
function handleResize() {
  isMobile.value = window.innerWidth <= 768;
}

const filteredCategories = computed(() => {
  if (!searchKeyword.value.trim()) return categories.value;
  const kw = searchKeyword.value.trim().toLowerCase();
  return categories.value.filter((c) => c.name.toLowerCase().includes(kw));
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

async function loadCategories() {
  loading.value = true;
  error.value = '';
  try {
    const res = await getCategories();
    categories.value = res.items || [];
  } catch (e: any) {
    error.value = e.message || '加载分类失败';
    showToast(error.value, 'error');
  } finally {
    loading.value = false;
  }
}

// Rename
const renameVisible = ref(false);
const renameForm = ref({ oldName: '', newName: '' });

function openRename(item: CategoryItem) {
  renameForm.value = { oldName: item.name, newName: '' };
  renameVisible.value = true;
}

function closeRename() {
  renameVisible.value = false;
}

async function submitRename() {
  const { oldName, newName } = renameForm.value;
  if (!newName.trim()) return;
  try {
    await renameCategory(oldName, newName.trim());
    showToast('重命名成功');
    closeRename();
    loadCategories();
  } catch (e: any) {
    showToast(e.message || '重命名失败', 'error');
  }
}

// Delete
async function handleDelete(item: CategoryItem) {
  if (!window.confirm(`确定要删除分类「${item.name}」吗？`)) return;
  try {
    await deleteCategory(item.name);
    showToast('删除成功');
    loadCategories();
  } catch (e: any) {
    showToast(e.message || '删除失败', 'error');
  }
}

onMounted(() => {
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

.category-table {
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

.table-cell-name {
  flex: 1.5;
}

.table-cell-count {
  flex: 0.8;
  text-align: center;
  color: var(--text-secondary);
}

.table-cell-actions {
  flex: 1;
  text-align: right;
}

.category-name-badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: var(--radius-full);
  background-color: rgba(16, 185, 129, 0.1);
  color: var(--color-success);
  font-size: 13px;
  font-weight: 500;
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

.form-group {
  margin-bottom: 12px;
}

.form-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.form-static {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 600;
  padding: 6px 0;
}

.form-input {
  width: 100%;
  padding: 8px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-input);
  background-color: var(--bg-input);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  transition: border-color var(--transition-fast);

  &:focus {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px var(--primary-light);
  }
}

/* Mobile Card Layout */
.category-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.category-card {
  background-color: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 14px;
  box-shadow: var(--shadow-xs);
}

.category-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.category-card-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.category-card-count {
  font-size: 12px;
  color: var(--text-secondary);
}

.category-card-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

@media (max-width: 768px) {
  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .toolbar-input {
    width: 100%;
  }
}
</style>
