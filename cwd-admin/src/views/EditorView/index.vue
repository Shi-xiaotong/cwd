<template>
  <div class="editor-page">
    <!-- Top bar: metadata -->
    <div class="editor-meta">
      <div class="meta-row">
        <div class="meta-field">
          <label>标题</label>
          <input v-model="form.title" type="text" placeholder="文章标题" maxlength="64" />
          <span class="char-count" :class="{ warn: titleBytes > 60 }">{{ titleBytes }}/64 bytes</span>
        </div>
        <div class="meta-field">
          <label>Slug</label>
          <input v-model="form.slug" type="text" placeholder="article-url-slug" />
        </div>
      </div>
      <div class="meta-row">
        <div class="meta-field">
          <label>分类</label>
          <select v-model="form.category">
            <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
          </select>
        </div>
        <div class="meta-field flex-2">
          <label>摘要 (公众号)</label>
          <input v-model="form.digest" type="text" placeholder="最多120字" maxlength="120" />
        </div>
      </div>
    </div>

    <!-- Editor: two-pane -->
    <div class="editor-body">
      <!-- Left: Markdown editor -->
      <div class="editor-pane">
        <div class="pane-header">
          <span>Markdown</span>
          <div class="pane-actions">
            <button class="btn-sm" @click="insertImagePlaceholder" title="插入图片占位符">🖼 图片</button>
            <button class="btn-sm" @click="insertBold" title="粗体">B</button>
            <button class="btn-sm" @click="insertHeading" title="标题">H</button>
          </div>
        </div>
        <div
          class="editor-dropzone"
          :class="{ dragover: isDragging }"
          @dragover.prevent="isDragging = true"
          @dragleave="isDragging = false"
          @drop.prevent="handleDrop"
        >
          <textarea
            ref="textareaRef"
            v-model="form.content"
            class="editor-textarea"
            placeholder="在这里写 Markdown...

拖拽图片到此处上传
![img](IMG_1) 是图片占位符"
            @scroll="syncScroll"
            @keydown.tab.prevent="insertTab"
          ></textarea>
        </div>
      </div>

      <!-- Right: Preview -->
      <div class="preview-pane">
        <div class="pane-header">
          <span>预览</span>
          <span class="image-count">已上传 {{ uploadedImages.length }} 张图片</span>
        </div>
        <div class="preview-content" ref="previewRef" v-html="previewHtml"></div>
      </div>
    </div>

    <!-- Image upload area -->
    <div class="editor-images" v-if="uploadedImages.length > 0">
      <div class="images-label">已上传图片 (点击插入):</div>
      <div class="images-list">
        <div
          v-for="(img, index) in uploadedImages"
          :key="index"
          class="image-thumb"
          @click="insertImageRef(index + 1)"
          :title="`点击插入 IMG_${index + 1}`"
        >
          <img :src="img.url" :alt="`IMG_${index + 1}`" />
          <span class="image-label">IMG_{{ index + 1 }}</span>
        </div>
      </div>
    </div>

    <!-- Bottom bar: actions -->
    <div class="editor-actions">
      <div class="actions-left">
        <label class="checkbox-label">
          <input type="checkbox" v-model="form.createWechatDraft" />
          同时创建公众号草稿
        </label>
      </div>
      <div class="actions-right">
        <span v-if="publishStatus" :class="['status', publishStatus.type]">
          {{ publishStatus.message }}
        </span>
        <button class="btn-secondary" @click="handleDryRun" :disabled="publishing">
          预览 HTML
        </button>
        <button class="btn-primary" @click="handlePublish" :disabled="publishing || !canPublish">
          {{ publishing ? '发布中...' : '发布文章' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { uploadR2File, editorPublish, uploadWechatImage, uploadWechatThumb } from '../../api/admin';

const categories = ['tech', 'history', 'anime', 'science', 'games', 'recommendations', 'life'];

const form = ref({
  title: '',
  slug: '',
  category: 'tech',
  content: '',
  digest: '',
  createWechatDraft: false,
});

const uploadedImages = ref<{ url: string; name: string }[]>([]);
const publishing = ref(false);
const isDragging = ref(false);
const publishStatus = ref<{ type: string; message: string } | null>(null);
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const previewRef = ref<HTMLDivElement | null>(null);

// Computed
const titleBytes = computed(() => new TextEncoder().encode(form.value.title).length);

const canPublish = computed(() => {
  return form.value.title && form.value.slug && form.value.category && form.value.content;
});

// Basic Markdown → HTML preview (client-side)
const previewHtml = computed(() => {
  let md = form.value.content;

  // Replace image placeholders with uploaded URLs
  uploadedImages.value.forEach((img, i) => {
    md = md.replace(new RegExp(`!\\[img\\]\\(IMG_${i + 1}\\)`, 'g'),
      `<img src="${img.url}" style="max-width:100%;border-radius:8px;margin:10px 0;" />`);
  });

  // Remaining markdown images
  md = md.replace(/!\[img\]\(([^)]+)\)/g,
    `<img src="$1" style="max-width:100%;border-radius:8px;margin:10px 0;" />`);

  // Headers
  md = md.replace(/^### (.+)$/gm, '<h3 style="margin:12px 0 8px;font-size:16px;font-weight:bold;">$1</h3>');
  md = md.replace(/^## (.+)$/gm, '<h2 style="margin:16px 0 10px;font-size:18px;font-weight:bold;color:#1a73e8;">$1</h2>');
  md = md.replace(/^# (.+)$/gm, '<h1 style="margin:20px 0 12px;font-size:22px;font-weight:bold;color:#1a73e8;text-align:center;">$1</h1>');

  // Bold, italic, code
  md = md.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  md = md.replace(/\*(.+?)\*/g, '<em>$1</em>');
  md = md.replace(/`([^`]+)`/g, '<code style="background:#f5f5f5;padding:2px 6px;border-radius:4px;font-size:13px;">$1</code>');

  // Blockquotes
  md = md.replace(/^> (.+)$/gm,
    '<blockquote style="margin:8px 0;padding:10px 14px;background:#f0f7ff;border-left:3px solid #1a73e8;border-radius:0 6px 6px 0;">$1</blockquote>');

  // HR
  md = md.replace(/^---$/gm, '<hr style="margin:16px 0;border:none;border-top:1px solid #e0e0e0;" />');

  // Lists
  md = md.replace(/^- (.+)$/gm, '<li style="margin:2px 0;">$1</li>');
  md = md.replace(/((?:<li[^>]*>.*?<\/li>\n?)+)/g, '<ul style="margin:8px 0;padding-left:20px;">$1</ul>');

  // Paragraphs
  md = md.split('\n').map(line => {
    const t = line.trim();
    if (!t) return '';
    if (t.startsWith('<')) return line;
    return `<p style="margin:0 0 10px;">${t}</p>`;
  }).join('\n');

  return md;
});

// Methods
function insertTab() {
  const ta = textareaRef.value;
  if (!ta) return;
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  form.value.content = form.value.content.substring(0, start) + '  ' + form.value.content.substring(end);
  nextTick(() => {
    ta.selectionStart = ta.selectionEnd = start + 2;
  });
}

function insertImagePlaceholder() {
  const count = uploadedImages.value.length + 1;
  insertAtCursor(`\n\n![img](IMG_${count})\n\n`);
}

function insertImageRef(n: number) {
  insertAtCursor(`![img](IMG_${n})`);
}

function insertBold() {
  insertAtCursor('**粗体文字**');
}

function insertHeading() {
  insertAtCursor('\n## 标题\n');
}

function insertAtCursor(text: string) {
  const ta = textareaRef.value;
  if (!ta) return;
  const start = ta.selectionStart;
  form.value.content = form.value.content.substring(0, start) + text + form.value.content.substring(ta.selectionEnd);
  nextTick(() => {
    ta.focus();
    ta.selectionStart = ta.selectionEnd = start + text.length;
  });
}

function syncScroll() {
  // Simple sync: proportional scroll
  const ta = textareaRef.value;
  const preview = previewRef.value;
  if (!ta || !preview) return;
  const ratio = ta.scrollTop / (ta.scrollHeight - ta.clientHeight);
  preview.scrollTop = ratio * (preview.scrollHeight - preview.clientHeight);
}

async function handleDrop(e: DragEvent) {
  isDragging.value = false;
  const files = e.dataTransfer?.files;
  if (!files) return;
  for (const file of Array.from(files)) {
    if (!file.type.startsWith('image/')) continue;
    await uploadImage(file);
  }
}

async function uploadImage(file: File) {
  publishStatus.value = { type: 'info', message: `上传中: ${file.name}...` };
  try {
    const result = await uploadR2File(file, 'myblog', form.value.slug || 'editor');
    uploadedImages.value.push({ url: result.originalUrl, name: file.name });
    publishStatus.value = { type: 'success', message: `上传成功: ${file.name}` };
  } catch (e: any) {
    publishStatus.value = { type: 'error', message: `上传失败: ${e.message}` };
  }
}

function handleDryRun() {
  // Just show the HTML in a new window
  const html = previewHtml.value;
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>预览</title>
      <style>body{max-width:680px;margin:20px auto;font-family:-apple-system,sans-serif;font-size:15px;line-height:1.8;color:#333;padding:0 16px;}
      img{max-width:100%;border-radius:8px;}h1,h2,h3{color:#1a73e8;}</style></head>
      <body>${html}</body></html>`);
  }
}

async function handlePublish() {
  if (!canPublish.value || publishing.value) return;
  publishing.value = true;
  publishStatus.value = { type: 'info', message: '发布中...' };

  try {
    // Replace image placeholders with R2 URLs
    let content = form.value.content;
    uploadedImages.value.forEach((img, i) => {
      content = content.replace(new RegExp(`!\\[img\\]\\(IMG_${i + 1}\\)`, 'g'), `![img](${img.url})`);
    });

    // Upload images to WeChat if needed
    let wechatImageUrls: string[] = [];
    let thumbMediaId = '';

    if (form.value.createWechatDraft) {
      publishStatus.value = { type: 'info', message: '上传图片到微信...' };
      for (const img of uploadedImages.value) {
        // Upload from URL
        const wxUrl = await uploadWechatImage(img.url);
        wechatImageUrls.push(wxUrl);
      }
      if (uploadedImages.value.length > 0) {
        thumbMediaId = await uploadWechatThumb(uploadedImages.value[0].url);
      }
    }

    const result = await editorPublish({
      title: form.value.title,
      slug: form.value.slug,
      category: form.value.category,
      content,
      digest: form.value.digest,
      coverUrl: uploadedImages.value[0]?.url,
      createWechatDraft: form.value.createWechatDraft,
      wechatImageUrls,
      thumbMediaId,
    });

    publishStatus.value = { type: 'success', message: `✅ ${result.message}` };
    if (result.blog?.url) {
      publishStatus.value.message += ` | ${result.blog.url}`;
    }
    if (result.wechat?.success) {
      publishStatus.value.message += ` | 公众号草稿已创建`;
    }
  } catch (e: any) {
    publishStatus.value = { type: 'error', message: `❌ ${e.message}` };
  } finally {
    publishing.value = false;
  }
}
</script>

<style scoped>
.editor-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 60px);
  gap: 0;
  overflow: hidden;
}

.editor-meta {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color, #e0e0e0);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.meta-row {
  display: flex;
  gap: 12px;
}

.meta-field {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.meta-field label {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  min-width: 40px;
  color: var(--text-secondary, #666);
}

.meta-field input,
.meta-field select {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid var(--border-color, #d0d0d0);
  border-radius: 6px;
  font-size: 14px;
  background: var(--bg-primary, #fff);
  color: var(--text-primary, #333);
}

.meta-field input:focus,
.meta-field select:focus {
  outline: none;
  border-color: #1a73e8;
  box-shadow: 0 0 0 2px rgba(26, 115, 232, 0.15);
}

.flex-2 { flex: 2; }

.char-count {
  font-size: 11px;
  color: #999;
  min-width: 50px;
  text-align: right;
}
.char-count.warn { color: #e53935; }

.editor-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.editor-pane,
.preview-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.editor-pane {
  border-right: 1px solid var(--border-color, #e0e0e0);
}

.pane-header {
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary, #888);
  border-bottom: 1px solid var(--border-color, #e0e0e0);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--bg-secondary, #fafafa);
}

.pane-actions {
  display: flex;
  gap: 4px;
}

.btn-sm {
  padding: 2px 8px;
  border: 1px solid var(--border-color, #d0d0d0);
  border-radius: 4px;
  background: var(--bg-primary, #fff);
  cursor: pointer;
  font-size: 12px;
  color: var(--text-primary, #333);
}
.btn-sm:hover {
  background: var(--bg-hover, #f0f0f0);
}

.editor-dropzone {
  flex: 1;
  position: relative;
}

.editor-dropzone.dragover::after {
  content: '松开上传图片';
  position: absolute;
  inset: 0;
  background: rgba(26, 115, 232, 0.1);
  border: 2px dashed #1a73e8;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: #1a73e8;
  z-index: 10;
  pointer-events: none;
}

.editor-textarea {
  width: 100%;
  height: 100%;
  border: none;
  padding: 12px 16px;
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.6;
  resize: none;
  background: var(--bg-primary, #fff);
  color: var(--text-primary, #333);
  tab-size: 2;
}

.editor-textarea:focus {
  outline: none;
}

.preview-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
  font-size: 15px;
  line-height: 1.8;
  color: var(--text-primary, #333);
}

.image-count {
  font-weight: 400;
  color: var(--text-secondary, #999);
}

.editor-images {
  padding: 8px 16px;
  border-top: 1px solid var(--border-color, #e0e0e0);
  display: flex;
  align-items: center;
  gap: 12px;
  overflow-x: auto;
  background: var(--bg-secondary, #fafafa);
}

.images-label {
  font-size: 12px;
  color: var(--text-secondary, #888);
  white-space: nowrap;
}

.images-list {
  display: flex;
  gap: 8px;
}

.image-thumb {
  position: relative;
  width: 60px;
  height: 60px;
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  border: 2px solid transparent;
  transition: border-color 0.2s;
}

.image-thumb:hover {
  border-color: #1a73e8;
}

.image-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-label {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0,0,0,0.6);
  color: #fff;
  font-size: 9px;
  text-align: center;
  padding: 1px;
}

.editor-actions {
  padding: 10px 16px;
  border-top: 1px solid var(--border-color, #e0e0e0);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--bg-secondary, #fafafa);
}

.actions-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.actions-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  cursor: pointer;
  color: var(--text-primary, #333);
}

.status {
  font-size: 13px;
  max-width: 400px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.status.info { color: #1a73e8; }
.status.success { color: #34a853; }
.status.error { color: #e53935; }

.btn-primary,
.btn-secondary {
  padding: 8px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #1a73e8;
  color: #fff;
  border: none;
}
.btn-primary:hover { background: #1557b0; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-secondary {
  background: transparent;
  color: #1a73e8;
  border: 1px solid #1a73e8;
}
.btn-secondary:hover { background: rgba(26,115,232,0.05); }
.btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
