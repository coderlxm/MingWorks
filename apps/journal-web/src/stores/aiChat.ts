import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';
import {
  createAiSession,
  deleteAiSession,
  fetchAiSession,
  fetchAiSessions,
  saveAiMessageAsArticle,
  stopAiMessage,
  streamAiMessage,
} from '../api';
import type {
  AiMessage,
  AiSessionSummary,
  AiStreamEvent,
  AiStreamPhaseState,
  AiStreamRound,
} from '../types';

let nextTempMessageId = -1;

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

function tempMessageId(): number {
  const id = nextTempMessageId;
  nextTempMessageId -= 1;
  return id;
}

function messageIdFor(messageId: number, realIds: Map<number, number>): number {
  return realIds.get(messageId) ?? messageId;
}

export const useAiChatStore = defineStore('aiChat', () => {
  const sessions = ref<AiSessionSummary[]>([]);
  const sessionsLoaded = shallowRef(false);
  const sessionsLoading = shallowRef(false);
  const sessionLoading = shallowRef(false);
  const creatingSession = shallowRef(false);
  const activeSessionId = shallowRef<number | null>(null);
  const conversationStates = ref<Record<number, { sessionId: number; loaded: boolean }>>({});
  const sessionMessages = ref<Record<number, AiMessage[]>>({});
  const streamRounds = ref<Record<number, AiStreamRound[]>>({});
  const streamPhases = ref<Record<number, AiStreamPhaseState>>({});
  const activeSessionIds = ref<Set<number>>(new Set());
  const streamingMessageIds = ref<Set<number>>(new Set());
  const stoppingMessageIds = ref<Set<number>>(new Set());
  const savingArticleMessageId = shallowRef<number | null>(null);
  const error = shallowRef<string | null>(null);
  const draft = ref('');
  const scrollPositions = ref<Record<number, number>>({});
  const controllers = new Map<number, AbortController>();
  const realAssistantIds = new Map<number, number>();
  const sessionLoads = new Map<number, Promise<void>>();
  let stateEpoch = 0;
  let sessionListRequest = 0;

  const messages = computed(() => {
    const sessionId = activeSessionId.value;
    if (sessionId === null) return [];
    return sessionMessages.value[sessionId] ?? [];
  });

  const sending = computed(() => {
    const sessionId = activeSessionId.value;
    if (sessionId === null) return false;
    return activeSessionIds.value.has(sessionId);
  });

  const activeSession = computed(() =>
    sessions.value.find((session) => session.id === activeSessionId.value) ?? null,
  );

  const activeConversation = computed(() => {
    const sessionId = activeSessionId.value;
    if (sessionId === null) return { sessionId: 0, loaded: true };
    return conversationStates.value[sessionId] ?? { sessionId, loaded: false };
  });

  const scrollTop = computed({
    get: () => {
      const sessionId = activeSessionId.value;
      if (sessionId === null) return 0;
      return scrollPositions.value[sessionId] ?? 0;
    },
    set: (value: number) => {
      const sessionId = activeSessionId.value;
      if (sessionId === null) return;
      scrollPositions.value = { ...scrollPositions.value, [sessionId]: value };
    },
  });

  function setError(reason: unknown): void {
    error.value = errorMessage(reason);
  }

  function clearError(): void {
    error.value = null;
  }

  function getSessionMessages(sessionId: number): AiMessage[] {
    return sessionMessages.value[sessionId] ?? [];
  }

  function setSessionMessages(sessionId: number, next: AiMessage[]): void {
    sessionMessages.value = { ...sessionMessages.value, [sessionId]: next };
  }

  function setConversationLoaded(sessionId: number, loaded: boolean): void {
    conversationStates.value = { ...conversationStates.value, [sessionId]: { sessionId, loaded } };
  }

  function updateSessionMessages(
    sessionId: number,
    updater: (current: AiMessage[]) => AiMessage[],
  ): void {
    setSessionMessages(sessionId, updater(getSessionMessages(sessionId)));
  }

  function updateMessage(
    sessionId: number,
    messageId: number,
    updater: (message: AiMessage) => AiMessage,
  ): void {
    updateSessionMessages(sessionId, (current) => current.map((message) =>
      message.id === messageId ? updater(message) : message,
    ));
  }

  function markStreaming(messageId: number, streaming: boolean): void {
    const next = new Set(streamingMessageIds.value);
    if (streaming) next.add(messageId);
    else next.delete(messageId);
    streamingMessageIds.value = next;
  }

  function markStopping(messageId: number, stopping: boolean): void {
    const next = new Set(stoppingMessageIds.value);
    if (stopping) next.add(messageId);
    else next.delete(messageId);
    stoppingMessageIds.value = next;
  }

  function markSessionActive(sessionId: number, active: boolean): void {
    const next = new Set(activeSessionIds.value);
    if (active) next.add(sessionId);
    else next.delete(sessionId);
    activeSessionIds.value = next;
  }

  function setRounds(messageId: number, rounds: AiStreamRound[]): void {
    streamRounds.value = { ...streamRounds.value, [messageId]: rounds };
  }

  function clearRounds(messageId: number): void {
    const next = { ...streamRounds.value };
    Reflect.deleteProperty(next, messageId);
    streamRounds.value = next;
  }

  function setPhase(messageId: number, phase: AiStreamPhaseState): void {
    streamPhases.value = { ...streamPhases.value, [messageId]: phase };
  }

  function clearPhase(messageId: number): void {
    const next = { ...streamPhases.value };
    Reflect.deleteProperty(next, messageId);
    streamPhases.value = next;
  }

  function roundsFor(messageId: number): AiStreamRound[] {
    return streamRounds.value[messageId] ?? [];
  }

  function phaseFor(messageId: number): AiStreamPhaseState | null {
    return streamPhases.value[messageId] ?? null;
  }

  function isMessageStreaming(messageId: number): boolean {
    return streamingMessageIds.value.has(messageId);
  }

  function isMessageStopping(messageId: number): boolean {
    return stoppingMessageIds.value.has(messageId);
  }

  function isSessionSending(sessionId: number): boolean {
    return activeSessionIds.value.has(sessionId);
  }

  async function loadSessions(): Promise<void> {
    const requestEpoch = stateEpoch;
    const requestId = ++sessionListRequest;
    sessionsLoading.value = true;
    try {
      const response = await fetchAiSessions();
      if (requestEpoch !== stateEpoch || requestId !== sessionListRequest) return;
      sessions.value = response.sessions;
      sessionsLoaded.value = true;
    }
    catch (reason) {
      if (requestEpoch === stateEpoch && requestId === sessionListRequest) setError(reason);
    }
    finally {
      if (requestEpoch === stateEpoch && requestId === sessionListRequest) sessionsLoading.value = false;
    }
  }

  async function ensureLoaded(): Promise<void> {
    if (sessionsLoaded.value) return;
    await loadSessions();
  }

  async function createSession(): Promise<AiSessionSummary | null> {
    if (creatingSession.value) return null;
    const requestEpoch = stateEpoch;
    sessionListRequest += 1;
    sessionsLoading.value = false;
    clearError();
    creatingSession.value = true;
    try {
      const session = await createAiSession();
      if (requestEpoch !== stateEpoch) return null;
      sessions.value = [session, ...sessions.value];
      activeSessionId.value = session.id;
      setSessionMessages(session.id, []);
      setConversationLoaded(session.id, true);
      scrollTop.value = 0;
      return session;
    }
    catch (reason) {
      if (requestEpoch === stateEpoch) setError(reason);
      return null;
    }
    finally {
      if (requestEpoch === stateEpoch) creatingSession.value = false;
    }
  }

  async function selectSession(id: number): Promise<void> {
    activeSessionId.value = id;
    clearError();
    if (Object.prototype.hasOwnProperty.call(sessionMessages.value, id)) {
      setConversationLoaded(id, true);
      sessionLoading.value = false;
      return;
    }
    sessionLoading.value = true;
    const pending = sessionLoads.get(id);
    if (pending !== undefined) {
      await pending;
      return;
    }
    const requestEpoch = stateEpoch;
    const request: Promise<void> = (async () => {
      try {
        const detail = await fetchAiSession(id);
        if (requestEpoch !== stateEpoch || sessionLoads.get(id) !== request) return;
        setSessionMessages(id, detail.messages);
        setConversationLoaded(id, true);
        sessions.value = sessions.value.map((session) =>
          session.id === id ? detail.session : session,
        );
      }
      catch (reason) {
        if (requestEpoch === stateEpoch && activeSessionId.value === id) setError(reason);
      }
      finally {
        if (requestEpoch === stateEpoch && sessionLoads.get(id) === request) {
          sessionLoads.delete(id);
          if (activeSessionId.value === id) sessionLoading.value = false;
        }
      }
    })();
    sessionLoads.set(id, request);
    await request;
  }

  async function deleteSession(id: number): Promise<void> {
    const requestEpoch = stateEpoch;
    if (activeSessionIds.value.has(id)) {
      setError('请先停止当前生成，再删除这个会话。');
      return;
    }
    clearError();
    try {
      await deleteAiSession(id);
      if (requestEpoch !== stateEpoch) return;
      sessionListRequest += 1;
      sessionsLoading.value = false;
      sessionLoads.delete(id);
      sessions.value = sessions.value.filter((session) => session.id === id ? false : true);
      const nextMessages = { ...sessionMessages.value };
      Reflect.deleteProperty(nextMessages, id);
      sessionMessages.value = nextMessages;
      const nextConversations = { ...conversationStates.value };
      Reflect.deleteProperty(nextConversations, id);
      conversationStates.value = nextConversations;
      const nextScrollPositions = { ...scrollPositions.value };
      Reflect.deleteProperty(nextScrollPositions, id);
      scrollPositions.value = nextScrollPositions;
      if (activeSessionId.value === id) {
        sessionLoading.value = false;
        activeSessionId.value = null;
        draft.value = '';
        scrollTop.value = 0;
      }
    }
    catch (reason) {
      if (requestEpoch === stateEpoch) setError(reason);
    }
  }

  async function startNewSession(): Promise<void> {
    const current = activeSession.value;
    if (current !== null && current.title === '新对话' && messages.value.length === 0) {
      draft.value = '';
      return;
    }
    await createSession();
  }

  async function send(content: string): Promise<void> {
    const requestEpoch = stateEpoch;
    const trimmed = content.trim();
    if (trimmed === '' || sending.value || sessionLoading.value || creatingSession.value) return;
    clearError();

    let sessionId = activeSessionId.value;
    if (sessionId === null) {
      const created = await createSession();
      if (created === null || requestEpoch !== stateEpoch) return;
      sessionId = created.id;
    }
    if (activeSessionIds.value.has(sessionId)) return;

    const now = new Date().toISOString();
    const userTempId = tempMessageId();
    const assistantTempId = tempMessageId();
    const userTemp: AiMessage = {
      id: userTempId,
      sessionId,
      position: getSessionMessages(sessionId).length + 1,
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
      id: assistantTempId,
      sessionId,
      position: userTemp.position + 1,
      role: 'assistant',
      content: '',
      sources: [],
      status: 'pending',
      error: null,
      articleId: null,
      articleTitle: null,
      createdAt: now,
      updatedAt: now,
    };
    setSessionMessages(sessionId, [...getSessionMessages(sessionId), userTemp, assistantTemp]);
    setRounds(assistantTempId, []);
    markStreaming(assistantTempId, true);
    markSessionActive(sessionId, true);
    draft.value = '';
    const controller = new AbortController();
    controllers.set(sessionId, controller);

    try {
      await streamAiMessage(sessionId, trimmed, {
        signal: controller.signal,
        onEvent: (event) => {
          if (requestEpoch === stateEpoch) {
            handleStreamEvent(sessionId, userTempId, assistantTempId, event);
          }
        },
      });
    }
    catch (reason) {
      controller.abort();
      if (requestEpoch === stateEpoch) {
        failLocalStream(sessionId, assistantTempId, reason);
      }
    }
    finally {
      if (controllers.get(sessionId) === controller) controllers.delete(sessionId);
      if (requestEpoch === stateEpoch) {
        markSessionActive(sessionId, false);
        finalizePendingStream(sessionId, assistantTempId);
        const realAssistantId = realAssistantIds.get(assistantTempId);
        if (realAssistantId !== undefined) markStreaming(realAssistantId, false);
        markStreaming(assistantTempId, false);
        void loadSessions();
      }
      realAssistantIds.delete(assistantTempId);
    }
  }

  function handleStreamEvent(
    sessionId: number,
    userTempId: number,
    assistantTempId: number,
    event: AiStreamEvent,
  ): void {
    if (event.type === 'started') {
      applyStarted(sessionId, userTempId, assistantTempId, event);
      return;
    }
    const messageId = messageIdFor(assistantTempId, realAssistantIds);
    const currentMessage = getSessionMessages(sessionId).find((message) => message.id === messageId);
    if (currentMessage?.status !== 'pending') return;
    if (event.type === 'round-start') {
      const rounds = roundsFor(messageId);
      if (rounds.some((round) => round.round === event.round)) return;
      setRounds(messageId, [
        ...rounds,
        { round: event.round, kind: 'pending', text: '' },
      ]);
      return;
    }
    if (event.type === 'text-delta') {
      const rounds = roundsFor(messageId).map((round) =>
        round.round === event.round
          ? { ...round, text: round.text + event.delta }
          : round,
      );
      setRounds(messageId, rounds);
      return;
    }
    if (event.type === 'round-end') {
      const rounds = roundsFor(messageId).map((round) =>
        round.round === event.round ? { ...round, kind: event.kind } : round,
      );
      setRounds(messageId, rounds);
      return;
    }
    if (event.type === 'phase') {
      setPhase(messageId, { phase: event.phase, count: event.count });
      return;
    }
    if (event.type === 'completed') {
      updateMessage(sessionId, event.message.id, () => event.message);
      clearRounds(event.message.id);
      clearPhase(event.message.id);
      markStreaming(event.message.id, false);
      return;
    }
    if (event.type === 'interrupted') {
      updateMessage(sessionId, event.messageId, (message) => ({
        ...message,
        content: event.content,
        status: 'failed',
        error: event.reason,
      }));
      clearRounds(event.messageId);
      clearPhase(event.messageId);
      markStreaming(event.messageId, false);
    }
  }

  function applyStarted(
    sessionId: number,
    userTempId: number,
    assistantTempId: number,
    event: Extract<AiStreamEvent, { type: 'started' }>,
  ): void {
    const current = getSessionMessages(sessionId);
    const next = current.map((message) => {
      if (message.id === userTempId) return event.userMessage;
      if (message.id === assistantTempId) {
        return {
          ...event.assistantMessage,
          content: '',
          status: 'pending',
          error: null,
          sources: [],
          articleId: null,
        };
      }
      return message;
    });
    setSessionMessages(sessionId, next);
    realAssistantIds.set(assistantTempId, event.assistantMessage.id);
    markStreaming(assistantTempId, false);
    markStreaming(event.assistantMessage.id, true);
    setRounds(event.assistantMessage.id, roundsFor(assistantTempId));
    clearRounds(assistantTempId);
    const phase = phaseFor(assistantTempId);
    if (phase !== null) {
      setPhase(event.assistantMessage.id, phase);
      clearPhase(assistantTempId);
    }
  }

  function collectRoundText(messageId: number): string {
    return roundsFor(messageId).map((round) => round.text).join('').trim();
  }

  function failLocalStream(sessionId: number, assistantTempId: number, reason: unknown): void {
    const messageId = messageIdFor(assistantTempId, realAssistantIds);
    const message = getSessionMessages(sessionId).find((entry) => entry.id === messageId);
    if (message?.status !== 'pending') return;
    const content = collectRoundText(messageId);
    updateMessage(sessionId, messageId, (message) => ({
      ...message,
      content,
      status: 'failed',
      error: errorMessage(reason),
    }));
    clearRounds(messageId);
    clearPhase(messageId);
    markStreaming(messageId, false);
  }

  function finalizePendingStream(sessionId: number, assistantTempId: number): void {
    const messageId = messageIdFor(assistantTempId, realAssistantIds);
    const message = getSessionMessages(sessionId).find((entry) => entry.id === messageId);
    if (message !== undefined && message.status === 'pending') {
      failLocalStream(sessionId, assistantTempId, new Error('没有收到完成确认。'));
    }
  }

  async function stop(sessionId: number, messageId: number): Promise<void> {
    const requestEpoch = stateEpoch;
    const controller = controllers.get(sessionId);
    markStopping(messageId, true);
    clearError();
    try {
      const message = await stopAiMessage(sessionId, messageId);
      if (requestEpoch !== stateEpoch) return;
      updateMessage(sessionId, messageId, () => message);
      clearRounds(messageId);
      clearPhase(messageId);
      markStreaming(messageId, false);
      controller?.abort();
    }
    catch (reason) {
      if (requestEpoch === stateEpoch) setError(reason);
    }
    finally {
      if (requestEpoch === stateEpoch) markStopping(messageId, false);
    }
  }

  async function saveArticle(messageId: number): Promise<number | null> {
    const requestEpoch = stateEpoch;
    const sessionId = activeSessionId.value;
    savingArticleMessageId.value = messageId;
    clearError();
    try {
      const response = await saveAiMessageAsArticle(messageId);
      if (requestEpoch !== stateEpoch) return null;
      if (sessionId !== null) {
        updateMessage(sessionId, messageId, (message) => ({
          ...message,
          articleId: response.article.id,
        }));
      }
      return response.article.id;
    }
    catch (reason) {
      if (requestEpoch === stateEpoch) setError(reason);
      return null;
    }
    finally {
      if (requestEpoch === stateEpoch) savingArticleMessageId.value = null;
    }
  }

  function reset(): void {
    stateEpoch += 1;
    controllers.forEach((controller) => controller.abort());
    controllers.clear();
    sessionLoads.clear();
    sessions.value = [];
    sessionsLoaded.value = false;
    sessionsLoading.value = false;
    sessionLoading.value = false;
    activeSessionId.value = null;
    creatingSession.value = false;
    conversationStates.value = {};
    scrollPositions.value = {};
    sessionMessages.value = {};
    streamRounds.value = {};
    streamPhases.value = {};
    activeSessionIds.value = new Set();
    streamingMessageIds.value = new Set();
    stoppingMessageIds.value = new Set();
    savingArticleMessageId.value = null;
    error.value = null;
    draft.value = '';
    scrollTop.value = 0;
    realAssistantIds.clear();
  }

  return {
    sessions,
    sessionsLoaded,
    sessionsLoading,
    sessionLoading,
    activeSessionId,
    activeSession,
    activeConversation,
    messages,
    creatingSession,
    sending,
    savingArticleMessageId,
    error,
    draft,
    scrollTop,
    isMessageStreaming,
    isMessageStopping,
    isSessionSending,
    roundsFor,
    phaseFor,
    loadSessions,
    ensureLoaded,
    createSession,
    selectSession,
    deleteSession,
    startNewSession,
    send,
    stop,
    saveArticle,
    clearError,
    reset,
  };
});
