<template>
  <div class="page">
    <h2 class="page-title">{{ t("lanzou.title") }}</h2>

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
      <div class="lanzou-toolbar">
        <div class="lanzou-toolbar-left">
          <input
            v-model="searchQuery"
            class="lanzou-search"
            :placeholder="t('lanzou.searchPlaceholder')"
            @input="handleSearch"
          />
        </div>
        <div class="lanzou-toolbar-right">
          <span class="lanzou-count">{{ t("lanzou.total", { count: total }) }}</span>
          <button class="card-button secondary" @click="loadFiles">
            {{ t("lanzou.refresh") }}
          </button>
          <button class="card-button secondary" @click="openSettings">
            {{ t("lanzou.settings") }}
          </button>
          <button class="card-button" :disabled="uploading" @click="triggerUpload">
            {{ uploading ? t("lanzou.uploading") : t("lanzou.upload") }}
          </button>
          <button class="card-button secondary" @click="openUrlUpload">
            {{ t("lanzou.uploadByUrl") }}
          </button>
        </div>
      </div>
    </div>

    <!-- Upload Progress -->
    <div v-if="uploading" class="card lanzou-upload-progress">
      <span>{{ uploadStatus }}</span>
      <div class="lanzou-progress-bar">
        <div class="lanzou-progress-fill" :style="{ width: uploadPercent + '%' }"></div>
      </div>
    </div>

    <!-- File List -->
    <div v-if="loading" class="card lanzou-empty">
      {{ t("common.loading") }}
    </div>
    <div v-else-if="files.length === 0" class="card lanzou-empty">
      {{ t("lanzou.empty") }}
    </div>
    <div v-else class="lanzou-grid">
      <div
        v-for="file in files"
        :key="file.id"
        class="lanzou-grid-item"
      >
        <div class="lanzou-grid-thumb">
          <img
            :src="file.cover_url || getDefaultCover(file)"
            :alt="file.name"
            class="lanzou-grid-img"
            loading="lazy"
            @error="handleImgError($event, file)"
          />
        </div>
        <div class="lanzou-grid-info">
          <span class="lanzou-grid-name" :title="file.name">{{ file.name }}</span>
          <span class="lanzou-grid-meta">{{ formatSize(file.size) }} &middot; {{ formatDate(file.created_at) }}</span>
        </div>
        <div class="lanzou-grid-actions">
          <button
            class="lanzou-action-btn"
            :title="t('lanzou.copyLink')"
            @click.stop="copyDirectLink(file)"
          >
            <PhLink :size="14" />
          </button>
          <button
            class="lanzou-action-btn"
            :title="t('lanzou.preview')"
            @click.stop="openPreview(file)"
          >
            <PhEye :size="14" />
          </button>
          <button
            class="lanzou-action-btn lanzou-action-danger"
            :title="t('lanzou.delete')"
            @click.stop="confirmDelete(file)"
          >
            <PhTrash :size="14" />
          </button>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="lanzou-pagination">
      <button class="card-button secondary" :disabled="page <= 1" @click="goPage(page - 1)">
        {{ t("lanzou.prev") }}
      </button>
      <span class="lanzou-page-info">{{ page }} / {{ totalPages }}</span>
      <button class="card-button secondary" :disabled="page >= totalPages" @click="goPage(page + 1)">
        {{ t("lanzou.next") }}
      </button>
    </div>

    <!-- Hidden file input -->
    <input
      ref="fileInputRef"
      type="file"
      accept="*/*"
      style="display: none"
      @change="handleFileSelect"
    />

    <!-- Preview Modal -->
    <div v-if="previewVisible" class="modal-overlay" @click.self="closePreview">
      <div class="modal lanzou-preview-modal">
        <h3 class="modal-title">{{ previewFile?.name }}</h3>
        <div class="modal-body">
          <img
            v-if="previewFile && isImage(previewFile.mime_type)"
            :src="previewFile.cover_url || previewFile.direct_url || getDefaultCover(previewFile)"
            :alt="previewFile.name"
            class="lanzou-preview-img"
          />
          <div v-else class="lanzou-preview-info">
            <img
              v-if="previewFile"
              :src="getDefaultCover(previewFile)"
              style="width: 80px; height: 66px; object-fit: contain;"
            />
            <p>{{ previewFile?.name }}</p>
            <p>{{ formatSize(previewFile?.size || 0) }}</p>
          </div>
          <div class="lanzou-detail-row">
            <span class="lanzou-detail-label">{{ t("lanzou.shareLink") }}</span>
            <span class="lanzou-detail-value">{{ previewFile?.lanzou_share_url }}</span>
          </div>
          <div class="lanzou-detail-row">
            <span class="lanzou-detail-label">{{ t("lanzou.password") }}</span>
            <span class="lanzou-detail-value">{{ previewFile?.lanzou_password || '-' }}</span>
          </div>
          <div class="lanzou-detail-row">
            <span class="lanzou-detail-label">{{ t("lanzou.directLink") }}</span>
            <div class="lanzou-detail-link">
              <span class="lanzou-detail-value lanzou-detail-url">{{ previewFile?.direct_url }}</span>
              <button class="lanzou-action-btn" @click="copyText(previewFile?.direct_url || '')">
                <PhCopy :size="14" />
              </button>
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button class="modal-btn" type="button" @click="closePreview">
            {{ t("lanzou.close") }}
          </button>
        </div>
      </div>
    </div>

    <!-- URL Upload Modal -->
    <div v-if="urlUploadVisible" class="modal-overlay" @click.self="closeUrlUpload">
      <div class="modal">
        <h3 class="modal-title">{{ t("lanzou.urlUploadTitle") }}</h3>
        <div class="modal-body" v-if="!urlUploading">
          <input
            v-model="urlUploadInput"
            class="lanzou-settings-input"
            :placeholder="t('lanzou.urlUploadPlaceholder')"
            @keyup.enter="doUrlUpload"
          />
        </div>
        <div class="modal-body" v-else>
          <div class="lanzou-url-progress">
            <div class="lanzou-url-progress-text">
              {{ t("lanzou.urlUploading") }}
            </div>
            <div class="lanzou-progress-bar lanzou-progress-indeterminate">
              <div class="lanzou-progress-fill"></div>
            </div>
            <div class="lanzou-url-timer">{{ formatElapsed(urlElapsed) }}</div>
          </div>
        </div>
        <div class="modal-actions">
          <button class="modal-btn secondary" type="button" @click="closeUrlUpload" :disabled="urlUploading">
            {{ urlUploading ? t("lanzou.background") : t("lanzou.cancel") }}
          </button>
          <button class="modal-btn" type="button" :disabled="urlUploading || !urlUploadInput.trim()" @click="doUrlUpload">
            {{ urlUploading ? t("lanzou.uploading") : t("lanzou.confirm") }}
          </button>
        </div>
      </div>
    </div>

    <!-- Settings Modal -->
    <div v-if="settingsVisible" class="modal-overlay" @click.self="closeSettings">
      <div class="modal">
        <h3 class="modal-title">{{ t("lanzou.settingsTitle") }}</h3>
        <div class="modal-body">
          <p style="margin: 0; font-size: 13px; color: var(--text-secondary);">
            {{ t("lanzou.settingsDesc") }}
          </p>
          <div>
            <label class="form-label">{{ t("lanzou.cookieLabel") }}</label>
            <textarea
              v-model="settingsCookie"
              class="lanzou-settings-textarea"
              rows="4"
              :placeholder="t('lanzou.cookiePlaceholder')"
            ></textarea>
          </div>
          <div>
            <label class="form-label">{{ t("lanzou.folderIdLabel") }}</label>
            <input
              v-model="settingsFolderId"
              class="lanzou-settings-input"
              placeholder="12888237"
            />
          </div>
        </div>
        <div class="modal-actions">
          <button class="modal-btn secondary" type="button" @click="closeSettings">
            {{ t("lanzou.cancel") }}
          </button>
          <button class="modal-btn" type="button" @click="saveSettings">
            {{ t("lanzou.save") }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Confirm Modal -->
    <div v-if="deleteVisible" class="modal-overlay" @click.self="cancelDelete">
      <div class="modal">
        <h3 class="modal-title">{{ t("lanzou.confirmDelete") }}</h3>
        <div class="modal-body">
          <p>{{ t("lanzou.deleteWarning", { name: deleteFile?.name }) }}</p>
        </div>
        <div class="modal-actions">
          <button class="modal-btn secondary" type="button" @click="cancelDelete">
            {{ t("lanzou.cancel") }}
          </button>
          <button class="modal-btn danger" type="button" @click="doDelete" :disabled="deleting">
            {{ deleting ? t('lanzou.deleting') : t("lanzou.confirm") }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import {
  fetchLanzouList,
  uploadLanzouFile,
  uploadLanzouByUrl,
  deleteLanzouFile,
  fetchLanzouSettings,
  saveLanzouSettings,
  type LanzouFileItem,
} from "../../api/admin";

const { t } = useI18n();

// State
const files = ref<LanzouFileItem[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 20;
const loading = ref(false);
const searchQuery = ref("");
const uploading = ref(false);
const uploadStatus = ref("");
const uploadPercent = ref(0);
const fileInputRef = ref<HTMLInputElement | null>(null);

// Toast
const toastVisible = ref(false);
const toastMessage = ref("");
const toastType = ref<"success" | "error">("success");

// Preview
const previewVisible = ref(false);
const previewFile = ref<LanzouFileItem | null>(null);

// Delete
const deleteVisible = ref(false);
const deleteFile = ref<LanzouFileItem | null>(null);
const deleting = ref(false);

// Settings
const settingsVisible = ref(false);
const settingsCookie = ref("");
const settingsFolderId = ref("");

// URL Upload
const urlUploadVisible = ref(false);
const urlUploadInput = ref("");
const urlUploading = ref(false);
const urlElapsed = ref(0);
let urlTimerInterval: ReturnType<typeof setInterval> | null = null;

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)));

let searchTimer: ReturnType<typeof setTimeout> | null = null;

function showToast(message: string, type: "success" | "error" = "success") {
  toastMessage.value = message;
  toastType.value = type;
  toastVisible.value = true;
  setTimeout(() => (toastVisible.value = false), 3000);
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isImage(mime: string): boolean {
  return mime?.startsWith("image/") || false;
}

function isVideo(mime: string): boolean {
  return mime?.startsWith("video/") || false;
}

// 默认封面 SVG data URIs（内联，无需外部存储）
const DEFAULT_COVERS = {
  folder: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 100"><rect width="120" height="100" rx="8" fill="#FFF3E0"/><path d="M10 30h35l8-10h57a5 5 0 015 5v60a5 5 0 01-5 5H10a5 5 0 01-5-5V35a5 5 0 015-5z" fill="#FF9800"/><rect x="15" y="45" width="90" height="40" rx="4" fill="#FFB74D"/></svg>')}`,
  image: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 100"><rect width="120" height="100" rx="8" fill="#E8F5E9"/><rect x="15" y="15" width="90" height="70" rx="6" fill="#4CAF50" opacity="0.15"/><circle cx="40" cy="40" r="10" fill="#FF9800"/><path d="M15 75l25-20 15 12 20-15 30 23v8a6 6 0 01-6 6H21a6 6 0 01-6-6z" fill="#4CAF50" opacity="0.6"/></svg>')}`,
  video: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 100"><rect width="120" height="100" rx="8" fill="#E3F2FD"/><rect x="15" y="18" width="90" height="64" rx="6" fill="#2196F3" opacity="0.15"/><polygon points="50,35 50,65 75,50" fill="#2196F3" opacity="0.8"/></svg>')}`,
  file: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 100"><rect width="120" height="100" rx="8" fill="#F5F5F5"/><path d="M30 10h40l25 25v55a5 5 0 01-5 5H30a5 5 0 01-5-5V15a5 5 0 015-5z" fill="#9E9E9E" opacity="0.2"/><path d="M70 10v25h25" fill="#BDBDBD" opacity="0.3"/><path d="M70 10l25 25H70z" fill="#BDBDBD" opacity="0.4"/></svg>')}`,
};

function getDefaultCover(file: LanzouFileItem): string {
  if (isImage(file.mime_type)) return DEFAULT_COVERS.image;
  if (isVideo(file.mime_type)) return DEFAULT_COVERS.video;
  return DEFAULT_COVERS.file;
}

function handleImgError(e: Event, file: LanzouFileItem) {
  const img = e.target as HTMLImageElement;
  // 先尝试 direct_url，再用默认封面
  if (file.direct_url && img.src !== file.direct_url) {
    img.src = file.direct_url;
  } else {
    img.src = getDefaultCover(file);
  }
}

async function loadFiles() {
  loading.value = true;
  try {
    const res = await fetchLanzouList(page.value, pageSize, searchQuery.value);
    files.value = res.data || [];
    total.value = res.total || 0;
  } catch (e: any) {
    showToast(e.message || "加载失败", "error");
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    page.value = 1;
    loadFiles();
  }, 300);
}

function goPage(p: number) {
  page.value = p;
  loadFiles();
}

function triggerUpload() {
  fileInputRef.value?.click();
}

async function handleFileSelect(e: Event) {
  const input = e.target as HTMLInputElement;
  const selectedFiles = input.files;
  if (!selectedFiles || selectedFiles.length === 0) return;

  uploading.value = true;
  uploadPercent.value = 0;
  uploadStatus.value = t("lanzou.uploadPreparing");

  const totalFiles = selectedFiles.length;
  let completed = 0;
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < totalFiles; i++) {
    const file = selectedFiles[i];
    uploadStatus.value = t("lanzou.uploadingFile", { name: file.name, current: i + 1, total: totalFiles });
    uploadPercent.value = Math.round(((i) / totalFiles) * 100);

    try {
      // Generate cover for images
      let coverFile: File | null = null;
      if (file.type.startsWith("image/")) {
        coverFile = await generateCover(file);
      }
      await uploadLanzouFile(file, coverFile);
      successCount++;
    } catch (err: any) {
      failCount++;
      console.error("Upload failed:", file.name, err);
    }
    completed++;
    uploadPercent.value = Math.round((completed / totalFiles) * 100);
  }

  uploading.value = false;
  input.value = "";

  if (failCount === 0) {
    showToast(t("lanzou.uploadSuccess", { count: successCount }));
  } else {
    showToast(t("lanzou.uploadPartial", { success: successCount, fail: failCount }), "error");
  }

  loadFiles();
}

function generateCover(file: File): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX_WIDTH = 400;
      let w = img.width;
      let h = img.height;
      if (w > MAX_WIDTH) {
        h = Math.round((h * MAX_WIDTH) / w);
        w = MAX_WIDTH;
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (blob) {
            const stem = file.name.replace(/\.[^.]+$/, "");
            resolve(new File([blob], stem + "_thumb.jpg", { type: "image/jpeg" }));
          } else {
            resolve(null as any);
          }
        },
        "image/jpeg",
        0.8
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null as any);
    };
    img.src = url;
  });
}

function copyDirectLink(file: LanzouFileItem) {
  copyText(file.direct_url);
}

function copyText(text: string) {
  navigator.clipboard.writeText(text).then(
    () => showToast(t("lanzou.copied")),
    () => showToast(t("lanzou.copyFailed"), "error")
  );
}

function openPreview(file: LanzouFileItem) {
  previewFile.value = file;
  previewVisible.value = true;
}

function closePreview() {
  previewVisible.value = false;
  previewFile.value = null;
}

function confirmDelete(file: LanzouFileItem) {
  deleteFile.value = file;
  deleteVisible.value = true;
}

function cancelDelete() {
  deleteVisible.value = false;
  deleteFile.value = null;
}

async function doDelete() {
  if (!deleteFile.value || deleting.value) return;
  deleting.value = true;
  try {
    const res = await deleteLanzouFile(deleteFile.value.id) as any;
    const msg = res.lanzouDeleted ? t("lanzou.deleteSuccess") : (res.message || t("lanzou.deleteSuccess"));
    showToast(msg);
    deleteVisible.value = false;
    deleteFile.value = null;
    loadFiles();
  } catch (e: any) {
    showToast(e.message || "删除失败", "error");
  } finally {
    deleting.value = false;
  }
}

async function openSettings() {
  settingsVisible.value = true;
  try {
    const res = await fetchLanzouSettings();
    settingsCookie.value = res.cookie || "";
    settingsFolderId.value = res.folderId || "";
  } catch {
    // keep defaults
  }
}

function closeSettings() {
  settingsVisible.value = false;
}

async function saveSettings() {
  try {
    await saveLanzouSettings({
      cookie: settingsCookie.value,
      folderId: settingsFolderId.value,
    });
    showToast(t("lanzou.settingsSaved"));
    closeSettings();
  } catch (e: any) {
    showToast(e.message || "保存失败", "error");
  }
}

function openUrlUpload() {
  urlUploadInput.value = "";
  urlUploadVisible.value = true;
}

function closeUrlUpload() {
  urlUploadVisible.value = false;
}

async function doUrlUpload() {
  const url = urlUploadInput.value.trim();
  if (!url) return;
  urlUploading.value = true;
  urlElapsed.value = 0;
  urlTimerInterval = setInterval(() => { urlElapsed.value++; }, 1000);
  try {
    await uploadLanzouByUrl(url);
    showToast(t("lanzou.uploadSuccess", { count: 1 }));
    closeUrlUpload();
    loadFiles();
  } catch (e: any) {
    showToast(e.message || "上传失败", "error");
  } finally {
    urlUploading.value = false;
    if (urlTimerInterval) { clearInterval(urlTimerInterval); urlTimerInterval = null; }
  }
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

onMounted(() => {
  loadFiles();
});
</script>

<style lang="less" scoped>
.lanzou-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.lanzou-toolbar-left {
  flex: 1;
  min-width: 200px;
}

.lanzou-toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.lanzou-search {
  width: 100%;
  max-width: 320px;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s;
  &:focus {
    border-color: var(--primary-color);
  }
}

.lanzou-count {
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.lanzou-upload-progress {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.lanzou-progress-bar {
  height: 4px;
  background: var(--border-color);
  border-radius: 2px;
  overflow: hidden;
}

.lanzou-progress-fill {
  height: 100%;
  background: var(--primary-color);
  transition: width 0.3s;
  border-radius: 2px;
}

.lanzou-empty {
  text-align: center;
  padding: 40px 16px;
  color: var(--text-secondary);
}

.lanzou-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.lanzou-grid-item {
  background: var(--bg-card);
  border-radius: 10px;
  border: 1px solid var(--border-color);
  overflow: hidden;
  transition: box-shadow 0.2s, border-color 0.2s;
  position: relative;
  &:hover {
    border-color: var(--primary-color);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    .lanzou-grid-actions {
      opacity: 1;
    }
  }
}

.lanzou-grid-thumb {
  width: 100%;
  aspect-ratio: 16 / 10;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-page, #f5f5f5);
  overflow: hidden;
}

.lanzou-grid-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.lanzou-grid-icon {
  color: var(--text-secondary);
  opacity: 0.5;
}

.lanzou-grid-info {
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.lanzou-grid-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lanzou-grid-meta {
  font-size: 11px;
  color: var(--text-secondary);
}

.lanzou-grid-actions {
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.lanzou-action-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  background: var(--bg-card);
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  transition: color 0.2s, background 0.2s;
  &:hover {
    color: var(--primary-color);
    background: var(--bg-page, #f0f0f0);
  }
}

.lanzou-action-danger:hover {
  color: #e74c3c !important;
}

.lanzou-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 16px;
}

.lanzou-page-info {
  font-size: 13px;
  color: var(--text-secondary);
}

/* Preview Modal */
.lanzou-preview-modal {
  max-width: 600px;
}

.lanzou-preview-img {
  width: 100%;
  max-height: 400px;
  object-fit: contain;
  border-radius: 8px;
  background: var(--bg-page, #f5f5f5);
}

.lanzou-preview-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px;
  color: var(--text-secondary);
}

.lanzou-detail-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 13px;
  padding: 6px 0;
  border-bottom: 1px solid var(--border-color);
}

.lanzou-detail-label {
  flex: 0 0 80px;
  color: var(--text-secondary);
}

.lanzou-detail-value {
  flex: 1;
  color: var(--text-primary);
  word-break: break-all;
}

.lanzou-detail-link {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
}

.lanzou-detail-url {
  flex: 1;
  font-size: 12px;
  font-family: monospace;
}

.modal-btn.secondary {
  background: var(--bg-page, #f0f0f0);
  color: var(--text-primary);
}

.modal-btn.danger {
  background: #e74c3c;
  color: #fff;
}

.lanzou-settings-textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-input);
  border-radius: var(--radius-md);
  background: var(--bg-input);
  color: var(--text-primary);
  font-size: 12px;
  font-family: monospace;
  resize: vertical;
  outline: none;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
  &:focus {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px var(--primary-light);
  }
}

.lanzou-settings-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-input);
  border-radius: var(--radius-md);
  background: var(--bg-input);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
  &:focus {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px var(--primary-light);
  }
}

/* URL Upload Progress */
.lanzou-url-progress {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 16px 0;
}

.lanzou-url-progress-text {
  font-size: 14px;
  color: var(--text-secondary);
}

.lanzou-url-timer {
  font-size: 24px;
  font-weight: 700;
  font-family: monospace;
  color: var(--primary-color);
  letter-spacing: 0.05em;
}

.lanzou-progress-indeterminate {
  width: 100%;
  height: 4px;
  background: var(--border-color);
  border-radius: 2px;
  overflow: hidden;
  position: relative;

  .lanzou-progress-fill {
    position: absolute;
    top: 0;
    left: -40%;
    width: 40%;
    height: 100%;
    background: var(--primary-color);
    border-radius: 2px;
    animation: lanzou-indeterminate 1.5s ease-in-out infinite;
  }
}

@keyframes lanzou-indeterminate {
  0% { left: -40%; }
  100% { left: 100%; }
}
</style>
