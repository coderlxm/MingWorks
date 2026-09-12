<script setup lang="ts">
import { computed } from 'vue';
import type { AiMessage } from '../../types';
import { renderAiMarkdown } from '../../utils/aiMarkdown';
import AINavigationIcon from './AINavigationIcon.vue';
import AiSourceList from './AiSourceList.vue';

const props = defineProps<{
  message: AiMessage;
  saving: boolean;
}>();

const emit = defineEmits<{
  openEntry: [entryId: number];
  saveArticle: [messageId: number];
  openArticle: [articleId: number];
}>();

const renderedContent = computed(() => renderAiMarkdown(props.message.content));
const canSave = computed(() =>
  props.message.role === 'assistant'
  && props.message.status === 'completed'
  && props.message.content.trim() !== '',
);
</script>

<template>
  <article
    class="ai-message"
    :class="[
      `ai-message--${message.role}`,
      `ai-message--${message.status}`,
    ]"
  >
    <div v-if="message.role === 'assistant'" class="ai-message__avatar" aria-hidden="true">
      <AINavigationIcon />
    </div>
    <div class="ai-message__content">
      <template v-if="message.role === 'user'">
        <p class="ai-message__user-text">{{ message.content }}</p>
      </template>
      <template v-else-if="message.status === 'pending'">
        <div v-if="message.id > 0" class="ai-message__failure" role="alert">
          <strong>本轮未完成。</strong>
          <p>没有收到完整回答，不会自动重试。</p>
        </div>
        <div v-else class="ai-message__pending" role="status">
          <span class="ai-message__pending-dot" />
          <span class="ai-message__pending-dot" />
          <span class="ai-message__pending-dot" />
          <span>正在查找并整理…</span>
        </div>
      </template>
      <template v-else-if="message.status === 'failed'">
        <div class="ai-message__failure" role="alert">
          <strong>本轮没有完成。</strong>
          <p>{{ message.error || '请求失败，未生成完整回答。' }}</p>
        </div>
      </template>
      <template v-else>
        <div class="ai-message__body" v-html="renderedContent" />
        <AiSourceList :sources="message.sources" @open-entry="emit('openEntry', $event)" />
        <div v-if="canSave" class="ai-message__actions">
          <button
            v-if="message.articleId === null"
            class="ai-message__action"
            type="button"
            :disabled="saving"
            @click="emit('saveArticle', message.id)"
          >
            {{ saving ? '保存中…' : '保存为私有文章' }}
          </button>
          <button
            v-else
            class="ai-message__action"
            type="button"
            @click="emit('openArticle', message.articleId)"
          >
            打开文章
          </button>
        </div>
      </template>
    </div>
  </article>
</template>

<style scoped>
.ai-message {
  display: flex;
  gap: 0.75rem;
  max-width: min(100%, 52rem);
}

.ai-message--user {
  margin-left: auto;
  justify-content: flex-end;
}

.ai-message--assistant {
  margin-right: auto;
}

.ai-message__avatar {
  display: grid;
  width: 2rem;
  height: 2rem;
  flex: none;
  border: 1px solid var(--border-subtle);
  border-radius: 50%;
  background: var(--surface-card);
  place-items: center;
}

.ai-message__avatar :deep(svg) {
  width: 1.2rem;
  height: 1.2rem;
}

.ai-message__content {
  min-width: 0;
  padding: 0.85rem 1rem;
  border: 1px solid var(--border-subtle);
  border-radius: 16px;
  background: var(--surface-card);
}

.ai-message--user .ai-message__content {
  padding: 0.65rem 0.9rem;
  border-color: transparent;
  background: var(--accent);
  color: #fff;
}

.ai-message__user-text {
  margin: 0;
  line-height: 1.65;
  white-space: pre-wrap;
}

.ai-message__body {
  color: var(--text-primary);
  font-size: 0.92rem;
  line-height: 1.8;
  overflow-wrap: anywhere;
}

.ai-message__body :deep(h2),
.ai-message__body :deep(h3) {
  margin: 0.9rem 0 0.45rem;
  font-family: var(--font-serif);
  font-weight: 700;
}

.ai-message__body :deep(p) {
  margin: 0.55rem 0;
}

.ai-message__body :deep(ul),
.ai-message__body :deep(ol) {
  padding-left: 1.2rem;
  margin: 0.55rem 0;
}

.ai-message__body :deep(blockquote) {
  margin: 0.65rem 0;
  padding: 0.25rem 0.85rem;
  border-left: 3px solid var(--border-strong);
  color: var(--text-muted);
}

.ai-message__body :deep(code) {
  padding: 0.12rem 0.3rem;
  border-radius: 5px;
  background: var(--surface-muted);
  font-size: 0.86em;
}

.ai-message__body :deep(pre) {
  overflow-x: auto;
  padding: 0.75rem;
  border-radius: 10px;
  background: var(--surface-muted);
}

.ai-message__body :deep(a) {
  color: var(--accent-strong);
}

.ai-message__pending {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--text-muted);
  font-size: 0.85rem;
}

.ai-message__pending-dot {
  width: 0.36rem;
  height: 0.36rem;
  border-radius: 50%;
  background: var(--accent);
  animation: ai-pending 1.1s ease-in-out infinite;
}

.ai-message__pending-dot:nth-child(2) {
  animation-delay: 0.14s;
}

.ai-message__pending-dot:nth-child(3) {
  animation-delay: 0.28s;
}

.ai-message__failure {
  color: var(--danger);
}

.ai-message__failure p {
  margin: 0.35rem 0 0;
  color: var(--text-muted);
  line-height: 1.65;
  white-space: pre-wrap;
}

.ai-message__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.ai-message__action {
  padding: 0.36rem 0.7rem;
  border: 1px solid var(--border-strong);
  border-radius: 999px;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  font-size: 0.78rem;
  font-weight: 620;
}

.ai-message__action:disabled {
  cursor: default;
  opacity: 0.6;
}

@keyframes ai-pending {
  0%,
  100% {
    opacity: 0.25;
    transform: translateY(0);
  }

  50% {
    opacity: 1;
    transform: translateY(-0.12rem);
  }
}
</style>
