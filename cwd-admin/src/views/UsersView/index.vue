<template>
  <div class="page">
    <h2 class="page-title">用户管理</h2>
    <div v-if="!adminSecret" class="page-hint">
      <p>请先配置 Admin Secret：</p>
      <div style="display:flex;gap:8px;margin-top:8px">
        <input v-model="secretInput" type="text" placeholder="输入 ADMIN_SECRET" class="toolbar-input" style="max-width:300px" />
        <button class="toolbar-button" @click="saveSecret">保存</button>
      </div>
    </div>
    <template v-else>
      <div class="toolbar">
        <div class="toolbar-left">
          <span style="color:var(--text-secondary);font-size:13px">共 {{ users.length }} 位用户</span>
        </div>
        <div class="toolbar-right">
          <button class="toolbar-button" @click="loadUsers">刷新</button>
        </div>
      </div>
      <div v-if="loading" class="page-hint">加载中...</div>
      <div v-else-if="error" class="page-error">{{ error }}</div>
      <div v-else-if="users.length === 0" class="page-hint">暂无用户</div>
      <div v-else class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>邮箱</th>
              <th>昵称</th>
              <th>注册时间</th>
              <th>最后登录</th>
              <th>观看记录</th>
              <th>弹幕数</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in users" :key="u.email">
              <td>{{ u.email }}</td>
              <td>{{ u.display_name }}</td>
              <td>{{ formatDate(u.created_at) }}</td>
              <td>{{ formatDate(u.last_login) }}</td>
              <td>{{ u.history_count }}</td>
              <td>{{ u.danmaku_count }}</td>
              <td>
                <button class="action-btn action-btn-danger" @click="confirmDelete(u)">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
    <!-- Delete confirm modal -->
    <div v-if="deleteTarget" class="modal-overlay" @click.self="deleteTarget = null">
      <div class="modal">
        <h3 class="modal-title">确认删除</h3>
        <div class="modal-body">
          <p>确定要删除用户 <strong>{{ deleteTarget.email }}</strong> 吗？</p>
          <p style="color:var(--text-secondary);font-size:12px">将同时删除该用户的观看记录和弹幕。</p>
        </div>
        <div class="modal-actions">
          <button class="modal-btn" style="background:var(--text-secondary)" @click="deleteTarget = null">取消</button>
          <button class="modal-btn" style="background:#e94560" @click="doDelete">删除</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const FFZY_API = 'https://ffzy.233002.xyz';
const SECRET_KEY = 'anime_admin_secret';

type UserItem = {
  email: string;
  display_name: string;
  created_at: string;
  last_login: string;
  history_count: number;
  danmaku_count: number;
};

const adminSecret = ref(localStorage.getItem(SECRET_KEY) || '');
const secretInput = ref('');
const users = ref<UserItem[]>([]);
const loading = ref(false);
const error = ref('');
const deleteTarget = ref<UserItem | null>(null);

function saveSecret() {
  const val = secretInput.value.trim();
  if (!val) return;
  adminSecret.value = val;
  localStorage.setItem(SECRET_KEY, val);
  loadUsers();
}

async function loadUsers() {
  loading.value = true;
  error.value = '';
  try {
    const res = await fetch(`${FFZY_API}/api/admin/users`, {
      headers: { 'X-Admin-Secret': adminSecret.value }
    });
    if (!res.ok) {
      if (res.status === 401) {
        error.value = 'Admin Secret 无效，请重新配置';
        adminSecret.value = '';
        localStorage.removeItem(SECRET_KEY);
        return;
      }
      throw new Error(`请求失败: ${res.status}`);
    }
    const data = await res.json();
    users.value = data.users || [];
  } catch (e: any) {
    error.value = e.message || '加载失败';
  } finally {
    loading.value = false;
  }
}

function confirmDelete(u: UserItem) {
  deleteTarget.value = u;
}

async function doDelete() {
  if (!deleteTarget.value) return;
  const email = deleteTarget.value.email;
  try {
    const res = await fetch(`${FFZY_API}/api/admin/users?email=${encodeURIComponent(email)}`, {
      method: 'DELETE',
      headers: { 'X-Admin-Secret': adminSecret.value }
    });
    if (!res.ok) throw new Error('删除失败');
    users.value = users.value.filter(u => u.email !== email);
    deleteTarget.value = null;
  } catch (e: any) {
    error.value = e.message || '删除失败';
  }
}

function formatDate(s: string | null): string {
  if (!s) return '-';
  try {
    const d = new Date(s + 'Z');
    return d.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  } catch {
    return s;
  }
}

onMounted(() => {
  if (adminSecret.value) loadUsers();
});
</script>

<style scoped>
.page { padding: 0; }
.page-title { font-size: 18px; font-weight: 600; color: var(--text-primary); margin: 0 0 16px; }
.page-hint { color: var(--text-secondary); font-size: 14px; padding: 20px 0; }
.page-error { color: #e94560; font-size: 14px; padding: 20px 0; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; gap: 8px; flex-wrap: wrap; }
.toolbar-left { display: flex; align-items: center; gap: 8px; }
.toolbar-right { display: flex; align-items: center; gap: 8px; }
.toolbar-button { padding: 6px 14px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-card); color: var(--text-primary); cursor: pointer; font-size: 13px; }
.toolbar-button:hover { border-color: var(--primary-color); color: var(--primary-color); }
.toolbar-input { padding: 6px 12px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-card); color: var(--text-primary); font-size: 13px; outline: none; }
.toolbar-input:focus { border-color: var(--primary-color); }
.table-wrap { overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.data-table th { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--border-color); color: var(--text-secondary); font-weight: 500; white-space: nowrap; }
.data-table td { padding: 10px 12px; border-bottom: 1px solid var(--border-color); color: var(--text-primary); }
.data-table tr:hover td { background: var(--bg-hover, rgba(0,0,0,.02)); }
.action-btn { padding: 4px 10px; border: 1px solid var(--border-color); border-radius: 4px; background: transparent; cursor: pointer; font-size: 12px; color: var(--text-primary); }
.action-btn-danger { color: #e94560; border-color: #e94560; }
.action-btn-danger:hover { background: #e94560; color: #fff; }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; z-index: 2000; }
.modal { background: var(--bg-card); border-radius: 10px; max-width: 400px; width: 100%; margin: 10px; padding: 20px; box-shadow: var(--shadow-card); display: flex; flex-direction: column; gap: 14px; }
.modal-title { margin: 0; font-size: 16px; font-weight: 600; color: var(--text-primary); }
.modal-body { font-size: 13px; color: var(--text-secondary); display: flex; flex-direction: column; gap: 6px; }
.modal-body p { margin: 0; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
.modal-btn { padding: 8px 16px; border-radius: 999px; border: none; font-size: 14px; cursor: pointer; color: #fff; }
</style>
