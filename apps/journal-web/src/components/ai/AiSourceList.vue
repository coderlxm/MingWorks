<script setup lang="ts">
import type { AiSource } from '../../types';

defineProps<{
  sources: AiSource[];
}>();

const emit = defineEmits<{
  openEntry: [entryId: number];
}>();

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}
</script>

<template>
  <div v-if="sources.length > 0" class="ai-sources" aria-label="本轮来源">
    <p class="ai-sources__label">回答时引用的来源</p>
    <div class="ai-sources__list">
      <details v-for="source in sources" :key="source.entryId" class="ai-source">
        <summary class="ai-source__summary">
          <span class="ai-source__title">{{ source.title || '无标题记录' }}</span>
          <time class="ai-source__date" :datetime="source.sourceCreatedAt">
            {{ formatDate(source.sourceCreatedAt) }}
          </time>
          <span v-if="source.deleted" class="ai-source__deleted">已删除</span>
          <span v-else-if="source.readComplete === false" class="ai-source__partial">部分读取</span>
        </summary>
        <div class="ai-source__body">
          <p class="ai-source__excerpt">{{ source.excerpt || '这条记录没有可展示的正文。' }}</p>
          <button class="ai-source__open" type="button" :disabled="source.deleted" @click="emit('openEntry', source.entryId)">
            打开原记录
          </button>
        </div>
      </details>
    </div>
  </div>
</template>

<style scoped>
.ai-sources {
  display: grid;
  gap: 0.45rem;
  margin-top: 0.85rem;
}

.ai-sources__label {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.72rem;
  font-weight: 680;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.ai-sources__list {
  display: grid;
  gap: 0.4rem;
}

.ai-source {
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  background: color-mix(in srgb, var(--surface-muted) 40%, transparent);
  overflow: hidden;
}

.ai-source__summary {
  display: flex;
  align-items: baseline;
  gap: 0.55rem;
  padding: 0.6rem 0.75rem;
  cursor: pointer;
  list-style: none;
}

.ai-source__summary::-webkit-details-marker {
  display: none;
}

.ai-source__title {
  min-width: 0;
  overflow: hidden;
  flex: 1;
  color: var(--text-primary);
  font-size: 0.85rem;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-source__date {
  color: var(--text-muted);
  font-size: 0.75rem;
  white-space: nowrap;
}

.ai-source__partial {
  padding: 0.08rem 0.35rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--warning) 15%, transparent);
  color: var(--warning);
  font-size: 0.68rem;
  white-space: nowrap;
}

.ai-source__deleted {
  padding: 0.08rem 0.35rem;
  border-radius: 999px;
  background: var(--danger-soft);
  color: var(--danger);
  font-size: 0.68rem;
  white-space: nowrap;
}

.ai-source__body {
  padding: 0 0.75rem 0.75rem;
}

.ai-source__excerpt {
  margin: 0 0 0.55rem;
  color: var(--text-muted);
  font-size: 0.82rem;
  line-height: 1.75;
  white-space: pre-wrap;
}

.ai-source__open {
  padding: 0.3rem 0.65rem;
  border: 1px solid var(--border-strong);
  border-radius: 999px;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  font-size: 0.76rem;
  font-weight: 600;
}

.ai-source__open:disabled {
  cursor: default;
  opacity: 0.5;
}
</style>
