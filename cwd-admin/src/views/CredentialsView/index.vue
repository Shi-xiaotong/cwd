<template>
  <div class="credentials-page">
    <h2>发布凭证管理</h2>
    <p class="desc">管理 GitHub 和微信公众号的 API 凭证，用于编辑器发布文章。</p>

    <!-- GitHub -->
    <div class="section">
      <h3>🐙 GitHub</h3>
      <div class="form-group">
        <label>Personal Access Token</label>
        <input v-model="form.github_token" type="password" placeholder="ghp_xxxx（已配置则显示 ****）" />
      </div>
      <div class="form-group">
        <label>仓库 (owner/repo)</label>
        <input v-model="form.github_repo" type="text" placeholder="Shi-xiaotong/my-blog" />
      </div>
    </div>

    <!-- WeChat -->
    <div class="section">
      <h3>💬 微信公众号</h3>
      <div class="form-group">
        <label>AppID</label>
        <input v-model="form.wx_appid" type="text" placeholder="wx1c7f5a..." />
      </div>
      <div class="form-group">
        <label>AppSecret</label>
        <input v-model="form.wx_appsecret" type="password" placeholder="已配置则显示 ****" />
      </div>
    </div>

    <div class="actions">
      <button class="btn-primary" @click="save" :disabled="saving">{{ saving ? '保存中...' : '保存' }}</button>
      <span v-if="msg" :class="msgType === 'ok' ? 'msg-ok' : 'msg-err'">{{ msg }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { getCredentials, updateCredentials } from '../../api/admin';

const form = ref({
  github_token: '',
  github_repo: '',
  wx_appid: '',
  wx_appsecret: '',
});

const saving = ref(false);
const msg = ref('');
const msgType = ref('ok');

onMounted(async () => {
  try {
    const data = await getCredentials();
    form.value = { ...form.value, ...data };
  } catch (e: any) {
    msg.value = '加载失败: ' + e.message;
    msgType.value = 'err';
  }
});

async function save() {
  saving.value = true;
  msg.value = '';
  try {
    await updateCredentials(form.value);
    msg.value = '保存成功';
    msgType.value = 'ok';
  } catch (e: any) {
    msg.value = '保存失败: ' + e.message;
    msgType.value = 'err';
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.credentials-page { max-width: 600px; }
.desc { color: var(--text-secondary, #666); font-size: 14px; margin-bottom: 24px; }
.section { margin-bottom: 24px; padding: 16px; border: 1px solid var(--border-color, #e0e0e0); border-radius: 8px; }
.section h3 { margin: 0 0 12px; font-size: 16px; }
.form-group { margin-bottom: 12px; }
.form-group label { display: block; font-size: 13px; color: var(--text-secondary, #666); margin-bottom: 4px; }
.form-group input { width: 100%; padding: 8px 12px; border: 1px solid var(--border-color, #d0d0d0); border-radius: 6px; font-size: 14px; }
.actions { display: flex; align-items: center; gap: 12px; margin-top: 20px; }
.btn-primary { padding: 8px 24px; background: #1a73e8; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; }
.btn-primary:hover { background: #1557b0; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.msg-ok { color: #34a853; font-size: 13px; }
.msg-err { color: #ea4335; font-size: 13px; }
</style>
