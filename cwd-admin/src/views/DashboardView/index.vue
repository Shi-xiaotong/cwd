<template>
  <div class="page">
    <h2 class="page-title">仪表盘</h2>
    <div
      v-if="toastVisible"
      class="toast"
      :class="toastType === 'error' ? 'toast-error' : 'toast-success'"
    >
      {{ toastMessage }}
    </div>

    <!-- Stat Cards -->
    <div v-if="loading" class="page-hint">加载中...</div>
    <div v-else-if="error" class="page-error">{{ error }}</div>
    <template v-else>
      <div class="stats-grid">
        <div class="stats-card">
          <div class="stats-card-icon stats-card-icon-blue">
            <PhArticle :size="22" />
          </div>
          <div class="stats-card-info">
            <div class="stats-card-value">{{ dashboard.articleCount }}</div>
            <div class="stats-card-label">文章数</div>
          </div>
        </div>
        <div class="stats-card">
          <div class="stats-card-icon stats-card-icon-green">
            <PhChatCircleDots :size="22" />
          </div>
          <div class="stats-card-info">
            <div class="stats-card-value">{{ dashboard.commentCount }}</div>
            <div class="stats-card-label">评论数</div>
          </div>
        </div>
        <div class="stats-card">
          <div class="stats-card-icon stats-card-icon-orange">
            <PhEye :size="22" />
          </div>
          <div class="stats-card-info">
            <div class="stats-card-value">{{ dashboard.todayPv }}</div>
            <div class="stats-card-label">今日PV</div>
          </div>
        </div>
        <div class="stats-card">
          <div class="stats-card-icon stats-card-icon-purple">
            <PhTrendUp :size="22" />
          </div>
          <div class="stats-card-info">
            <div class="stats-card-value">{{ dashboard.monthPv }}</div>
            <div class="stats-card-label">本月PV</div>
          </div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="quick-actions">
        <button class="quick-action-btn" @click="goEditor">
          <PhPencilSimple :size="16" />
          写文章
        </button>
        <button class="quick-action-btn" @click="goArticles">
          <PhArticle :size="16" />
          文章管理
        </button>
        <button class="quick-action-btn" @click="goComments">
          <PhChatCircleDots :size="16" />
          评论管理
        </button>
      </div>

      <!-- 7-Day Trend Chart -->
      <div class="card">
        <div class="card-title-row">
          <h3 class="card-title">7天访问趋势</h3>
        </div>
        <div class="trend-chart">
          <div class="trend-chart-bars">
            <div
              v-for="(item, index) in trendData"
              :key="index"
              class="trend-chart-col"
            >
              <div class="trend-chart-value">{{ item.pv }}</div>
              <div
                class="trend-chart-bar"
                :style="{ height: getBarHeight(item.pv) + '%' }"
              ></div>
              <div class="trend-chart-label">{{ item.date.slice(5) }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Comments -->
      <div class="card">
        <div class="card-title-row">
          <h3 class="card-title">最近评论</h3>
          <button class="card-button secondary" @click="goComments" style="min-width: auto; padding: 6px 14px;">
            查看全部
          </button>
        </div>
        <div v-if="dashboard.recentComments.length === 0" class="page-hint">
          暂无评论
        </div>
        <div v-else class="recent-comments">
          <div
            v-for="comment in dashboard.recentComments"
            :key="comment.id"
            class="recent-comment-item"
          >
            <div class="recent-comment-header">
              <span class="recent-comment-name">{{ comment.name }}</span>
              <span class="recent-comment-time">{{ formatDate(comment.created) }}</span>
            </div>
            <div class="recent-comment-content">{{ comment.contentText }}</div>
            <div class="recent-comment-post">
              <span class="recent-comment-post-label">文章：</span>
              {{ comment.postSlug }}
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  getDashboard,
  type DashboardResponse,
  type CommentItem,
} from '../../api/admin';

const router = useRouter();

const loading = ref(false);
const error = ref('');
const dashboard = ref<DashboardResponse>({
  articleCount: 0,
  commentCount: 0,
  todayPv: 0,
  monthPv: 0,
  trend: [],
  recentComments: [],
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

const trendData = ref<{ date: string; pv: number }[]>([]);

function getBarHeight(pv: number): number {
  const max = Math.max(...trendData.value.map((d) => d.pv), 1);
  return (pv / max) * 100;
}

function formatDate(value: number): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

async function loadDashboard() {
  loading.value = true;
  error.value = '';
  try {
    const res = await getDashboard();
    dashboard.value = {
      articleCount: res.articleCount ?? 0,
      commentCount: res.commentCount ?? 0,
      todayPv: res.todayPv ?? 0,
      monthPv: res.monthPv ?? 0,
      trend: Array.isArray(res.trend) ? res.trend : [],
      recentComments: Array.isArray(res.recentComments) ? res.recentComments : [],
    };
    trendData.value = dashboard.value.trend;
  } catch (e: any) {
    error.value = e.message || '加载仪表盘数据失败';
    showToast(error.value, 'error');
  } finally {
    loading.value = false;
  }
}

function goEditor() {
  router.push({ name: 'editor' });
}

function goArticles() {
  router.push({ name: 'articles' });
}

function goComments() {
  router.push({ name: 'comments' });
}

onMounted(() => {
  loadDashboard();
});
</script>

<style scoped lang="less">
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.stats-card {
  background-color: var(--bg-card);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: var(--shadow-xs);
  transition: box-shadow var(--transition-base);
}

.stats-card:hover {
  box-shadow: var(--shadow-sm);
}

.stats-card-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stats-card-icon-blue {
  background-color: rgba(59, 130, 246, 0.1);
  color: var(--primary-color);
}

.stats-card-icon-green {
  background-color: rgba(16, 185, 129, 0.1);
  color: var(--color-success);
}

.stats-card-icon-orange {
  background-color: rgba(245, 158, 11, 0.1);
  color: var(--color-warning);
}

.stats-card-icon-purple {
  background-color: rgba(139, 92, 246, 0.1);
  color: #8b5cf6;
}

.stats-card-info {
  flex: 1;
  min-width: 0;
}

.stats-card-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
}

.stats-card-label {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 4px;
}

.quick-actions {
  display: flex;
  gap: 12px;
}

.quick-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  background-color: var(--bg-card);
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  box-shadow: var(--shadow-xs);

  &:hover {
    background-color: var(--bg-hover);
    border-color: var(--primary-color);
    color: var(--primary-color);
    box-shadow: var(--shadow-sm);
  }
}

.trend-chart {
  width: 100%;
  height: 200px;
  padding-top: 20px;
}

.trend-chart-bars {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  height: 100%;
  padding-bottom: 30px;
  position: relative;
}

.trend-chart-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  position: relative;
  justify-content: flex-end;
}

.trend-chart-value {
  font-size: 11px;
  color: var(--text-secondary);
  margin-bottom: 4px;
  font-weight: 500;
}

.trend-chart-bar {
  width: 100%;
  max-width: 48px;
  background: linear-gradient(to top, var(--primary-color), rgba(59, 130, 246, 0.6));
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
  min-height: 4px;
  transition: height var(--transition-base);
}

.trend-chart-label {
  font-size: 11px;
  color: var(--text-tertiary);
  margin-top: 8px;
  position: absolute;
  bottom: -24px;
}

.recent-comments {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.recent-comment-item {
  padding: 12px 14px;
  border-radius: var(--radius-md);
  background-color: var(--bg-body);
  border: 1px solid var(--border-color);
}

.recent-comment-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.recent-comment-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.recent-comment-time {
  font-size: 12px;
  color: var(--text-tertiary);
}

.recent-comment-content {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-bottom: 6px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.recent-comment-post {
  font-size: 12px;
  color: var(--text-tertiary);
}

.recent-comment-post-label {
  font-weight: 500;
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .stats-card {
    padding: 14px;
    gap: 12px;
  }

  .stats-card-icon {
    width: 40px;
    height: 40px;
  }

  .stats-card-value {
    font-size: 20px;
  }

  .quick-actions {
    flex-wrap: wrap;
    gap: 8px;
  }

  .quick-action-btn {
    padding: 8px 14px;
    font-size: 13px;
  }

  .trend-chart {
    height: 160px;
  }
}
</style>
