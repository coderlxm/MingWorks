<script setup lang="ts">
import { onBeforeUnmount, onUpdated } from 'vue';
import type { JournalAsset, PendingPublisherMedia } from '../../types';
import { formatMediaDuration } from '../../utils/formatters';
import {
  isJournalAnimatedImage,
  resolveJournalMediaType,
} from '../../utils/journalMedia';

const props = defineProps<{
  existingAssets: readonly JournalAsset[];
  disabled: boolean;
}>();

const emit = defineEmits<{
  removeExisting: [assetId: number];
}>();

const files = defineModel<PendingPublisherMedia[]>({ required: true });
const previewUrls = new Map<File, string>();

function previewUrl(file: File): string {
  const existing = previewUrls.get(file);
  if (existing) return existing;
  const url = URL.createObjectURL(file);
  previewUrls.set(file, url);
  return url;
}

function cleanupPreviews(): void {
  const localFiles = new Set(files.value.filter(item => item.kind === 'local').map(item => item.file));
  for (const [file, url] of previewUrls) {
    if (localFiles.has(file)) continue;
    URL.revokeObjectURL(url);
    previewUrls.delete(file);
  }
}

function removePending(id: string): void {
  if (props.disabled) return;
  files.value = files.value.filter(item => item.id !== id);
  cleanupPreviews();
}

onUpdated(cleanupPreviews);
onBeforeUnmount(() => {
  previewUrls.forEach(url => URL.revokeObjectURL(url));
});
</script>

<template>
  <div class="media-preview-grid">
    <figure v-for="asset in props.existingAssets" :key="`asset-${asset.id}`" class="media-preview-grid__item">
      <img
        v-if="asset.sourceKind === 'drive'"
        :src="asset.previewUrl!"
        :alt="asset.originalName ?? '云盘视频'"
      >
      <video
        v-else-if="resolveJournalMediaType(asset) === 'video'"
        :src="asset.url"
        :poster="asset.previewUrl ?? undefined"
        muted
        preload="metadata"
      />
      <img
        v-else
        :src="isJournalAnimatedImage(asset) ? asset.url : (asset.previewUrl ?? asset.url)"
        :alt="asset.originalName ?? '草稿图片'"
      >
      <span v-if="resolveJournalMediaType(asset) === 'video'" class="media-preview-grid__badge">▶ {{ formatMediaDuration(asset.duration) }}</span>
      <button
        class="media-preview-grid__remove"
        type="button"
        :disabled="props.disabled"
        :aria-label="`移除 ${asset.originalName ?? '图片'}`"
        @click="emit('removeExisting', asset.id)"
      >
        ×
      </button>
    </figure>

    <figure v-for="item in files" :key="item.id" class="media-preview-grid__item" :class="{ 'media-preview-grid__item--drive': item.kind === 'drive' }">
      <div v-if="item.kind === 'drive'" class="media-preview-grid__drive" :title="item.video.name">
        <span aria-hidden="true">▶</span>
        <strong>{{ item.video.name }}</strong>
        <small v-if="item.video.width && item.video.height">{{ item.video.width }} × {{ item.video.height }}</small>
        <small>{{ formatMediaDuration(item.video.durationMillis === null ? null : item.video.durationMillis / 1000) }}</small>
      </div>
      <template v-else>
        <video v-if="item.file.type.startsWith('video/')" :src="previewUrl(item.file)" muted preload="metadata"></video>
        <img v-else :src="previewUrl(item.file)" :alt="item.file.name">
      </template>
      <button
        class="media-preview-grid__remove"
        type="button"
        :disabled="props.disabled"
        :aria-label="`移除 ${item.kind === 'drive' ? item.video.name : item.file.name}`"
        @click="removePending(item.id)"
      >
        ×
      </button>
    </figure>
  </div>
</template>

<style scoped>
.media-preview-grid {
  display: flex;
  flex: none;
  gap: 0.5rem;
}

.media-preview-grid__item {
  position: relative;
  flex: none;
  width: 5.5rem;
  height: 5.5rem;
  margin: 0;
}

.media-preview-grid__item img,
.media-preview-grid__item video {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: var(--radius-media);
  background: var(--surface-muted);
  object-fit: cover;
}

.media-preview-grid__remove {
  position: absolute;
  top: 0.3rem;
  right: 0.3rem;
  display: grid;
  width: 1.35rem;
  height: 1.35rem;
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: rgb(0 0 0 / 0.6);
  color: #fff;
  cursor: pointer;
  font: inherit;
  font-size: 0.95rem;
  line-height: 1;
}

.media-preview-grid__badge {
  position: absolute;
  right: 0.25rem;
  bottom: 0.25rem;
  padding: 0.15rem 0.3rem;
  border-radius: 4px;
  background: rgb(0 0 0 / 55%);
  color: #fff;
  font-size: 0.65rem;
  backdrop-filter: blur(4px);
}

.media-preview-grid__item--drive { width: 8rem; }
.media-preview-grid__drive {
  display: grid;
  height: 100%;
  align-content: center;
  gap: 0.15rem;
  padding: 0.5rem 1.7rem 0.5rem 0.6rem;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-media);
  background: var(--surface-muted);
  color: var(--text-primary);
  font-size: 0.7rem;
}
.media-preview-grid__drive strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.media-preview-grid__drive small { color: var(--text-muted); font-size: 0.65rem; }

.media-preview-grid__remove:disabled {
  cursor: wait;
  opacity: 0.55;
}
</style>
