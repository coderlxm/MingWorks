import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';
import {
  createAiSession,
  deleteAiSession,
  fetchAiSession,
  fetchAiSessions,
  saveAiMessageAsArticle,
  sendAiMessage,
} from '../api';
import type { AiMessage, AiSessionSummary } from '../types';

interface AiConversationState {
  messages: AiMessage[];
  loaded: boolean;
  loading: boolean;
  sending: boolean;
  savingArticleMessageId: number | null;
  error: string | null;
  draft: string;
  scrollTop: number;
}

function newConversation(): AiConversationState {
  return {
    messages: [],
    loaded: false,
    loading: false,
    sending: false,
    savingArticleMessageId: null,
    error: null,
    draft: '',
    scrollTop: 0,
  };
}

let nextTempMessageId = -1;

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

export const useAiChatStore = defineStore('aiChat', () => {
  const sessions = ref<AiSessionSummary[]>([]);
  const sessionsLoaded = shallowRef(false);
  const sessionsLoading = shallowRef(false);
  const creatingSession = shallowRef(false);
  const activeSessionId = shallowRef<number | null>(null);
  const conversations = ref<Record<number, AiConversationState>>({});
  const emptyConversation = ref(newConversation());
  const listError = shallowRef<string | null>(null);
  let generation = 0;

  const activeConversation = computed(() => activeSessionId.value === null
    ? emptyConversation.value
    : conversations.value[activeSessionId.value]);
  const activeSession = computed(() =>
    sessions.value.find((session) => session.id === activeSessionId.value) ?? null,
  );
  const messages = computed(() => activeConversation.value.messages);
  const sessionLoading = computed(() => activeConversation.value.loading);
  const sending = computed(() => activeConversation.value.sending);
  const savingArticleMessageId = computed(() => activeConversation.value.savingArticleMessageId);
  const error = computed(() => activeConversation.value.error ?? listError.value);
  const draft = computed({
    get: () => activeConversation.value.draft,
    set: (value: string) => { activeConversation.value.draft = value; },
  });
  const scrollTop = computed({
    get: () => activeConversation.value.scrollTop,
    set: (value: number) => { activeConversation.value.scrollTop = value; },
  });

  function clearError(): void {
    activeConversation.value.error = null;
    listError.value = null;
  }

  async function loadSessions(): Promise<void> {
    if (sessionsLoading.value) return;
    const requestGeneration = generation;
    sessionsLoading.value = true;
    listError.value = null;
    try {
      const response = await fetchAiSessions();
      if (requestGeneration !== generation) return;
      sessions.value = response.sessions;
      sessionsLoaded.value = true;
    }
    catch (reason) {
      if (requestGeneration === generation) listError.value = errorMessage(reason);
    }
    finally {
      if (requestGeneration === generation) sessionsLoading.value = false;
    }
  }

  async function ensureLoaded(): Promise<void> {
    if (!sessionsLoaded.value) await loadSessions();
  }

  async function createSession(state = newConversation()): Promise<AiSessionSummary | null> {
    if (creatingSession.value || sessionsLoading.value) return null;
    const requestGeneration = generation;
    creatingSession.value = true;
    clearError();
    try {
      const session = await createAiSession();
      if (requestGeneration !== generation) return null;
      state.loaded = true;
      conversations.value[session.id] = state;
      sessions.value = [session, ...sessions.value];
      activeSessionId.value = session.id;
      return session;
    }
    catch (reason) {
      if (requestGeneration === generation) listError.value = errorMessage(reason);
      return null;
    }
    finally {
      if (requestGeneration === generation) creatingSession.value = false;
    }
  }

  async function selectSession(id: number): Promise<void> {
    if (creatingSession.value) return;
    conversations.value[id] ??= newConversation();
    const state = conversations.value[id];
    activeSessionId.value = id;
    if (state.loaded || state.loading) return;
    state.loading = true;
    state.error = null;
    try {
      const detail = await fetchAiSession(id);
      if (conversations.value[id] !== state) return;
      state.messages = detail.messages;
      state.loaded = true;
      sessions.value = sessions.value.map((session) => session.id === id ? detail.session : session);
    }
    catch (reason) {
      state.error = errorMessage(reason);
    }
    finally {
      state.loading = false;
    }
  }

  async function deleteSession(id: number): Promise<void> {
    const requestGeneration = generation;
    clearError();
    try {
      await deleteAiSession(id);
      if (requestGeneration !== generation) return;
      if (activeSessionId.value === id) {
        activeSessionId.value = null;
        emptyConversation.value = newConversation();
      }
      delete conversations.value[id];
      sessions.value = sessions.value.filter((session) => session.id !== id);
    }
    catch (reason) {
      if (requestGeneration === generation) listError.value = errorMessage(reason);
    }
  }

  async function startNewSession(): Promise<void> {
    const current = activeSession.value;
    if (current !== null && current.title === '新对话' && messages.value.length === 0) return;
    await createSession();
  }

  async function send(content: string): Promise<void> {
    const trimmed = content.trim();
    if (trimmed === '' || sending.value || sessionLoading.value || creatingSession.value || sessionsLoading.value) return;
    if (activeSessionId.value !== null && !activeConversation.value.loaded) return;
    const requestGeneration = generation;
    clearError();
    if ([...trimmed].length > 2000) {
      activeConversation.value.error = '提问不能超过 2,000 个字符。';
      return;
    }

    let sessionId = activeSessionId.value;
    if (sessionId === null) {
      const created = await createSession(activeConversation.value);
      if (created === null) return;
      sessionId = created.id;
    }
    if (requestGeneration !== generation) return;
    const state = conversations.value[sessionId];
    const now = new Date().toISOString();
    const userTemp: AiMessage = {
      id: nextTempMessageId--,
      sessionId,
      position: 0,
      role: 'user',
      content: trimmed,
      sources: [],
      status: 'completed',
      error: null,
      articleId: null,
      articleTitle: null,
      createdAt: now,
      updatedAt: now,
    };
    const assistantTemp: AiMessage = {
      ...userTemp,
      id: nextTempMessageId--,
      position: 1,
      role: 'assistant',
      content: '',
      status: 'pending',
    };
    state.messages.push(userTemp, assistantTemp);
    if (state.draft.trim() === trimmed) state.draft = '';
    state.sending = true;

    try {
      const response = await sendAiMessage(sessionId, trimmed);
      if (conversations.value[sessionId] !== state) return;
      state.messages = state.messages.map((message) => {
        if (message.id === userTemp.id) return response.userMessage;
        if (message.id === assistantTemp.id) return response.assistantMessage;
        return message;
      });
      sessions.value = sessions.value.map((session) => session.id === sessionId
        ? {
            ...session,
            title: session.title === '新对话'
              ? [...trimmed.replace(/\s+/gu, ' ')].slice(0, 30).join('')
              : session.title,
            updatedAt: response.userMessage.createdAt,
          }
        : session).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || right.id - left.id);
    }
    catch (reason) {
      const message = errorMessage(reason);
      state.messages = state.messages.map((entry) => entry.id === assistantTemp.id
        ? { ...entry, status: 'failed', error: message }
        : entry);
      state.error = message;
    }
    finally {
      state.sending = false;
    }
  }

  async function saveArticle(messageId: number): Promise<number | null> {
    const state = activeConversation.value;
    const sessionId = activeSessionId.value;
    if (sessionId === null || state.savingArticleMessageId !== null) return null;
    state.savingArticleMessageId = messageId;
    state.error = null;
    try {
      const response = await saveAiMessageAsArticle(messageId);
      if (conversations.value[sessionId] !== state) return null;
      state.messages = state.messages.map((message) =>
        message.id === messageId ? { ...message, articleId: response.article.id } : message,
      );
      return response.article.id;
    }
    catch (reason) {
      state.error = errorMessage(reason);
      return null;
    }
    finally {
      state.savingArticleMessageId = null;
    }
  }

  function reset(): void {
    generation += 1;
    activeSessionId.value = null;
    conversations.value = {};
    emptyConversation.value = newConversation();
    sessions.value = [];
    sessionsLoaded.value = false;
    sessionsLoading.value = false;
    creatingSession.value = false;
    listError.value = null;
  }

  return {
    sessions,
    sessionsLoaded,
    sessionsLoading,
    creatingSession,
    conversations,
    emptyConversation,
    listError,
    activeConversation,
    sessionLoading,
    activeSessionId,
    activeSession,
    messages,
    sending,
    savingArticleMessageId,
    error,
    draft,
    scrollTop,
    loadSessions,
    ensureLoaded,
    createSession,
    selectSession,
    deleteSession,
    startNewSession,
    send,
    saveArticle,
    clearError,
    reset,
  };
});
