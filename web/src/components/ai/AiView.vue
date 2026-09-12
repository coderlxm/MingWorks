<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, shallowRef, useTemplateRef } from 'vue';
import { useRouter } from 'vue-router';
import { login } from '../../api';
import { useAiChatStore } from '../../stores/aiChat';
import { useSessionStore } from '../../stores/session';
import LoginView from '../journal/LoginView.vue';
import JournalLoading from '../ui/JournalLoading.vue';
import AiMessageBubble from './AiMessageBubble.vue';

const store = useAiChatStore();
const session = useSessionStore();
const router = useRouter();

const historyOpen = shallowRef(false);
const authBusy = shallowRef(false);
const authError = shallowRef<string | null>(null);
const conversation = useTemplateRef<HTMLDivElement>('conversation');
const composer = useTemplateRef<HTMLTextAreaElement>('composer');
let disposed = false;

const examples = [
  '找一下我之前记过的 Cloudflare 部署内容',
  '根据这些记录，总结当时遇到的问题和解决办法',
  '把刚才这些整理成一篇笔记，保留参考来源',
];

const canSend = computed(() =>
  session.ownerAuthenticated
  && store.sending === false
  && store.sessionLoading === false
  && store.creatingSession === false
  && store.sessionsLoading === false
  && (store.activeSessionId === null || store.activeConversation.loaded)
  && store.draft.trim() !== '',
);

async function scrollToBottom(): Promise<void> {
  await nextTick();
  if (conversation.value === null) return;
  conversation.value.scrollTo({ top: conversation.value.scrollHeight, behavior: 'smooth' });
}

function handleScroll(): void {
  if (conversation.value === null) return;
  store.scrollTop = conversation.value.scrollTop;
}

function selectExample(example: string): void {
  store.draft = example;
  composer.value?.focus();
}

async function handleAuth(password: string): Promise<void> {
  authBusy.value = true;
  authError.value = null;
  try {
    await login(password);
    session.setAuthenticated(true);
    await store.ensureLoaded();
  }
  catch (reason) {
    authError.value = reason instanceof Error ? reason.message : String(reason);
  }
  finally {
    authBusy.value = false;
  }
}

async function handleNewChat(): Promise<void> {
  historyOpen.value = false;
  await store.startNewSession();
  if (!disposed) await scrollToBottom();
}

async function handleSelectSession(id: number): Promise<void> {
  historyOpen.value = false;
  await store.selectSession(id);
  await nextTick();
  if (!disposed && store.activeSessionId === id && conversation.value !== null) {
    conversation.value.scrollTop = store.scrollTop;
  }
}

async function handleDeleteSession(event: MouseEvent, id: number): Promise<void> {
  event.stopPropagation();
  if (window.confirm('删除这个 AI 会话？') === false) return;
  await store.deleteSession(id);
}

async function handleSend(): Promise<void> {
  if (canSend.value === false) return;
  const conversationState = store.activeConversation;
  await store.send(store.draft);
  if (!disposed && store.activeConversation === conversationState) await scrollToBottom();
}

function handleComposerKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
  event.preventDefault();
  void handleSend();
}

async function openSource(entryId: number): Promise<void> {
  await router.push({
    name: 'private',
    query: {
      entry: String(entryId),
      view: 'waterfall',
    },
  });
}

async function saveArticle(messageId: number): Promise<void> {
  const conversationState = store.activeConversation;
  const articleId = await store.saveArticle(messageId);
  if (disposed || articleId === null || store.activeConversation !== conversationState) return;
  await router.push({ name: 'article-edit', params: { articleId } });
}

async function openArticle(articleId: number): Promise<void> {
  await router.push({ name: 'article-edit', params: { articleId } });
}

function formatSessionTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

onMounted(async () => {
  await session.load();
  if (session.ownerAuthenticated) {
    await store.ensureLoaded();
  }
  else {
    store.reset();
  }
  await nextTick();
  if (conversation.value !== null) {
    conversation.value.scrollTop = store.scrollTop;
  }
});

onUnmounted(() => {
  disposed = true;
});
</script>

<template>
  <main class="ai-view">
    <header class="ai-header">
      <div class="ai-header__title">
        <h1>AI</h1>
        <p>查找记录，连接想法</p>
      </div>
      <div class="ai-header__actions">
        <button
          class="ai-header__button"
          type="button"
          :disabled="session.ownerAuthenticated === false || store.creatingSession || store.sessionsLoading"
          @click="handleNewChat"
        >
          新对话
        </button>
        <button
          class="ai-header__button"
          type="button"
          :aria-expanded="historyOpen"
          :disabled="session.ownerAuthenticated === false"
          @click="historyOpen = historyOpen === false"
        >
          历史
        </button>
      </div>
    </header>

    <div v-if="session.authenticationChecked === false" class="ai-auth-state">
      <JournalLoading variant="reading" label="正在确认管理会话…" />
    </div>

    <div v-else-if="session.ownerAuthenticated === false" class="ai-auth-state">
      <LoginView :busy="authBusy" @login="handleAuth" />
      <p v-if="authError" class="ai-auth-error" role="alert">{{ authError }}</p>
    </div>

    <template v-else>
      <div class="ai-workspace">
        <aside v-if="historyOpen" class="ai-history" aria-label="AI 会话历史">
          <div class="ai-history__head">
            <span>会话历史</span>
            <button type="button" aria-label="关闭历史" @click="historyOpen = false">✕</button>
          </div>
          <div v-if="store.sessionsLoading" class="ai-history__loading">
            <JournalLoading variant="inline" label="正在读取历史…" />
          </div>
          <p v-else-if="store.sessions.length === 0" class="ai-history__empty">还没有历史会话。</p>
          <div v-else class="ai-history__list">
            <div
              v-for="item in store.sessions"
              :key="item.id"
              class="ai-history__item"
              :class="{ 'ai-history__item--active': item.id === store.activeSessionId }"
            >
              <button
                class="ai-history__select"
                type="button"
                :disabled="store.creatingSession"
                @click="handleSelectSession(item.id)"
              >
                <span class="ai-history__title">{{ item.title }}</span>
                <time class="ai-history__time" :datetime="item.updatedAt">
                  {{ formatSessionTime(item.updatedAt) }}
                </time>
              </button>
              <button
                class="ai-history__delete"
                type="button"
                aria-label="删除会话"
                @click="handleDeleteSession($event, item.id)"
              >
                删除
              </button>
            </div>
          </div>
        </aside>

        <section
          ref="conversation"
          class="ai-conversation"
          aria-live="polite"
          @scroll="handleScroll"
        >
          <div v-if="store.sessionLoading" class="ai-conversation__state">
            <JournalLoading variant="reading" label="正在打开会话…" />
          </div>
          <div v-else-if="store.messages.length === 0" class="ai-empty">
            <h2>从一个问题开始</h2>
            <p>可以查找旧记录、做跨记录总结，或把整理结果保存成私有文章。</p>
            <div class="ai-empty__examples">
              <button
                v-for="example in examples"
                :key="example"
                class="ai-empty__example"
                type="button"
                @click="selectExample(example)"
              >
                {{ example }}
              </button>
            </div>
          </div>
          <div v-else class="ai-messages">
            <AiMessageBubble
              v-for="message in store.messages"
              :key="message.id"
              :message="message"
              :saving="store.savingArticleMessageId === message.id"
              @open-entry="openSource($event)"
              @save-article="saveArticle"
              @open-article="openArticle"
            />
          </div>
        </section>

        <div class="ai-composer">
          <div v-if="store.error" class="ai-composer__error" role="alert">
            {{ store.error }}
          </div>
          <form class="ai-composer__form" @submit.prevent="handleSend">
            <textarea
              ref="composer"
              v-model="store.draft"
              class="ai-composer__input"
              rows="2"
              placeholder="问一些关于你记录的问题…"
              @keydown="handleComposerKeydown"
            />
            <button
              class="ai-composer__send"
              type="submit"
              :disabled="canSend === false"
              :aria-busy="store.sending"
            >
              <JournalLoading v-if="store.sending" variant="inline" label="整理中" />
              <template v-else>发送</template>
            </button>
          </form>
          <p class="ai-composer__note">
            涉及站内资料的问题，会将本轮选中的正文发送给当前模型服务；上下文最多包含最近十轮已完成问答。
          </p>
        </div>
      </div>
    </template>
  </main>
</template>

<style scoped>
.ai-view {
  display: flex;
  flex: 1 1 auto;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  background: var(--surface-page);
}

.ai-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  width: min(calc(100% - (var(--workspace-gutter) * 2)), var(--workspace-width));
  margin: 0 auto;
  padding: 1.1rem 0 0.9rem;
}

.ai-header__title h1 {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 1.55rem;
  font-weight: 750;
}

.ai-header__title p {
  margin: 0.18rem 0 0;
  color: var(--text-muted);
  font-size: 0.82rem;
}

.ai-header__actions {
  display: flex;
  gap: 0.5rem;
}

.ai-header__button {
  padding: 0.45rem 0.8rem;
  border: 1px solid var(--border-subtle);
  border-radius: 999px;
  background: var(--surface-card);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: 620;
}

.ai-header__button:disabled {
  cursor: default;
  opacity: 0.55;
}

.ai-auth-state {
  display: grid;
  flex: 1 1 auto;
  min-height: 0;
  place-items: center;
}

.ai-auth-error {
  max-width: 27rem;
  margin: 0.8rem auto 0;
  color: var(--danger);
  text-align: center;
}

.ai-workspace {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  width: min(calc(100% - (var(--workspace-gutter) * 2)), var(--workspace-width));
  margin: 0 auto;
}

.ai-history {
  position: absolute;
  z-index: 5;
  top: 0;
  right: 0;
  display: flex;
  width: min(22rem, calc(100vw - 2rem));
  max-height: min(30rem, 70vh);
  flex-direction: column;
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  background: var(--surface-card);
  box-shadow: var(--shadow-card);
  overflow: hidden;
}

.ai-history__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.7rem 0.85rem;
  border-bottom: 1px solid var(--border-subtle);
  color: var(--text-muted);
  font-size: 0.82rem;
  font-weight: 680;
}

.ai-history__head button {
  border: 0;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}

.ai-history__loading,
.ai-history__empty {
  padding: 1rem;
  color: var(--text-muted);
  font-size: 0.85rem;
}

.ai-history__list {
  display: grid;
  overflow-y: auto;
  padding: 0.35rem;
}

.ai-history__item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  border-radius: 9px;
}

.ai-history__item--active {
  background: var(--surface-muted);
}

.ai-history__select {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 0.16rem;
  padding: 0.55rem 0.65rem;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.ai-history__title {
  overflow: hidden;
  font-size: 0.86rem;
  font-weight: 620;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-history__time {
  color: var(--text-muted);
  font-size: 0.72rem;
}

.ai-history__delete {
  flex: none;
  padding: 0.3rem 0.55rem;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 0.74rem;
}

.ai-history__delete:hover {
  background: var(--danger-soft);
  color: var(--danger);
}

.ai-conversation {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  flex-direction: column;
  overflow-y: auto;
  padding: 0 0 1rem;
  scrollbar-width: none;
}

.ai-conversation::-webkit-scrollbar {
  display: none;
}

.ai-conversation__state {
  display: grid;
  flex: 1;
  place-items: center;
}

.ai-empty {
  display: grid;
  flex: 1;
  align-content: center;
  gap: 0.65rem;
  padding: 2rem 0 4rem;
}

.ai-empty h2 {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 1.35rem;
}

.ai-empty p {
  max-width: 36rem;
  margin: 0;
  color: var(--text-muted);
  font-size: 0.88rem;
  line-height: 1.7;
}

.ai-empty__examples {
  display: grid;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.ai-empty__example {
  width: fit-content;
  max-width: 100%;
  padding: 0.55rem 0.8rem;
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  background: var(--surface-card);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 0.85rem;
  text-align: left;
}

.ai-messages {
  display: grid;
  gap: 1.15rem;
  padding: 0.5rem 0 1rem;
}

.ai-composer {
  flex: none;
  border-top: 1px solid var(--border-subtle);
  background: var(--surface-page);
}

.ai-composer__error {
  padding: 0.55rem 0.75rem;
  border: 1px solid var(--danger-soft);
  border-radius: 10px;
  margin-bottom: 0.55rem;
  color: var(--danger);
  font-size: 0.82rem;
}

.ai-composer__form {
  display: flex;
  align-items: flex-end;
  gap: 0.6rem;
  padding-top: 0.8rem;
}

.ai-composer__input {
  min-width: 0;
  min-height: 3rem;
  flex: 1;
  resize: vertical;
  padding: 0.7rem 0.85rem;
  border: 1px solid var(--border-strong);
  border-radius: 12px;
  background: var(--surface-card);
  color: var(--text-primary);
  font: inherit;
  line-height: 1.55;
}

.ai-composer__send {
  min-width: 4.4rem;
  min-height: 3rem;
  padding: 0.55rem 1rem;
  border: 0;
  border-radius: 12px;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 680;
}

.ai-composer__send:disabled {
  cursor: default;
  opacity: 0.55;
}

.ai-composer__note {
  margin: 0.5rem 0 0;
  color: var(--text-muted);
  font-size: 0.72rem;
  line-height: 1.6;
}

@media (max-width: 599px) {
  .ai-header,
  .ai-workspace {
    width: calc(100% - 1.6rem);
  }

  .ai-conversation {
    padding-bottom: 0.75rem;
  }

  .ai-message {
    max-width: 100%;
  }
}
</style>
