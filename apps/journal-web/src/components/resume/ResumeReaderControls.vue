<script setup lang="ts">
import { ElPopover } from 'element-plus';
import 'element-plus/es/components/popover/style/css';
import { computed, shallowRef, useTemplateRef } from 'vue';
import type { SiteContactItem } from '../../types';
import { showMessage } from '../../utils/message';

const props = defineProps<{
  totalPages: number;
  firstPage: number;
  lastPage: number;
  canPrev: boolean;
  canNext: boolean;
  busy: boolean;
  ready: boolean;
  enlargedPage: number | null;
  contentUrl?: string;
  downloadUrl?: string;
  originalName?: string;
  updatedAt?: string;
  shareUrl?: string | null;
  contacts?: SiteContactItem[];
}>();
const emit = defineEmits<{ prev: []; next: []; restore: [] }>();
const menu = useTemplateRef<InstanceType<typeof ElPopover>>('menu');
const menuPanel = useTemplateRef<HTMLElement>('menuPanel');
const menuTrigger = useTemplateRef<HTMLButtonElement>('menuTrigger');
const menuOpen = shallowRef(false);
const copyError = shallowRef<string | null>(null);
const visibleContacts = computed(() => props.contacts?.filter(item => item.enabled && item.value.trim()) ?? []);
const pageLabel = computed(() => {
  if (props.enlargedPage !== null) return `第 ${props.enlargedPage} 页 / 共 ${props.totalPages} 页`;
  if (!props.ready) return `共 ${props.totalPages} 页`;
  const range = props.firstPage === props.lastPage ? `${props.firstPage}` : `${props.firstPage}–${props.lastPage}`;
  return `${range} / 共 ${props.totalPages} 页`;
});
const formattedDate = computed(() => props.updatedAt
  ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', dateStyle: 'medium' }).format(new Date(props.updatedAt))
  : '');

function contactHref(item: SiteContactItem): string | undefined {
  if (item.kind === 'email') return `mailto:${item.value}`;
  return item.url || undefined;
}

async function copy(value: string, label: string): Promise<void> {
  copyError.value = null;
  try {
    await navigator.clipboard.writeText(value);
    showMessage({ message: `已复制${label}`, type: 'success' });
  } catch (reason) {
    copyError.value = reason instanceof Error ? reason.message : String(reason);
  }
}

function closeMenu(): void {
  menuOpen.value = false;
  if (menuPanel.value?.contains(document.activeElement)) {
    menuTrigger.value?.focus({ preventScroll: true });
  }
}

function handleKeydown(event: KeyboardEvent): void {
  if (!menuOpen.value) return;
  event.stopPropagation();
  if (event.key === 'Escape') {
    event.preventDefault();
    menu.value?.hide();
  }
}
</script>

<template>
  <nav class="reader-controls" aria-label="简历阅读控制" @keydown="handleKeydown">
    <button
      v-if="enlargedPage !== null"
      class="reader-controls__button"
      type="button"
      @click="emit('restore')"
    >
      {{ totalPages > 1 ? '返回双页' : '返回整页' }}
    </button>
    <button
      v-else-if="totalPages > 1"
      class="reader-controls__button reader-controls__turn"
      type="button"
      :disabled="!canPrev"
      aria-label="上一组简历"
      title="上一组（← / PageUp）"
      @click="emit('prev')"
    >
      <span aria-hidden="true">‹</span><span class="reader-controls__turn-label">上一组</span>
    </button>

    <span class="reader-controls__pages" role="status" aria-live="polite">{{ pageLabel }}</span>

    <button
      v-if="enlargedPage === null && totalPages > 1"
      class="reader-controls__button reader-controls__turn"
      type="button"
      :disabled="!canNext"
      aria-label="下一组简历"
      title="下一组（→ / PageDown）"
      @click="emit('next')"
    >
      <span class="reader-controls__turn-label">下一组</span><span aria-hidden="true">›</span>
    </button>

    <ElPopover
      ref="menu"
      trigger="click"
      placement="top-end"
      :width="280"
      :hide-after="0"
      :show-arrow="false"
      :teleported="true"
      popper-class="resume-reader-menu"
      @before-enter="menuOpen = true"
      @after-enter="menuPanel?.focus({ preventScroll: true })"
      @before-leave="closeMenu"
    >
      <template #reference>
        <button
          ref="menuTrigger"
          class="reader-controls__button"
          type="button"
          aria-haspopup="dialog"
          :aria-expanded="menuOpen"
        >更多</button>
      </template>
      <section
        ref="menuPanel"
        class="reader-menu"
        role="dialog"
        aria-label="简历更多操作"
        tabindex="-1"
        @keydown.esc.stop.prevent="menu?.hide()"
      >
        <div class="reader-menu__heading">
          <strong class="reader-menu__filename">{{ originalName || '个人简历' }}</strong>
          <button class="reader-controls__button" type="button" @click="menu?.hide()">关闭</button>
        </div>
        <small v-if="formattedDate" class="reader-menu__date">更新于 {{ formattedDate }}</small>
        <a v-if="contentUrl" class="reader-menu__item" :href="contentUrl" target="_blank" rel="noopener noreferrer">查看 PDF 原件 ↗</a>
        <a v-if="downloadUrl" class="reader-menu__item" :href="downloadUrl">下载原件</a>
        <button v-if="shareUrl" class="reader-menu__item" type="button" @click="copy(shareUrl, '简历地址')">复制分享地址</button>
        <template v-for="item in visibleContacts" :key="item.kind">
          <button
            v-if="item.kind === 'wechat' || !contactHref(item)"
            class="reader-menu__item"
            type="button"
            @click="copy(item.value, item.label)"
          >{{ item.label }}：{{ item.value }}</button>
          <a
            v-else
            class="reader-menu__item"
            :href="contactHref(item)"
            :target="item.kind === 'email' ? undefined : '_blank'"
            :rel="item.kind === 'email' ? undefined : 'noopener noreferrer'"
          >{{ item.label }}：{{ item.value }}</a>
        </template>
        <p v-if="copyError" class="reader-menu__error" role="alert">复制失败：{{ copyError }}</p>
      </section>
    </ElPopover>
    <span class="reader-controls__loading" :class="{ 'reader-controls__loading--active': busy }" aria-hidden="true" />
  </nav>
</template>

<style scoped>
.reader-controls {
  position: relative;
  display: flex;
  max-width: 100%;
  min-height: 2.75rem;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  justify-self: center;
  padding: 0.25rem 0.4rem;
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  background: var(--surface-card);
}

.reader-controls__button,
.reader-menu__item {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  min-height: 2.25rem;
  padding: 0.35rem 0.65rem;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--text-primary);
  font-size: 0.8rem;
  text-decoration: none;
  cursor: pointer;
  white-space: nowrap;
}

.reader-controls__button:hover:not(:disabled),
.reader-menu__item:hover {
  background: var(--surface-muted);
}

.reader-controls__button:disabled { opacity: 0.35; cursor: not-allowed; }
.reader-controls__pages { font-size: 0.78rem; font-variant-numeric: tabular-nums; white-space: nowrap; }
.reader-controls__loading { position: absolute; right: 0.75rem; top: 0; width: 5px; height: 5px; border-radius: 50%; background: var(--accent); opacity: 0; }
.reader-controls__loading--active { opacity: 1; }
.reader-menu { display: grid; gap: 0.3rem; max-height: min(30rem, calc(100dvh - 8rem)); overflow-y: auto; }
.reader-menu__heading { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
.reader-menu__filename { min-width: 0; overflow-wrap: anywhere; font-size: 0.85rem; }
.reader-menu__date { padding: 0 0.5rem 0.5rem; color: var(--text-muted); }
.reader-menu__item { justify-content: flex-start; text-align: left; white-space: normal; overflow-wrap: anywhere; }
.reader-menu__error { margin: 0.5rem; color: var(--danger); overflow-wrap: anywhere; }

:global(.el-popover.resume-reader-menu) {
  max-width: calc(100vw - 24px);
  padding: 0.65rem;
  border-color: var(--border-subtle);
  background: var(--surface-card);
  color: var(--text-primary);
  font-family: var(--font-sans);
}

@media (max-width: 599px) {
  .reader-controls__turn-label { display: none; }
  .reader-controls__turn { min-width: 2.25rem; font-size: 1.25rem; }
  .reader-controls { gap: 0.2rem; }
  .reader-controls__button { padding-inline: 0.5rem; }
}
</style>
