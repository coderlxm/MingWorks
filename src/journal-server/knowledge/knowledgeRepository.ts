import type Database from 'better-sqlite3';
import { z } from 'zod';
import { extractContentText } from '../articles/richText.js';
import { parseJournalInternalImageId } from '../../shared/journalContentPolicy.js';
import type { JournalRichDocument } from '../../shared/journalProtocol.js';
import {
  journalAiSourceSchema,
  type JournalAiMessage,
  type JournalAiMessageRole,
  type JournalAiSessionDetail,
  type JournalAiSessionSummary,
  type JournalAiSource,
} from '../../shared/journalProtocol.js';

interface AiSessionRow {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

interface AiMessageRow {
  id: number;
  session_id: number;
  position: number;
  role: JournalAiMessageRole;
  content: string;
  status: JournalAiMessage['status'];
  error: string | null;
  sources_json: string;
  article_id: number | null;
  article_title: string | null;
  created_at: string;
  updated_at: string;
}

interface KnowledgeEntryRow {
  id: number;
  public_id: string;
  title: string | null;
  content_text: string;
  content_type: string;
  body_format: 'plain' | 'rich';
  tags_json: string;
  source_created_at: string;
  updated_at: string;
  publication_status: 'draft' | 'published';
}

export interface JournalAiExchange {
  userMessage: JournalAiMessage;
  assistantMessage: JournalAiMessage;
}

export interface KnowledgeSearchInput {
  keywords: string[];
  tags: string[];
  from: string | null;
  to: string | null;
  offset: number;
  limit: number;
}

export interface KnowledgeSearchResult {
  entryId: number;
  publicId: string;
  title: string | null;
  sourceCreatedAt: string;
  updatedAt: string;
  tags: string[];
  contentType: string;
  bodyFormat: 'plain' | 'rich';
  excerpt: string;
}

export interface KnowledgeSearchPage {
  offset: number;
  limit: number;
  hasMore: boolean;
  results: KnowledgeSearchResult[];
}

export interface KnowledgeReadResult {
  images: Array<{ assetId: number | null; url: string; alt: string; caption: string; width: number | null; height: number | null }>;
  entryId: number;
  publicId: string;
  title: string | null;
  sourceCreatedAt: string;
  updatedAt: string;
  tags: string[];
  contentType: string;
  bodyFormat: 'plain' | 'rich';
  text: string;
  offset: number;
  end: number;
  totalLength: number;
  complete: boolean;
  nextOffset: number | null;
}

const messageSourcesSchema = z.array(journalAiSourceSchema);


function shanghaiDayStart(date: string): string {
  return new Date(`${date}T00:00:00+08:00`).toISOString();
}

function shanghaiDayEnd(date: string): string {
  return new Date(`${date}T23:59:59.999+08:00`).toISOString();
}

function excerptFor(contentText: string, keywords: string[]): string {
  const normalized = contentText.trim().replace(/\s+/gu, ' ');
  if (normalized === '') return '';
  const characters = [...normalized];
  const excerptLength = 160;
  if (characters.length <= excerptLength) return normalized;

  const lowerContent = normalized.toLocaleLowerCase();
  const matchIndex = keywords
    .map((keyword) => lowerContent.indexOf(keyword.toLocaleLowerCase()))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0] ?? 0;
  const start = Math.max(0, Math.min(matchIndex - 40, characters.length - excerptLength + 1));
  let end = Math.min(characters.length, start + excerptLength);
  const hasPrefix = start > 0;
  const hasSuffix = end < characters.length;
  if (hasSuffix) end -= 1;
  const available = excerptLength - (hasPrefix ? 1 : 0);
  end = Math.min(end, start + available - (hasSuffix ? 1 : 0));
  return `${hasPrefix ? '…' : ''}${characters.slice(start, end).join('')}${hasSuffix ? '…' : ''}`;
}

export class JournalKnowledgeRepository {
  constructor(private readonly database: Database.Database) {}

  createSession(): JournalAiSessionSummary {
    const now = new Date().toISOString();
    const result = this.database.prepare(`
      INSERT INTO journal_ai_sessions (title, created_at, updated_at)
      VALUES ('新对话', ?, ?)
    `).run(now, now);
    return this.getSessionSummary(Number(result.lastInsertRowid));
  }

  listSessions(): JournalAiSessionSummary[] {
    const rows = this.database.prepare(
      'SELECT id, title, created_at, updated_at FROM journal_ai_sessions ORDER BY updated_at DESC, id DESC',
    ).all() as AiSessionRow[];
    return rows.map((row) => this.toSessionSummary(row));
  }

  getSession(id: number): JournalAiSessionDetail | null {
    const row = this.database.prepare(
      'SELECT id, title, created_at, updated_at FROM journal_ai_sessions WHERE id = ?',
    ).get(id) as AiSessionRow | undefined;
    if (row === undefined) return null;
    const messages = this.database.prepare(
      'SELECT * FROM journal_ai_messages WHERE session_id = ? ORDER BY position ASC, id ASC',
    ).all(id) as AiMessageRow[];
    return {
      session: this.toSessionSummary(row),
      messages: messages.map((message) => this.toMessage(message)),
    };
  }

  deleteSession(id: number): boolean {
    const result = this.database.prepare('DELETE FROM journal_ai_sessions WHERE id = ?').run(id);
    return result.changes > 0;
  }

  startExchange(sessionId: number, content: string): JournalAiExchange | null {
    const exchange = this.database.transaction(() => {
      const session = this.database.prepare(
        'SELECT id, title, created_at, updated_at FROM journal_ai_sessions WHERE id = ?',
      ).get(sessionId) as AiSessionRow | undefined;
      if (session === undefined) return null;

      const positionRow = this.database.prepare(
        'SELECT COALESCE(MAX(position), 0) + 1 AS position FROM journal_ai_messages WHERE session_id = ?',
      ).get(sessionId) as { position: number };
      const now = new Date().toISOString();
      const userResult = this.database.prepare(
        'INSERT INTO journal_ai_messages (session_id, position, role, content, status, error, sources_json, article_id, article_title, created_at, updated_at) VALUES (?, ?, \'user\', ?, \'completed\', NULL, \'[]\', NULL, NULL, ?, ?)',
      ).run(sessionId, positionRow.position, content, now, now);
      const assistantResult = this.database.prepare(
        'INSERT INTO journal_ai_messages (session_id, position, role, content, status, error, sources_json, article_id, article_title, created_at, updated_at) VALUES (?, ?, \'assistant\', \'\', \'pending\', NULL, \'[]\', NULL, NULL, ?, ?)',
      ).run(sessionId, positionRow.position + 1, now, now);

      if (session.title === '新对话') {
        const title = [...content.trim().replace(/\s+/gu, ' ')].slice(0, 30).join('');
        this.database.prepare(
          'UPDATE journal_ai_sessions SET title = ?, updated_at = ? WHERE id = ?',
        ).run(title || '新对话', now, sessionId);
      }
      else {
        this.database.prepare(
          'UPDATE journal_ai_sessions SET updated_at = ? WHERE id = ?',
        ).run(now, sessionId);
      }

      const userMessage = this.getMessageById(Number(userResult.lastInsertRowid));
      const assistantMessage = this.getMessageById(Number(assistantResult.lastInsertRowid));
      if (userMessage === null || assistantMessage === null) {
        throw new Error(`AI exchange for session ${sessionId} could not be reloaded.`);
      }
      return { userMessage, assistantMessage };
    });
    return exchange();
  }

  completeMessage(
    id: number,
    content: string,
    sources: JournalAiSource[],
  ): JournalAiMessage | null {
    const now = new Date().toISOString();
    const result = this.database.prepare(
      'UPDATE journal_ai_messages SET content = ?, sources_json = ?, status = \'completed\', error = NULL, updated_at = ? WHERE id = ? AND role = \'assistant\'',
    ).run(content, JSON.stringify(sources), now, id);
    if (result.changes === 0) return null;
    return this.getMessage(id);
  }

  failMessage(id: number, error: string, content: string): void {
    const now = new Date().toISOString();
    this.database.prepare(
      'UPDATE journal_ai_messages SET content = ?, status = \'failed\', error = ?, updated_at = ? WHERE id = ? AND role = \'assistant\'',
    ).run(content, error, now, id);
  }

  getMessage(id: number): JournalAiMessage | null {
    return this.getMessageById(id);
  }

  listContextMessages(
    sessionId: number,
    beforePosition: number,
    limit: number,
  ): JournalAiMessage[] {
    const rows = this.database.prepare(
      `SELECT m.* FROM journal_ai_messages m
       JOIN journal_ai_messages partner
         ON partner.session_id = m.session_id
        AND partner.position = m.position + CASE WHEN m.role = 'user' THEN 1 ELSE -1 END
        AND partner.status = 'completed'
       WHERE m.session_id = ? AND m.position < ? AND m.status = 'completed'
       ORDER BY m.position DESC, m.id DESC LIMIT ?`,
    ).all(sessionId, beforePosition, limit) as AiMessageRow[];
    return rows.reverse().map((row) => this.toMessage(row));
  }

  searchEntries(input: KnowledgeSearchInput): KnowledgeSearchPage {
    if (input.keywords.length === 0) {
      return { offset: input.offset, limit: input.limit, hasMore: false, results: [] };
    }

    const conditions = [
      this.groupRepresentativeCondition('e'),
      "e.publication_status = 'published'",
    ];
    const whereParameters: unknown[] = [];
    const matchClauses: string[] = [];
    for (const keyword of input.keywords) {
      const like = this.likePattern(keyword);
      matchClauses.push("(e.title LIKE ? ESCAPE '~' OR e.content_text LIKE ? ESCAPE '~' OR EXISTS (SELECT 1 FROM json_each(e.tags_json) WHERE value LIKE ? ESCAPE '~'))");
      whereParameters.push(like, like, like);
    }
    conditions.push(`(${matchClauses.join(' OR ')})`);

    for (const tag of input.tags) {
      conditions.push('EXISTS (SELECT 1 FROM json_each(e.tags_json) WHERE value = ?)');
      whereParameters.push(tag);
    }
    if (input.from !== null) {
      conditions.push('e.source_created_at >= ?');
      whereParameters.push(input.from);
    }
    if (input.to !== null) {
      conditions.push('e.source_created_at <= ?');
      whereParameters.push(input.to);
    }

    const scoreParts: string[] = [];
    const scoreParameters: unknown[] = [];
    for (const keyword of input.keywords) {
      const like = this.likePattern(keyword);
      scoreParts.push("((CASE WHEN e.title LIKE ? ESCAPE '~' THEN 3 ELSE 0 END) + (CASE WHEN EXISTS (SELECT 1 FROM json_each(e.tags_json) WHERE value LIKE ? ESCAPE '~') THEN 2 ELSE 0 END) + (CASE WHEN e.content_text LIKE ? ESCAPE '~' THEN 1 ELSE 0 END))");
      scoreParameters.push(like, like, like);
    }

    const rows = this.database.prepare(
      `SELECT e.*, (${scoreParts.join(' + ')}) AS relevance FROM journal_entries e WHERE ${conditions.join(' AND ')} ORDER BY relevance DESC, e.source_created_at DESC, e.id DESC LIMIT ? OFFSET ?`,
    ).all(
      ...scoreParameters,
      ...whereParameters,
      input.limit + 1,
      input.offset,
    ) as Array<KnowledgeEntryRow & { relevance: number }>;

    const hasMore = rows.length > input.limit;
    return {
      offset: input.offset,
      limit: input.limit,
      hasMore,
      results: rows.slice(0, input.limit).map((row) => ({
        entryId: row.id,
        publicId: row.public_id,
        title: row.title,
        sourceCreatedAt: row.source_created_at,
        updatedAt: row.updated_at,
        tags: z.array(z.string()).parse(JSON.parse(row.tags_json)),
        contentType: row.content_type,
        bodyFormat: row.body_format,
        excerpt: excerptFor(row.content_text, input.keywords),
      })),
    };
  }

  readEntry(id: number, offset: number, length: number): KnowledgeReadResult | null {
    const row = this.database.prepare(
      'SELECT id, public_id, title, content_text, rich_body_json, content_type, body_format, tags_json, source_created_at, updated_at, publication_status FROM journal_entries WHERE id = ? AND publication_status = \'published\'',
    ).get(id) as (KnowledgeEntryRow & { rich_body_json: string | null }) | undefined;
    if (row === undefined) return null;

    const body = row.rich_body_json === null ? null : JSON.parse(row.rich_body_json) as JournalRichDocument;
    const images: KnowledgeReadResult['images'] = [];
    const owned = this.database.prepare("SELECT id, original_name, width, height FROM journal_assets WHERE entry_id = ? AND kind IN ('photo', 'animation') ORDER BY sort_order, id")
      .all(id) as Array<{ id: number; original_name: string | null; width: number | null; height: number | null }>;
    const visit = (nodes: JournalRichDocument['content']): void => {
      for (const node of nodes) {
        if (node.type === 'image' && typeof node.attrs?.src === 'string') {
          const assetId = parseJournalInternalImageId(node.attrs.src);
          if (assetId !== null && !owned.some(asset => asset.id === assetId)) throw new Error(`Article ${id} contains an image owned by another entry.`);
          images.push({ assetId, url: node.attrs.src, alt: String(node.attrs.alt ?? ''), caption: String(node.attrs.caption ?? ''),
            width: typeof node.attrs.width === 'number' ? node.attrs.width : null, height: typeof node.attrs.height === 'number' ? node.attrs.height : null });
        }
        if (node.content) visit(node.content);
      }
    };
    if (body) visit(body.content);
    else for (const asset of owned) images.push({ assetId: asset.id, url: `/media/${asset.id}`, alt: asset.original_name ?? '', caption: '', width: asset.width, height: asset.height });
    const characters = [...(body ? extractContentText(body) : row.content_text)];
    const totalLength = characters.length;
    const start = Math.max(0, Math.min(offset, totalLength));
    const end = Math.min(totalLength, start + length);
    return {
      entryId: row.id,
      publicId: row.public_id,
      title: row.title,
      sourceCreatedAt: row.source_created_at,
      updatedAt: row.updated_at,
      tags: z.array(z.string()).parse(JSON.parse(row.tags_json)),
      contentType: row.content_type,
      bodyFormat: row.body_format,
      text: characters.slice(start, end).join(''),
      images,
      offset: start,
      end,
      totalLength,
      complete: end >= totalLength,
      nextOffset: end < totalLength ? end : null,
    };
  }

  toSearchDateRange(from: string | null, to: string | null): { from: string | null; to: string | null } {
    return {
      from: from === null ? null : shanghaiDayStart(from),
      to: to === null ? null : shanghaiDayEnd(to),
    };
  }

  private getSessionSummary(id: number): JournalAiSessionSummary {
    const row = this.database.prepare(
      'SELECT id, title, created_at, updated_at FROM journal_ai_sessions WHERE id = ?',
    ).get(id) as AiSessionRow | undefined;
    if (row === undefined) throw new Error(`AI session ${id} was not found.`);
    return this.toSessionSummary(row);
  }

  private getMessageById(id: number): JournalAiMessage | null {
    const row = this.database.prepare('SELECT * FROM journal_ai_messages WHERE id = ?')
      .get(id) as AiMessageRow | undefined;
    return row === undefined ? null : this.toMessage(row);
  }

  private toSessionSummary(row: AiSessionRow): JournalAiSessionSummary {
    return {
      id: row.id,
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private toMessage(row: AiMessageRow): JournalAiMessage {
    const sources = messageSourcesSchema.parse(JSON.parse(row.sources_json));
    return {
      id: row.id,
      sessionId: row.session_id,
      position: row.position,
      role: row.role,
      content: row.content,
      sources: sources.map((source) => ({
        ...source,
        deleted: this.entryExists(source.entryId) === false,
      })),
      status: row.status,
      error: row.error,
      articleId: row.article_id,
      articleTitle: row.article_title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private entryExists(id: number): boolean {
    const row = this.database.prepare(
      'SELECT 1 AS ok FROM journal_entries WHERE id = ?',
    ).get(id) as { ok: number } | undefined;
    return row !== undefined;
  }

  private likePattern(value: string): string {
    return `%${value.replace(/[~%_]/g, '~$&')}%`;
  }

  private groupRepresentativeCondition(alias: string): string {
    return `(
      ${alias}.media_group_id IS NULL OR
      ${alias}.source_message_id = (
        SELECT MIN(grouped.source_message_id)
        FROM journal_entries grouped
        WHERE grouped.chat_id = ${alias}.chat_id
          AND grouped.media_group_id = ${alias}.media_group_id
      )
    )`;
  }
}
