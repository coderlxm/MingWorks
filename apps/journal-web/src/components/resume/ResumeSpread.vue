<script setup lang="ts">
import { useResizeObserver } from '@vueuse/core';
import { computed, shallowRef, useTemplateRef } from 'vue';
import type { JournalResumePreviewPage } from '../../types';
import ResumePageImage from './ResumePageImage.vue';

const props = defineProps<{
  pages: JournalResumePreviewPage[];
  slotCount: number;
  pageRatio: number;
  busy: boolean;
}>();
const emit = defineEmits<{
  enlarge: [page: JournalResumePreviewPage];
  error: [pageNumber: number];
}>();
const stage = useTemplateRef<HTMLElement>('stage');
const size = shallowRef({ width: 0, height: 0 });
const spineWidth = 8;

useResizeObserver(stage, ([entry]) => {
  size.value = { width: entry!.contentRect.width, height: entry!.contentRect.height };
});

const bookStyle = computed(() => {
  const gap = props.slotCount === 2 ? spineWidth : 0;
  const height = Math.max(0, Math.min(
    size.value.height,
    (size.value.width - gap) / (props.slotCount * props.pageRatio),
  ));
  return {
    width: `${height * props.pageRatio * props.slotCount + gap}px`,
    height: `${height}px`,
    gridTemplateColumns: `repeat(${props.slotCount}, minmax(0, 1fr))`,
  };
});
</script>

<template>
  <div ref="stage" class="resume-spread">
    <div
      :key="pages[0]?.pageNumber"
      class="resume-spread__book"
      :class="{ 'resume-spread__book--double': slotCount === 2 }"
      :style="bookStyle"
    >
      <button
        v-for="page in pages"
        :key="page.pageNumber"
        class="resume-spread__page"
        :data-resume-page="page.pageNumber"
        type="button"
        :disabled="busy"
        :aria-label="`放大简历第 ${page.pageNumber} 页`"
        :title="`点击放大第 ${page.pageNumber} 页`"
        @click="emit('enlarge', page)"
      >
        <ResumePageImage :page="page" @error="emit('error', $event)" />
      </button>
      <div v-if="pages.length < slotCount" class="resume-spread__empty" aria-hidden="true" />
    </div>
  </div>
</template>

<style scoped>
.resume-spread {
  display: grid;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  place-items: center;
  perspective: 1800px;
}

.resume-spread__book {
  position: relative;
  display: grid;
  gap: 8px;
  border-radius: 5px;
  box-shadow: 0 8px 28px rgb(0 0 0 / 10%);
  animation: resume-spread-open 240ms ease-out;
}

.resume-spread__book--double::after {
  position: absolute;
  top: 0;
  bottom: 0;
  left: calc(50% - 4px);
  width: 8px;
  background: linear-gradient(90deg, transparent, var(--border-strong), transparent);
  content: '';
  pointer-events: none;
}

.resume-spread__page {
  display: block;
  min-width: 0;
  min-height: 0;
  padding: 0;
  border: 0;
  border-radius: 3px;
  background: var(--surface-card);
  cursor: zoom-in;
  overflow: hidden;
  box-shadow: 0 0 0 1px var(--border-subtle);
}

.resume-spread__page:disabled {
  cursor: progress;
}

.resume-spread__empty {
  min-width: 0;
}

@keyframes resume-spread-open {
  from { opacity: 0.7; transform: rotateX(3deg) scale(0.992); }
  to { opacity: 1; transform: none; }
}

@media (prefers-reduced-motion: reduce) {
  .resume-spread__book { animation: none; }
}
</style>
