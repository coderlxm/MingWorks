import { useEventListener, useIntervalFn } from '@vueuse/core';
import { computed, onMounted, onUnmounted, shallowRef } from 'vue';
import { z } from 'zod';
import { showMessage } from '../utils/message';

const versionSchema = z.object({ version: z.string().regex(/^[0-9a-f]{40}$/) });

export function useFrontendUpdate() {
  const currentVersion = import.meta.env.VITE_JOURNAL_WEB_VERSION;
  const onlineVersion = shallowRef<string | null>(null);
  const deferredVersions = shallowRef<string[]>([]);
  const updateVisible = computed(() => onlineVersion.value !== null
    && onlineVersion.value !== currentVersion
    && !deferredVersions.value.includes(onlineVersion.value));
  let activeRequest: AbortController | null = null;
  let stopped = false;

  const { pause, resume } = useIntervalFn(() => {
    void loadVersion();
  }, 60_000, { immediate: false });

  async function loadVersion(): Promise<void> {
    if (activeRequest || stopped) return;
    const controller = new AbortController();
    activeRequest = controller;
    try {
      versionSchema.shape.version.parse(currentVersion);
      const response = await fetch('/version.json', {
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`版本查询失败（HTTP ${response.status}）`);
      const body = versionSchema.parse(await response.json());
      onlineVersion.value = body.version;
    } catch (error) {
      // Unmount cancels the request; all request/content failures stop detection visibly.
      if (controller.signal.aborted) return;
      stopped = true;
      pause();
      showMessage({
        message: `新版本检测已停止：${error instanceof Error ? error.message : String(error)}`,
        type: 'error',
        duration: 0,
      });
    } finally {
      activeRequest = null;
    }
  }

  useEventListener(document, 'visibilitychange', () => {
    if (!import.meta.env.PROD || stopped) return;
    if (document.hidden) {
      pause();
    } else {
      resume();
      void loadVersion();
    }
  });

  onMounted(() => {
    if (!import.meta.env.PROD) return;
    if (!document.hidden) resume();
    void loadVersion();
  });

  onUnmounted(() => {
    activeRequest?.abort();
  });

  function refresh(): void {
    if (window.confirm('刷新后将使用最新版本。未保存的内容会丢失，正在进行的上传或提交会中断，请先完成操作。确定刷新？')) {
      window.location.reload();
    }
  }

  function defer(): void {
    if (onlineVersion.value !== null) {
      deferredVersions.value = [...deferredVersions.value, onlineVersion.value];
    }
  }

  return { updateVisible, refresh, defer };
}
