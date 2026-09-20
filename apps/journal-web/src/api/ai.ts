import { EventSourceParserStream } from 'eventsource-parser/stream';
import type {
  AiMessage,
  AiSessionDetail,
  AiSessionSummary,
  AiSaveArticleResponse,
  AiStreamEvent,
} from '../types';
import { JournalRequestError, jsonRequest, requestJson } from './client';

export function fetchAiSessions(): Promise<{ sessions: AiSessionSummary[] }> {
  return requestJson<{ sessions: AiSessionSummary[] }>('/api/me/ai/sessions');
}

export function createAiSession(): Promise<AiSessionSummary> {
  return requestJson<AiSessionSummary>('/api/me/ai/sessions', { method: 'POST' });
}

export function fetchAiSession(id: number): Promise<AiSessionDetail> {
  return requestJson<AiSessionDetail>(`/api/me/ai/sessions/${id}`);
}

export function deleteAiSession(id: number): Promise<void> {
  return requestJson<{ ok: true }>(`/api/me/ai/sessions/${id}`, { method: 'DELETE' })
    .then(() => undefined);
}

export async function streamAiMessage(
  sessionId: number,
  content: string,
  options: {
    signal: AbortSignal;
    onEvent: (event: AiStreamEvent) => void;
  },
): Promise<void> {
  const response = await fetch(`/api/me/ai/sessions/${sessionId}/messages`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
    signal: options.signal,
  });
  if (response.ok === false) {
    const body = await response.json() as { error: string };
    throw new JournalRequestError(response.status, body.error);
  }
  if (response.body === null) {
    throw new Error('浏览器没有提供流式响应体。');
  }

  const eventStream = response.body
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new EventSourceParserStream({ onError: 'terminate' }));
  const reader = eventStream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const parsed = JSON.parse(value.data) as { type?: unknown };
      if (
        typeof parsed !== 'object'
        || parsed === null
        || typeof parsed.type !== 'string'
      ) {
        throw new Error('AI 流事件格式无效。');
      }
      options.onEvent(parsed as AiStreamEvent);
    }
  }
  finally {
    reader.releaseLock();
  }
}

export function stopAiMessage(sessionId: number, messageId: number): Promise<AiMessage> {
  return requestJson<AiMessage>(
    `/api/me/ai/sessions/${sessionId}/messages/${messageId}/stop`,
    { method: 'POST' },
  );
}

export function saveAiMessageAsArticle(messageId: number): Promise<AiSaveArticleResponse> {
  return requestJson<AiSaveArticleResponse>(
    `/api/me/ai/messages/${messageId}/save-article`,
    jsonRequest('POST', {}),
  );
}
