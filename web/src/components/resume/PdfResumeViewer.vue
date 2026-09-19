<script setup lang="ts">
import { computed, nextTick, onMounted, shallowRef, useTemplateRef } from 'vue';
import type { JournalResumePreviewPage, SiteContactItem } from '../../types';
import ResumePageImage from './ResumePageImage.vue';
import ResumeReaderControls from './ResumeReaderControls.vue';
import ResumeSpread from './ResumeSpread.vue';
import { useResumePages } from './useResumePages';

const props = defineProps<{
  pages: JournalResumePreviewPage[];
  contentUrl?: string;
  downloadUrl?: string;
  originalName?: string;
  updatedAt?: string;
  shareUrl?: string | null;
  contacts?: SiteContactItem[];
}>();

const reader = useTemplateRef<HTMLElement>('reader');
const zoomViewport = useTemplateRef<HTMLElement>('zoomViewport');
const enlargedPage = shallowRef<JournalResumePreviewPage | null>(null);
const { spreadIndex, visiblePages, ready, busy, error, canPrev, canNext, goToSpread, reportImageError } = useResumePages(props.pages);
const slotCount = props.pages.length === 1 ? 1 : 2;
const pageRatio = Math.max(...props.pages.map(page => page.width / page.height));
const firstPage = computed(() => visiblePages.value[0]!.pageNumber);
const lastPage = computed(() => visiblePages.value[visiblePages.value.length - 1]!.pageNumber);

async function turn(delta: number): Promise<void> {
  if (delta < 0 ? !canPrev.value : !canNext.value) return;
  const focusedElement = document.activeElement;
  await goToSpread(spreadIndex.value + delta);
  if (document.activeElement === focusedElement || document.activeElement === document.body) {
    reader.value?.focus({ preventScroll: true });
  }
}

async function enlarge(page: JournalResumePreviewPage): Promise<void> {
  enlargedPage.value = page;
  await nextTick();
  zoomViewport.value?.focus({ preventScroll: true });
}

async function restoreSpread(): Promise<void> {
  const pageNumber = enlargedPage.value!.pageNumber;
  enlargedPage.value = null;
  await nextTick();
  reader.value?.querySelector<HTMLElement>(`[data-resume-page="${pageNumber}"]`)?.focus({ preventScroll: true });
}

function closeEnlargedPage(): boolean {
  if (enlargedPage.value === null) return false;
  void restoreSpread();
  return true;
}

defineExpose({ closeEnlargedPage });

function handleKeydown(event: KeyboardEvent): void {
  if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  if (enlargedPage.value !== null) return;
  const target = event.target;
  if (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable="true"]')) return;
  if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
    event.preventDefault();
    void turn(-1);
  } else if (event.key === 'ArrowRight' || event.key === 'PageDown') {
    event.preventDefault();
    void turn(1);
  }
}

onMounted(() => reader.value?.focus({ preventScroll: true }));
</script>

<template>
  <section ref="reader" class="pdf-reader" aria-label="PDF 简历双页阅读器" tabindex="-1" @keydown="handleKeydown">
    <div class="pdf-reader__stage" :aria-busy="busy">
      <ResumeSpread
        v-if="ready"
        v-show="enlargedPage === null"
        :pages="visiblePages"
        :slot-count="slotCount"
        :page-ratio="pageRatio"
        :busy="busy"
        @enlarge="enlarge"
        @error="reportImageError"
      />
      <div
        v-if="enlargedPage"
        ref="zoomViewport"
        class="pdf-reader__zoom"
        role="region"
        :aria-label="`第 ${enlargedPage.pageNumber} 页放大阅读，可滚动查看`"
        tabindex="0"
      >
        <div class="pdf-reader__zoom-paper" :style="{ aspectRatio: `${enlargedPage.width} / ${enlargedPage.height}` }">
          <ResumePageImage :page="enlargedPage" @error="reportImageError" />
        </div>
      </div>
      <p v-if="busy" class="pdf-reader__notice" role="status">{{ ready ? '正在切换页组…' : '正在打开简历页面…' }}</p>
      <p v-if="error" class="pdf-reader__notice pdf-reader__notice--error" role="alert">{{ error }}</p>
    </div>

    <ResumeReaderControls
      :total-pages="pages.length"
      :first-page="firstPage"
      :last-page="lastPage"
      :can-prev="canPrev"
      :can-next="canNext"
      :busy="busy"
      :ready="ready"
      :enlarged-page="enlargedPage?.pageNumber ?? null"
      :content-url="contentUrl"
      :download-url="downloadUrl"
      :original-name="originalName"
      :updated-at="updatedAt"
      :share-url="shareUrl"
      :contacts="contacts"
      @prev="turn(-1)"
      @next="turn(1)"
      @restore="restoreSpread"
    />
  </section>
</template>

<style scoped>
.pdf-reader {
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  min-width: 0;
  min-height: 0;
  height: 100%;
  gap: 0.75rem;
}

.pdf-reader__stage {
  position: relative;
  min-width: 0;
  min-height: 0;
}

.pdf-reader__zoom {
  width: 100%;
  height: 100%;
  overflow: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
}

.pdf-reader__zoom-paper {
  width: clamp(52rem, 100%, 80rem);
  margin: 0 auto;
  background: var(--surface-card);
}

.pdf-reader__notice {
  position: absolute;
  top: 0.75rem;
  left: 50%;
  z-index: 1;
  width: max-content;
  max-width: min(90%, 36rem);
  max-height: calc(100% - 1.5rem);
  overflow: auto;
  margin: 0;
  padding: 0.6rem 0.9rem;
  transform: translateX(-50%);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: var(--surface-card);
  color: var(--text-muted);
  font-size: 0.85rem;
  overflow-wrap: anywhere;
}

.pdf-reader__notice--error { color: var(--danger); }

@media (max-width: 599px) {
  .pdf-reader { gap: 0.5rem; }
}
</style>
