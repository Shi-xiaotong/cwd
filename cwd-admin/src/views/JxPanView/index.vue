<template>
  <div class="jxpan-container">
    <iframe
      :src="jxpanUrl"
      class="jxpan-iframe"
      frameborder="0"
      allow="clipboard-write"
      @load="onIframeLoad"
    />
    <div v-if="loading" class="jxpan-loading">
      <div class="jxpan-spinner"></div>
      <span>加载中...</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";

const jxpanUrl = "https://pan.233002.xyz/admin";
const loading = ref(true);

function onIframeLoad() {
  loading.value = false;
}

onMounted(() => {
  // 超时隐藏loading
  setTimeout(() => {
    loading.value = false;
  }, 8000);
});
</script>

<style scoped>
.jxpan-container {
  position: relative;
  width: 100%;
  height: calc(100vh - 60px);
}

.jxpan-iframe {
  width: 100%;
  height: 100%;
  border: none;
}

.jxpan-loading {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: var(--bg-page, #f5f5f5);
  color: var(--text-secondary, #666);
  font-size: 14px;
}

.jxpan-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--border-color, #e0e0e0);
  border-top-color: var(--primary-color, #4f46e5);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
