<template>
  <div class="page">
    <h2 class="page-title">{{ t("r2.title") }}</h2>

    <!-- Toast -->
    <div
      v-if="toastVisible"
      class="toast"
      :class="toastType === 'error' ? 'toast-error' : 'toast-success'"
    >
      {{ toastMessage }}
    </div>

    <!-- Toolbar -->
    <div class="card">
      <div class="r2-toolbar">
        <div class="r2-toolbar-left">
          <label class="form-label">{{ t("r2.bucket") }}</label>
          <select v-model="currentBucket" class="form-select" @change="handleBucketChange">
            <option value="wallpaper">wallpaper</option>
            <option value="myblog">myblog</option>
          </select>
        </div>
        <div class="r2-toolbar-right">
          <input
            ref="fileInputRef"
            type="file"
            multiple
            accept="image/*"
            style="display: none"
            @change="handleFileSelect"
          />
          <button class="card-button secondary" @click="handleRefresh">
            {{ t("r2.refresh") }}
          </button>
          <button class="card-button" :disabled="uploading" @click="triggerUpload">
            {{ uploading ? t("r2.uploading") : t("r2.upload") }}
          </button>
        </div>
      </div>

      <!-- Breadcrumb -->
      <div class="r2-breadcrumb">
        <span class="r2-breadcrumb-item r2-breadcrumb-root" @click="navigateTo('')">
          {{ currentBucket }}
        </span>
        <template v-for="(seg, index) in breadcrumbSegments" :key="index">
          <span class="r2-breadcrumb-sep">/</span>
          <span
            class="r2-breadcrumb-item"
            :class="{ 'r2-breadcrumb-active': index === breadcrumbSegments.length - 1 }"
            @click="navigateToSegment(index)"
          >
            {{ seg }}
          </span>
        </template>
      </div>

      <!-- Upload progress -->
      <div v-if="uploading" class="r2-upload-progress">
        <span>{{ t("r2.uploadProgress", { current: uploadCurrent, total: uploadTotal }) }}</span>
      </div>
    </div>

    <!-- File Grid -->
    <div v-if="loading" class="card r2-empty">
      {{ t("common.loading") }}
    </div>
    <div v-else-if="items.length === 0" class="card r2-empty">
      {{ t("r2.empty") }}
    </div>
    <div v-else class="r2-grid">
      <div
        v-for="item in items"
        :key="item.key"
        class="r2-grid-item"
        @click="handleItemClick(item)"
      >
        <div class="r2-grid-thumb">
          <img
            v-if="item.isImage && item.thumbnailUrl"
            :src="item.thumbnailUrl"
            :alt="item.name"
            class="r2-grid-img"
            loading="lazy"
            @error="handleImgError($event, item)"
          />
          <div v-else class="r2-grid-folder">
            <PhFolder :size="48" />
          </div>
        </div>
        <div class="r2-grid-info">
          <span class="r2-grid-name" :title="item.name">{{ item.name }}</span>
          <span v-if="!item.isFolder" class="r2-grid-size">{{ formatSize(item.size) }}</span>
        </div>
        <!-- Action buttons for files -->
        <div v-if="!item.isFolder" class="r2-grid-actions">
          <button
            class="r2-action-btn"
            :title="t('r2.copyLink')"
            @click.stop="handleCopyLink(item)"
          >
            <PhLink :size="14" />
          </button>
          <button
            class="r2-action-btn r2-action-danger"
            :title="t('r2.delete')"
            @click.stop="handleDelete(item)"
          >
            <PhTrash :size="14" />
          </button>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="r2-pagination">
      <button
        class="r2-page-btn"
        :disabled="currentPage <= 1"
        @click="goPage(currentPage - 1)"
      >
        {{ t("comments.pagination.prev") }}
      </button>
      <span class="r2-page-info">{{ currentPage }} / {{ totalPages }}</span>
      <button
        class="r2-page-btn"
        :disabled="currentPage >= totalPages"
        @click="goPage(currentPage + 1)"
      >
        {{ t("comments.pagination.next") }}
      </button>
    </div>

    <!-- Delete Confirm Modal -->
    <div v-if="deleteModalVisible" class="modal-overlay" @click.self="cancelDelete">
      <div class="modal">
        <h3 class="modal-title">{{ t("r2.confirmDelete") }}</h3>
        <div class="modal-body">
          <p class="modal-row">
            <span class="modal-value">{{ deletingItem?.name }}</span>
          </p>
        </div>
        <div class="modal-actions">
          <button class="modal-btn" type="button" @click="cancelDelete">
            {{ t("comments.editModal.cancel") }}
          </button>
          <button
            class="modal-btn"
            type="button"
            style="background-color: var(--color-danger)"
            @click="confirmDelete"
          >
            {{ t("r2.delete") }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useI18n } from "vue-i18n";
import { PhFolder, PhLink, PhTrash } from "@phosphor-icons/vue";
import {
  fetchR2List,
  uploadR2Files,
  deleteR2File,
  getR2FileUrl,
  R2FileItem,
} from "../../api/admin";

const { t } = useI18n();

// State
const currentBucket = ref("wallpaper");
const currentPrefix = ref("");
const currentPage = ref(1);
const items = ref<R2FileItem[]>([]);
const loading = ref(false);
const total = ref(0);
const pageSize = 50;

// Upload
const fileInputRef = ref<HTMLInputElement | null>(null);
const uploading = ref(false);
const uploadCurrent = ref(0);
const uploadTotal = ref(0);

// Delete
const deleteModalVisible = ref(false);
const deletingItem = ref<R2FileItem | null>(null);

// Toast
const toastMessage = ref("");
const toastType = ref<"success" | "error">("success");
const toastVisible = ref(false);

// Computed
const totalPages = computed(() => Math.ceil(total.value / pageSize));

const breadcrumbSegments = computed(() => {
  if (!currentPrefix.value) return [];
  const raw = currentPrefix.value.replace(/\/$/, "");
  if (!raw) return [];
  return raw.split("/");
});

// Methods
function showToast(msg: string, type: "success" | "error" = "success") {
  toastMessage.value = msg;
  toastType.value = type;
  toastVisible.value = true;
  window.setTimeout(() => {
    toastVisible.value = false;
  }, 2500);
}

async function loadFiles() {
  loading.value = true;
  try {
    const res = await fetchR2List(currentBucket.value, currentPrefix.value, currentPage.value, pageSize);
    items.value = res.items || [];
    total.value = res.total || 0;
  } catch (e: any) {
    showToast(e.message || t("r2.loadError"), "error");
    items.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

function handleBucketChange() {
  currentPrefix.value = "";
  currentPage.value = 1;
  loadFiles();
}

function handleRefresh() {
  loadFiles();
}

function navigateTo(prefix: string) {
  currentPrefix.value = prefix;
  currentPage.value = 1;
  loadFiles();
}

function navigateToSegment(index: number) {
  const segments = currentPrefix.value.replace(/\/$/, "").split("/");
  const newPrefix = segments.slice(0, index + 1).join("/") + "/";
  currentPrefix.value = newPrefix;
  currentPage.value = 1;
  loadFiles();
}

function handleItemClick(item: R2FileItem) {
  if (item.isFolder) {
    currentPrefix.value = item.key;
    currentPage.value = 1;
    loadFiles();
  }
}

function goPage(page: number) {
  currentPage.value = page;
  loadFiles();
}

// Upload
function triggerUpload() {
  if (fileInputRef.value) {
    fileInputRef.value.value = "";
    fileInputRef.value.click();
  }
}

async function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  const files = target.files;
  if (!files || files.length === 0) return;

  const fileArray = Array.from(files);
  uploading.value = true;
  uploadCurrent.value = 0;
  uploadTotal.value = fileArray.length;

  let successCount = 0;
  let failCount = 0;

  for (const file of fileArray) {
    try {
      // Generate thumbnail for images
      let thumbFile: File | null = null;
      if (file.type.startsWith("image/")) {
        thumbFile = await generateThumbnail(file);
      }
      await uploadR2Files(currentBucket.value, currentPrefix.value, file, thumbFile);
      successCount++;
    } catch {
      failCount++;
    }
    uploadCurrent.value++;
  }

  uploading.value = false;

  if (failCount === 0) {
    showToast(t("r2.uploadSuccess", { count: successCount }));
  } else {
    showToast(
      t("r2.uploadPartial", { success: successCount, fail: failCount }),
      "error"
    );
  }

  loadFiles();
}

// Generate thumbnail using Canvas — 400px width, proportional scale, JPEG quality 80
function generateThumbnail(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX_WIDTH = 400;
      let { width, height } = img;
      if (width > MAX_WIDTH) {
        height = Math.round((height * MAX_WIDTH) / width);
        width = MAX_WIDTH;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const stem = file.name.replace(/\.[^.]+$/, "");
            resolve(new File([blob], `${stem}_thumb.jpg`, { type: "image/jpeg" }));
          } else {
            resolve(file); // fallback: use original
          }
        },
        "image/jpeg",
        0.8
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file); // fallback: use original
    };
    img.src = url;
  });
}

// Copy Link
function handleCopyLink(item: R2FileItem) {
  const url = item.url || getR2FileUrl(currentBucket.value, item.key);
  navigator.clipboard.writeText(url).then(
    () => showToast(t("r2.linkCopied")),
    () => showToast(t("r2.copyFailed"), "error")
  );
}

// Delete
function handleDelete(item: R2FileItem) {
  deletingItem.value = item;
  deleteModalVisible.value = true;
}

function cancelDelete() {
  deleteModalVisible.value = false;
  deletingItem.value = null;
}

async function confirmDelete() {
  if (!deletingItem.value) return;
  const key = deletingItem.value.key;
  deleteModalVisible.value = false;
  deletingItem.value = null;

  try {
    await deleteR2File(currentBucket.value, key);
    showToast(t("r2.deleteSuccess"));
    loadFiles();
  } catch (e: any) {
    showToast(e.message || t("r2.deleteFailed"), "error");
  }
}

// Image error fallback — try original URL if thumbnail fails
function handleImgError(event: Event, item: R2FileItem) {
  const img = event.target as HTMLImageElement;
  // If currently showing thumbnail and original is different, fallback to original
  if (item.url && img.src !== item.url) {
    img.src = item.url;
  } else {
    img.style.display = "none";
    const parent = img.parentElement;
    if (parent) {
      parent.classList.add("r2-grid-thumb-fallback");
    }
  }
}

// Format file size
function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + " " + units[i];
}

onMounted(() => {
  loadFiles();
});
</script>

<style scoped>
.r2-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 0;
}

.r2-toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.r2-toolbar-left .form-label {
  margin: 0;
  font-size: 14px;
  color: var(--text-primary);
  white-space: nowrap;
}

.r2-toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.r2-breadcrumb {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 2px;
  margin-top: 12px;
  padding: 8px 0 0;
  font-size: 13px;
  color: var(--text-secondary);
  border-top: 1px solid var(--border-color);
}

.r2-breadcrumb-item {
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  transition: background-color 0.15s;
}

.r2-breadcrumb-item:hover {
  background-color: var(--bg-hover);
  color: var(--primary-color);
}

.r2-breadcrumb-root {
  font-weight: 600;
  color: var(--text-primary);
}

.r2-breadcrumb-active {
  color: var(--text-primary);
  cursor: default;
}

.r2-breadcrumb-active:hover {
  background-color: transparent;
  color: var(--text-primary);
}

.r2-breadcrumb-sep {
  color: var(--text-secondary);
  opacity: 0.6;
}

.r2-upload-progress {
  margin-top: 10px;
  font-size: 13px;
  color: var(--text-secondary);
}

.r2-empty {
  text-align: center;
  padding: 40px 16px;
  font-size: 14px;
  color: var(--text-secondary);
}

.r2-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
}

.r2-grid-item {
  position: relative;
  background-color: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.r2-grid-item:hover {
  border-color: var(--primary-color);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.r2-grid-thumb {
  width: 100%;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-sider);
  overflow: hidden;
}

.r2-grid-thumb-fallback {
  background-color: var(--bg-sider);
}

.r2-grid-thumb-fallback::after {
  content: "";
  display: block;
  width: 48px;
  height: 48px;
  background: var(--text-secondary);
  opacity: 0.3;
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z'/%3E%3C/svg%3E");
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z'/%3E%3C/svg%3E");
  mask-size: contain;
  -webkit-mask-size: contain;
}

.r2-grid-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.r2-grid-folder {
  color: var(--text-secondary);
  opacity: 0.6;
}

.r2-grid-info {
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.r2-grid-name {
  font-size: 12px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.3;
}

.r2-grid-size {
  font-size: 11px;
  color: var(--text-secondary);
}

.r2-grid-actions {
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s;
}

.r2-grid-item:hover .r2-grid-actions {
  opacity: 1;
}

.r2-action-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 6px;
  background-color: var(--bg-card);
  color: var(--text-secondary);
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  transition: background-color 0.15s, color 0.15s;
}

.r2-action-btn:hover {
  background-color: var(--primary-color);
  color: var(--text-inverse);
}

.r2-action-danger:hover {
  background-color: var(--color-danger);
  color: var(--text-inverse);
}

.r2-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 8px 0;
}

.r2-page-btn {
  padding: 6px 14px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background-color: var(--bg-card);
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.r2-page-btn:hover:not(:disabled) {
  background-color: var(--bg-hover);
}

.r2-page-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.r2-page-info {
  font-size: 13px;
  color: var(--text-secondary);
}

/* Reuse modal styles from layout */
.modal-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.modal {
  background-color: var(--bg-card);
  border-radius: 10px;
  max-width: 420px;
  width: 100%;
  margin: 10px;
  padding: 20px 20px 18px;
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.modal-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
  color: var(--text-secondary);
}

.modal-row {
  margin: 0;
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.modal-value {
  flex: 1 1 auto;
  text-align: right;
  word-break: break-all;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 6px;
}

.modal-btn {
  padding: 8px 16px;
  border-radius: 999px;
  border: none;
  font-size: 14px;
  cursor: pointer;
  background-color: var(--primary-color);
  color: var(--text-inverse);
}

.modal-btn:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 2px;
}
</style>
