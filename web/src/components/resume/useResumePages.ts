import { computed, onMounted, onUnmounted, shallowRef } from 'vue';
import type { JournalResumePreviewPage } from '../../types';

export function useResumePages(pages: JournalResumePreviewPage[]) {
  const spreadIndex = shallowRef(0);
  const ready = shallowRef(false);
  const busy = shallowRef(false);
  const error = shallowRef<string | null>(null);
  const decodedPages = new Map<number, Promise<void>>();
  let disposed = false;

  const spreadCount = Math.ceil(pages.length / 2);
  const visiblePages = computed(() => pages.slice(spreadIndex.value * 2, spreadIndex.value * 2 + 2));
  const canPrev = computed(() => ready.value && !busy.value && spreadIndex.value > 0);
  const canNext = computed(() => ready.value && !busy.value && spreadIndex.value + 1 < spreadCount);

  function decodePage(page: JournalResumePreviewPage): Promise<void> {
    if (!decodedPages.has(page.pageNumber)) {
      const images = [page.lightUrl, page.darkUrl].map(url => {
        const image = new Image();
        image.src = url;
        return image.decode();
      });
      decodedPages.set(page.pageNumber, Promise.all(images).then(() => undefined));
    }
    return decodedPages.get(page.pageNumber)!;
  }

  async function goToSpread(index: number): Promise<void> {
    if (busy.value || index < 0 || index >= spreadCount) return;
    if (ready.value && index === spreadIndex.value) return;
    busy.value = true;
    error.value = null;
    const target = pages.slice(index * 2, index * 2 + 2);
    try {
      await Promise.all(target.map(decodePage));
      if (disposed) return;
      spreadIndex.value = index;
      ready.value = true;
    } catch (reason) {
      if (disposed) return;
      const message = reason instanceof Error ? reason.message : String(reason);
      error.value = `第 ${target.map(page => page.pageNumber).join('、')} 页预览加载失败：${message}`;
    } finally {
      if (!disposed) busy.value = false;
    }
  }

  function reportImageError(pageNumber: number): void {
    error.value = `第 ${pageNumber} 页预览加载失败`;
  }

  onMounted(() => { void goToSpread(0); });
  onUnmounted(() => {
    disposed = true;
    decodedPages.clear();
  });

  return { spreadIndex, visiblePages, ready, busy, error, canPrev, canNext, goToSpread, reportImageError };
}
