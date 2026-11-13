<script setup lang="ts" name="DriveVideoPickerDialog">
import { computed, shallowRef } from 'vue';
import { ElDialog } from 'element-plus';
import 'element-plus/es/components/dialog/style/css';
import { fetchDriveVideoCatalog } from '../../api';
import type { JournalAsset, JournalDriveVideoCatalog, JournalDriveVideoItem, PendingPublisherMedia } from '../../types';
import { formatFileSize, formatMediaDuration } from '../../utils/formatters';
import { resolveJournalMediaType } from '../../utils/journalMedia';

const props = defineProps<{
  pendingMedia: readonly PendingPublisherMedia[];
  existingAssets: readonly JournalAsset[];
  disabled: boolean;
}>();
const visible = defineModel<boolean>({ required: true });
const emit = defineEmits<{ confirm: [videos: JournalDriveVideoItem[]] }>();
const catalog = shallowRef<JournalDriveVideoCatalog | null>(null);
const loading = shallowRef(false);
const error = shallowRef<string | null>(null);
const folder = shallowRef('all');
const keyword = shallowRef('');
const selected = shallowRef<JournalDriveVideoItem[]>([]);
const pendingIds = computed(() => new Set(props.pendingMedia
  .filter(item => item.kind === 'drive').map(item => item.video.driveFileId)));
const mediaCount = computed(() => props.existingAssets.length + props.pendingMedia.length);
const videoCount = computed(() => props.existingAssets.filter(asset => resolveJournalMediaType(asset) === 'video').length
  + props.pendingMedia.filter(item => item.kind === 'drive' || item.file.type.startsWith('video/')).length);
const remaining = computed(() => Math.max(0, Math.min(10 - mediaCount.value, 5 - videoCount.value)));
const selectionValid = computed(() => selected.value.length > 0 && selected.value.length <= remaining.value
  && selected.value.every(video => !pendingIds.value.has(video.driveFileId)));
const tabs = computed(() => [
  { id: 'all', name: '全部' },
  { id: 'root', name: '根目录' },
  ...(catalog.value?.folders ?? []),
]);
const videos = computed(() => {
  const query = keyword.value.trim().toLocaleLowerCase();
  return (catalog.value?.videos ?? []).filter(video =>
    (folder.value === 'all' || (folder.value === 'root' ? video.folderName === null : video.folderId === folder.value))
    && video.name.toLocaleLowerCase().includes(query));
});
const hasExistingDriveAssets = computed(() => props.existingAssets.some(asset => asset.sourceKind === 'drive'));

async function loadCatalog(refresh = false): Promise<void> {
  loading.value = true;
  error.value = null;
  selected.value = [];
  catalog.value = null;
  try {
    catalog.value = await fetchDriveVideoCatalog({ refresh });
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason);
  } finally {
    loading.value = false;
  }
}

function openDialog(): void {
  folder.value = 'all';
  keyword.value = '';
  void loadCatalog();
}

function isSelected(video: JournalDriveVideoItem): boolean {
  return selected.value.some(item => item.driveFileId === video.driveFileId);
}

function disabledReason(video: JournalDriveVideoItem): string | null {
  if (pendingIds.value.has(video.driveFileId)) return '已在待发队列';
  if (!isSelected(video) && selected.value.length >= remaining.value) return '已达媒体或视频上限';
  return null;
}

function toggle(video: JournalDriveVideoItem): void {
  if (props.disabled || loading.value || disabledReason(video)) return;
  selected.value = isSelected(video)
    ? selected.value.filter(item => item.driveFileId !== video.driveFileId)
    : [...selected.value, video];
}

function resolution(video: JournalDriveVideoItem): string | null {
  return video.width && video.height ? `${video.width} × ${video.height}` : null;
}

function confirmSelection(): void {
  if (props.disabled || loading.value || !selectionValid.value) return;
  emit('confirm', selected.value);
  visible.value = false;
}
</script>

<template>
  <ElDialog
    v-model="visible"
    class="drive-video-picker"
    title="从谷歌云盘选择视频"
    width="min(52rem, calc(100vw - 2rem))"
    top="6vh"
    append-to-body
    :close-on-click-modal="false"
    @open="openDialog"
  >
    <div class="drive-video-picker__body">
      <div class="drive-video-picker__toolbar">
        <input v-model="keyword" class="drive-video-picker__search" type="search" placeholder="按文件名搜索" aria-label="按文件名搜索视频">
        <button class="button button--quiet" type="button" :disabled="loading || props.disabled" @click="loadCatalog(true)">刷新云盘</button>
      </div>
      <nav class="drive-video-picker__tabs" aria-label="视频文件夹">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="drive-video-picker__tab"
          :class="{ 'drive-video-picker__tab--active': folder === tab.id }"
          type="button"
          :aria-pressed="folder === tab.id"
          @click="folder = tab.id"
        >{{ tab.name }}</button>
      </nav>
      <p class="drive-video-picker__quota">已有 {{ mediaCount }} / 10 项媒体、{{ videoCount }} / 5 段视频；本次还可选择 {{ remaining }} 段。按勾选顺序追加，云盘视频不占本地 500 MiB 额度。</p>
      <p v-if="hasExistingDriveAssets" class="drive-video-picker__notice">已有云盘附件暂不支持自动去重，请勿重复选择本条记录已有的视频。</p>
      <p v-if="error" class="drive-video-picker__error" role="alert">{{ error }}</p>
      <p v-else-if="loading" role="status">正在读取云盘目录…</p>
      <div v-else class="drive-video-picker__list" :aria-busy="loading">
        <label v-for="video in videos" :key="video.driveFileId" class="drive-video-picker__item" :class="{ 'drive-video-picker__item--disabled': !!disabledReason(video) }">
          <input
            type="checkbox"
            :checked="isSelected(video)"
            :disabled="props.disabled || !!disabledReason(video)"
            @change="toggle(video)"
          >
          <span class="drive-video-picker__info">
            <strong class="drive-video-picker__name">{{ video.name }}</strong>
            <span class="drive-video-picker__metadata">{{ [video.folderName ?? '根目录', formatFileSize(video.byteSize), resolution(video), formatMediaDuration(video.durationMillis === null ? null : video.durationMillis / 1000)].filter(Boolean).join(' · ') }}</span>
            <span class="drive-video-picker__tags">
              <span class="drive-video-picker__tag">已关联 {{ video.linkedEntryCount }} 条</span>
              <span v-if="disabledReason(video)">{{ disabledReason(video) }}</span>
            </span>
          </span>
        </label>
        <p v-if="videos.length === 0" class="drive-video-picker__empty">没有匹配的视频。</p>
      </div>
    </div>
    <template #footer>
      <div class="drive-video-picker__footer">
        <span>已选 {{ selected.length }} 段</span>
        <button class="button button--quiet" type="button" @click="visible = false">取消</button>
        <button class="button button--primary" type="button" :disabled="props.disabled || loading || !selectionValid" @click="confirmSelection">添加到队列</button>
      </div>
    </template>
  </ElDialog>
</template>

<style scoped>
:global(.drive-video-picker.el-dialog) {
  --el-dialog-bg-color: var(--surface-card);
  --el-text-color-primary: var(--text-primary);
  --el-text-color-regular: var(--text-muted);
  --el-color-primary: var(--accent-strong);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-card);
}

.drive-video-picker__body { display: grid; gap: 0.8rem; color: var(--text-primary); }
.drive-video-picker__toolbar, .drive-video-picker__footer { display: flex; align-items: center; gap: 0.6rem; }
.drive-video-picker__search { flex: 1; min-width: 0; padding: 0.65rem; border: 1px solid var(--border-strong); border-radius: 6px; background: var(--surface-page); color: var(--text-primary); }
.drive-video-picker__tabs { display: flex; gap: 0.4rem; overflow-x: auto; }
.drive-video-picker__tab { flex: none; padding: 0.5rem 0.7rem; border: 1px solid var(--border-subtle); border-radius: 6px; background: var(--surface-page); color: var(--text-muted); cursor: pointer; font: inherit; }
.drive-video-picker__tab--active { border-color: var(--border-strong); background: var(--surface-muted); color: var(--text-primary); }
.drive-video-picker__quota, .drive-video-picker__notice { margin: 0; color: var(--text-muted); font-size: 0.8rem; line-height: 1.6; }
.drive-video-picker__notice { padding: 0.6rem; background: var(--surface-muted); border-radius: 6px; }
.drive-video-picker__error { color: var(--danger); }
.drive-video-picker__list { max-height: 50dvh; overflow-y: auto; }
.drive-video-picker__item { display: flex; align-items: start; gap: 0.8rem; padding: 0.85rem 0.4rem; border-bottom: 1px solid var(--border-subtle); cursor: pointer; }
.drive-video-picker__item input { margin-top: 0.25rem; accent-color: var(--accent-strong); }
.drive-video-picker__item--disabled { opacity: 0.55; cursor: not-allowed; }
.drive-video-picker__info { display: grid; min-width: 0; gap: 0.35rem; }
.drive-video-picker__name { overflow-wrap: anywhere; }
.drive-video-picker__metadata, .drive-video-picker__tags { color: var(--text-muted); font-size: 0.78rem; }
.drive-video-picker__tags { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
.drive-video-picker__tag { padding: 0.15rem 0.4rem; border-radius: 4px; background: var(--surface-muted); }
.drive-video-picker__empty { color: var(--text-muted); text-align: center; }
.drive-video-picker__footer { flex-wrap: wrap; justify-content: end; color: var(--text-muted); }
.drive-video-picker__footer > span { margin-right: auto; }
</style>
