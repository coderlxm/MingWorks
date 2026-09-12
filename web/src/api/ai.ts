import type {
  AiSessionDetail,
  AiSessionSummary,
  AiSendMessageResponse,
  AiSaveArticleResponse,
} from '../types';
import { jsonRequest, requestJson } from './client';

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

export function sendAiMessage(sessionId: number, content: string): Promise<AiSendMessageResponse> {
  return requestJson<AiSendMessageResponse>(
    `/api/me/ai/sessions/${sessionId}/messages`,
    jsonRequest('POST', { content }),
  );
}

export function saveAiMessageAsArticle(messageId: number): Promise<AiSaveArticleResponse> {
  return requestJson<AiSaveArticleResponse>(
    `/api/me/ai/messages/${messageId}/save-article`,
    { method: 'POST' },
  );
}
