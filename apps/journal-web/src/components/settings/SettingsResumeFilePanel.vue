<script setup lang="ts">
import { Document } from '@element-plus/icons-vue';
import { useFileDialog } from '@vueuse/core';
import { shallowRef } from 'vue';
import type { JournalAdminResumeSummary } from '../../types';
import { formatEntryTime, formatFileSize } from '../../utils/formatters';
import SettingsCard from './SettingsCard.vue';

const props = defineProps<{
  summary: JournalAdminResumeSummary | null;
  busy: boolean;
}>();

const emit = defineEmits<{
  upload: [file: File];
  delete: [];
}>();

const pendingFile = shallowRef<File | null>(null);
const {
  open,
  reset,
  onChange: onFileChange,
} = useFileDialog({
  accept: '.md,.markdown,.pdf,text/markdown,application/pdf',
  multiple: false,
  reset: true,
});

onFileChange((files) => {
  const file = files?.item(0) ?? null;
  pendingFile.value = file;
});

function chooseFile(): void {
  open();
}

function submitUpload(): void {
  const file = pendingFile.value;
  if (!file || props.busy) return;
  pendingFile.value = null;
  reset();
  emit('upload', file);
}

function discardPending(): void {
  pendingFile.value = null;
  reset();
}

function requestDelete(): void {
  if (!window.confirm('确定下线并删除当前简历吗？此操作无法恢复。')) return;
  emit('delete');
}
</script>

<template>
  <SettingsCard
    title="简历文件"
    description="支持 Markdown（.md / .markdown，≤ 1 MB）或 PDF（≤ 10 MB），新文件会直接替换当前简历并沿用访问权限。"
  >
    <div class="resume-file">
      <span class="resume-file__icon" :class="{ 'resume-file__icon--empty': !pendingFile && !summary }">
        <Document aria-hidden="true" />
      </span>

      <div v-if="pendingFile" class="resume-file__copy">
        <span class="resume-file__name" :title="pendingFile.name">{{ pendingFile.name }}</span>
        <span class="resume-file__meta">待上传 · {{ formatFileSize(pendingFile.size) }}</span>
      </div>
      <div v-else-if="summary" class="resume-file__copy">
        <span class="resume-file__name" :title="summary.originalName">{{ summary.originalName }}</span>
        <span class="resume-file__meta">
          {{ summary.format === 'markdown' ? 'Markdown' : 'PDF' }} · 更新于 {{ formatEntryTime(summary.updatedAt) }}
        </span>
      </div>
      <div v-else class="resume-file__copy">
        <span class="resume-file__name">尚未上传简历</span>
        <span class="resume-file__meta">上传后默认仅自己可见</span>
      </div>

      <div v-if="pendingFile" class="resume-file__actions">
        <button class="button button--quiet" type="button" :disabled="busy" @click="discardPending">
          取消
        </button>
        <button
          class="button button--primary"
          type="button"
          :disabled="busy"
          :aria-busy="busy"
          @click="submitUpload"
        >
          上传简历
        </button>
      </div>
      <div v-else-if="summary" class="resume-file__actions">
        <RouterLink class="button button--quiet" to="/resume">查看</RouterLink>
        <button class="button button--quiet" type="button" :disabled="busy" @click="chooseFile">
          替换
        </button>
        <button class="button button--quiet resume-file__delete" type="button" :disabled="busy" @click="requestDelete">
          下线
        </button>
      </div>
      <div v-else class="resume-file__actions">
        <button class="button button--quiet" type="button" :disabled="busy" @click="chooseFile">选择文件</button>
      </div>
    </div>
  </SettingsCard>
</template>

<style scoped>
.resume-file {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.9rem;
}

.resume-file__icon {
  display: grid;
  width: 2.6rem;
  height: 2.6rem;
  place-items: center;
  border-radius: 10px;
  background: var(--accent-soft);
  color: var(--accent-strong);
}

.resume-file__icon--empty {
  background: var(--surface-muted);
  color: var(--text-muted);
}

.resume-file__icon svg {
  width: 1.15rem;
  height: 1.15rem;
}

.resume-file__copy {
  display: grid;
  min-width: 0;
  gap: 0.2rem;
}

.resume-file__name {
  overflow: hidden;
  font-size: 0.86rem;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.resume-file__meta {
  color: var(--text-muted);
  font-size: 0.72rem;
}

.resume-file__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.resume-file__actions .button {
  text-decoration: none;
}

.resume-file__delete:hover:not(:disabled) {
  color: var(--danger);
}

@media (max-width: 599px) {
  .resume-file {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .resume-file__actions {
    grid-column: 1 / -1;
  }

  .resume-file__actions .button {
    flex: 1;
  }
}
</style>
