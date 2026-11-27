<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, useId, useTemplateRef } from 'vue';

const props = defineProps<{
  subject: string;
  assetCount: number;
  previewText?: string;
}>();

const emit = defineEmits<{
  close: [];
  confirm: [];
}>();

const dialog = useTemplateRef<HTMLDialogElement>('dialog');
const titleId = useId();

const message = computed(() => {
  if (props.assetCount === 0) return `永久删除${props.subject}？此操作无法撤销。`;
  if (props.assetCount === 1) return `永久删除${props.subject}及其附件？此操作无法撤销。`;
  return `永久删除${props.subject}及其 ${props.assetCount} 个附件？此操作无法撤销。`;
});

function handleBackdropMouseDown(event: MouseEvent): void {
  if (event.target === dialog.value) emit('close');
}

onMounted(() => {
  dialog.value?.showModal();
});

onBeforeUnmount(() => {
  if (dialog.value?.open) dialog.value.close();
});
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="delete-dialog"
      :aria-labelledby="titleId"
      aria-modal="true"
      @cancel.prevent="emit('close')"
      @mousedown="handleBackdropMouseDown"
    >
      <div class="delete-dialog__panel" role="alertdialog" :aria-labelledby="titleId">
        <header class="delete-dialog__header">
          <div>
            <h2 :id="titleId" class="delete-dialog__title">确认删除</h2>
            <p class="delete-dialog__message">{{ message }}</p>
          </div>
          <button
            class="delete-dialog__close"
            type="button"
            aria-label="关闭"
            @click="emit('close')"
          >
            ×
          </button>
        </header>

        <p v-if="previewText" class="delete-dialog__preview">{{ previewText }}</p>

        <footer class="delete-dialog__actions">
          <button class="button button--quiet" type="button" autofocus @click="emit('close')">
            取消
          </button>
          <button class="button delete-dialog__confirm" type="button" @click="emit('confirm')">
            确认删除
          </button>
        </footer>
      </div>
    </dialog>
  </Teleport>
</template>

<style scoped>
.delete-dialog {
  width: min(26rem, calc(100vw - 2rem));
  max-width: none;
  margin: auto;
  padding: 0;
  border: 0;
  border-radius: 1rem;
  background: transparent;
  color: var(--text-primary);
}

.delete-dialog::backdrop {
  background: rgb(22 22 20 / 60%);
}

.delete-dialog__panel {
  display: grid;
  gap: 1rem;
  padding: 1.25rem;
  border: 1px solid var(--border-strong);
  border-radius: 1rem;
  background: var(--surface-card);
  box-shadow: 0 24px 64px rgb(17 17 15 / 32%);
}

.delete-dialog__header,
.delete-dialog__actions {
  display: flex;
}

.delete-dialog__header {
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.delete-dialog__title {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 1.15rem;
}

.delete-dialog__message {
  margin: 0.35rem 0 0;
  color: var(--text-muted);
  font-size: 0.82rem;
  line-height: 1.55;
}

.delete-dialog__preview {
  display: -webkit-box;
  margin: 0;
  padding: 0.65rem 0.8rem;
  overflow: hidden;
  border: 1px solid var(--border-subtle);
  border-radius: 0.65rem;
  background: var(--surface-muted);
  color: var(--text-primary);
  font-size: 0.78rem;
  line-height: 1.5;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.delete-dialog__close {
  width: 2.25rem;
  height: 2.25rem;
  flex: none;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font: inherit;
  font-size: 1.35rem;
}

.delete-dialog__close:hover {
  background: var(--surface-muted);
  color: var(--text-primary);
}

.delete-dialog__actions {
  justify-content: flex-end;
  gap: 0.6rem;
}

.delete-dialog__actions .button {
  min-height: 2.5rem;
}

.delete-dialog__confirm {
  background: var(--danger);
  color: #fff;
}

.delete-dialog__close:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}
</style>
