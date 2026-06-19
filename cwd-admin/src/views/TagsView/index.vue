<template>
  <div class="page">
    <h2 class="page-title">标签管理</h2>
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
          placeholder="搜索标签..."
        />
      </div>
      <div class="toolbar-right">
        <button class="toolbar-button" @click="loadTags">刷新</button>
      </div>
    </div>

    <div v-if="loading" class="page-hint">加载中...</div>
    <div v-else-if="error" class="page-error">{{ error }}</div>
    <div v-else>
      <!-- Mobile Card Layout -->
      <div v-if="isMobile" class="tag-cards">
        <div v-for="item in filteredTags" :key="item.name" class="tag-card">
          <div class="tag-card-header">
            <span class="tag-card-name">{{ item.name }}</span>
            <span class="tag-card-count">{{ item.count }} 篇文章</span>
          </div>
          <div class="tag-card-actions">
            <button class="table-action" @click="openRename(item)">重命名</button>
            <button class="table-action" @click="openMerge(item)">合并</button>
            <button class="table-action table-action-danger" @click="handleDelete(item)">删除</button>
          </div>
        </div>
        <div v-if="filteredTags.length === 0" class="table-empty">暂无标签</div>
      </div>

      <!-- Desktop Table Layout -->
      <div v-else class="tag-table">
        <div class="table-header">
          <div class="table-cell table-cell-name">标签名</div>
          <div class="table-cell table-cell-count">文章数</div>
          <div class="table-cell table-cell-actions">操作</div>
        </div>
        <div v-for="item in filteredTags" :key="item.name" class="table-row">
          <div class="table-cell table-cell-name">
            <span class="tag-name-badge">{{ item.name }}</span>
          </div>
          <div class="table-cell table-cell-count">{{ item.count }}</div>
          <div class="table-cell table-cell-actions">
            <div class="table-actions">
              <button class="table-action" @click="openRename(item)">重命名</button>
              <button class="table-action" @click="openMerge(item)">合并</button>
              <button class="table-action table-action-danger" @click="handleDelete(item)">删除</button>
            </div>
          </div>
        </div>
        <div v-if="filteredTags.length === 0" class="table-empty">暂无标签</div>
      </div>
    </div>

    <!-- Rename Modal -->
    <div v-if="renameVisible" class="modal-overlay" @click.self="closeRename">
      <div class="modal">
        <h3 class="modal-title">重命名标签</h3>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">当前标签名</label>
            <div class="form-static">{{ renameForm.oldName }}</div>
          </div>
          <div class="form-group">
            <label class="form-label">新标签名</label>
            <input
              v-model="renameForm.newName"
              class="form-input"
              type="text"
              placeholder="输入新的标签名"
            />
          </div>
        </div>
        <div class="modal-actions">
          <button class="modal-btn secondary" @click="closeRename">取消</button>
          <button class="modal-btn" :disabled="!renameForm.newName.trim()" @click="submitRename">确定</button>
        </div>
      </div>
    </div>

    <!-- Merge Modal -->
    <div v-if="mergeVisible" class="modal-overlay" @click.self="closeMerge">
      <div class="modal">
        <h3 class="modal-title">合并标签</h3>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">源标签</label>
            <div class="form-static">{{ mergeForm.source }}</div>
          </div>
          <div class="form-group">
            <label class="form-label">目标标签</label>
            <select v-model="mergeForm.target" class="form-select">
              <option value="" disabled>选择目标标签</option>
              <option v-for="t in mergeTargets" :key="t.name" :value="t.name">
                {{ t.name }} ({{ t.count }} 篇)
              </option>
            </select>
          </div>
          <p class="form-hint">合并后，源标签下的所有文章将被转移到目标标签，源标签将被删除。</p>
        </div>
        <div class="modal-actions">
          <button class="modal-btn secondary" @click="closeMerge">取消</button>
          <button class="modal-btn" :disabled="!mergeForm.target" @click="submitMerge">确定合并</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import {
  getTags,
  renameTag,
  mergeTags,
  deleteTag,
  type TagItem,
} from '../../api/admin';

const loading = ref(false);
const error = ref('');
const tags = ref<TagItem[]>([]);
const searchKeyword = ref('');

const isMobile = ref(window.innerWidth <= 768);
function handleResize() {
  isMobile.value = window.innerWidth <= 768;
}

const filteredTags = computed(() => {
  if (!searchKeyword.value.trim()) return tags.value;
  const kw = searchKeyword.value.trim().toLowerCase();
  return tags.value.filter((t) => t.name.toLowerCase().includes(kw));
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

async function loadTags() {
  loading.value = true;
  error.value = '';
  try {
    const res = await getTags();
    tags.value = res.items || [];
  } catch (e: any) {
    error.value = e.message || '加载标签失败';
    showToast(error.value, 'error');
  } finally {
    loading.value = false;
  }
}

// Rename
const renameVisible = ref(false);
const renameForm = ref({ oldName: '', newName: '' });

function openRename(item: TagItem) {
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
    await renameTag(oldName, newName.trim());
    showToast('重命名成功');
    closeRename();
    loadTags();
  } catch (e: any) {
    showToast(e.message || '重命名失败', 'error');
  }
}

// Merge
const mergeVisible = ref(false);
const mergeForm = ref({ source: '', target: '' });

const mergeTargets = computed(() => {
  return tags.value.filter((t) => t.name !== mergeForm.value.source);
});

function openMerge(item: TagItem) {
  mergeForm.value = { source: item.name, target: '' };
  mergeVisible.value = true;
}

function closeMerge() {
  mergeVisible.value = false;
}

async function submitMerge() {
  const { source, target } = mergeForm.value;
  if (!target) return;
  if (!window.confirm(`确定要将标签「${source}」合并到「${target}」吗？此操作不可撤销。`)) return;
  try {
    await mergeTags(source, target);
    showToast('合并成功');
    closeMerge();
    loadTags();
  } catch (e: any) {
    showToast(e.message || '合并失败', 'error');
  }
}

// Delete
async function handleDelete(item: TagItem) {
  if (!window.confirm(`确定要删除标签「${item.name}」吗？`)) return;
  try {
    await deleteTag(item.name);
    showToast('删除成功');
    loadTags();
  } catch (e: any) {
    showToast(e.message || '删除失败', 'error');
  }
}

onMounted(() => {
  loadTags();
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

.tag-table {
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

.tag-name-badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: var(--radius-full);
  background-color: var(--primary-light);
  color: var(--primary-color);
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

.form-select {
  width: 100%;
  padding: 8px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-input);
  background-color: var(--bg-input);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  cursor: pointer;

  &:focus {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px var(--primary-light);
  }
}

.form-hint {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 8px;
  line-height: 1.5;
}

/* Mobile Card Layout */
.tag-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tag-card {
  background-color: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 14px;
  box-shadow: var(--shadow-xs);
}

.tag-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.tag-card-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.tag-card-count {
  font-size: 12px;
  color: var(--text-secondary);
}

.tag-card-actions {
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
