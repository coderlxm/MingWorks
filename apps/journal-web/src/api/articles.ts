import type {
  JournalArticleAssetResponse,
  JournalEntry,
  JournalRichDocument,
} from '../types';
import { requestJson, requestWithoutResponse, jsonRequest } from './client';

type ArticleInput = { title: string; richBody: JournalRichDocument; tags: string[]; aiGenerated: boolean };

export function createArticleDraft(input: ArticleInput): Promise<JournalEntry> {
  return requestJson('/api/me/articles/drafts', jsonRequest('POST', input));
}
export function fetchArticleDrafts(): Promise<{ articles: JournalEntry[] }> {
  return requestJson('/api/me/articles/drafts');
}
export function deleteArticleDraft(id: number): Promise<void> {
  return requestWithoutResponse(`/api/me/articles/drafts/${id}`, { method: 'DELETE' });
}
export function completeArticle(id: number, input: ArticleInput): Promise<JournalEntry> {
  return requestJson(`/api/me/articles/${id}/complete`, jsonRequest('POST', input));
}
export async function importArticleMarkdown(markdown: string, imageAliases: Record<string, string> = {}): Promise<JournalRichDocument> {
  const result = await requestJson<{ document: JournalRichDocument }>('/api/me/articles/content/import', jsonRequest('POST', { markdown, imageAliases }));
  return result.document;
}
export async function exportArticleMarkdown(document: JournalRichDocument, mode: 'faithful' | 'gfm'): Promise<string> {
  const result = await requestJson<{ markdown: string }>('/api/me/articles/content/export', jsonRequest('POST', { document, mode }));
  return result.markdown;
}

export function fetchArticle(id: number): Promise<JournalEntry> {
  return requestJson<JournalEntry>(`/api/me/articles/${id}`);
}

export function createArticle(input: {
  title: string;
  richBody: JournalRichDocument;
  tags: string[];
  aiGenerated: boolean;
}): Promise<JournalEntry> {
  return requestJson<JournalEntry>('/api/me/articles', jsonRequest('POST', input));
}

export function updateArticle(id: number, input: {
  title: string;
  richBody: JournalRichDocument;
  tags: string[];
  aiGenerated: boolean;
}): Promise<JournalEntry> {
  return requestJson<JournalEntry>(
    `/api/me/articles/${id}`,
    jsonRequest('PATCH', input),
  );
}

export function uploadArticleAsset(
  id: number,
  file: File,
  role: 'cover' | 'inline',
): Promise<JournalArticleAssetResponse> {
  const form = new FormData();
  form.append('role', role);
  form.append('file', file);
  return requestJson<JournalArticleAssetResponse>(
    `/api/me/articles/${id}/assets`,
    { method: 'POST', body: form },
  );
}

export function deleteArticleAsset(id: number, assetId: number): Promise<void> {
  return requestWithoutResponse(`/api/me/articles/${id}/assets/${assetId}`, { method: 'DELETE' });
}
