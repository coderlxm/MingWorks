<script setup lang="ts">
import { onBeforeUnmount } from 'vue';
import type { JournalAsset } from '../../types';
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

const files = defineModel<File[]>({ required: true });
const previewUrls = new Map<File, string>();

function previewUrl(file: File): string {
  const existing = previewUrls.get(file);
  if (existing) return existing;
  const url = URL.createObjectURL(file);
  previewUrls.set(file, url);
  return url;
}

function removeLocal(file: File): void {
  const url = previewUrls.get(file);
  if (url) URL.revokeObjectURL(url);
  previewUrls.delete(file);
  files.value = files.value.filter(candidate => candidate !== file);
}

onBeforeUnmount(() => {
  previewUrls.forEach(url => URL.revokeObjectURL(url));
});
</script>

<template>
  <div class="media-preview-grid">
    <figure v-for="asset in props.existingAssets" :key="`asset-${asset.id}`" class="media-preview-grid__item">
      <video
        v-if="resolveJournalMediaType(asset) === 'video'"
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

    <figure v-for="file in files" :key="previewUrl(file)" class="media-preview-grid__item">
      <video v-if="file.type.startsWith('video/')" :src="previewUrl(file)" muted preload="metadata"></video>
      <img v-else :src="previewUrl(file)" :alt="file.name">
      <button
        class="media-preview-grid__remove"
        type="button"
        :disabled="props.disabled"
        :aria-label="`移除 ${file.name}`"
        @click="removeLocal(file)"
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

.media-preview-grid__remove:disabled {
  cursor: wait;
  opacity: 0.55;
}
</style>
