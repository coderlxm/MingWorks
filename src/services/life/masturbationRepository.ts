import { getDb } from '../../reminders/db.js';
import { bj } from '../../utils/time.js';

export interface MasturbationRecord {
  id: number;
  occurred_at: string;
  created_at: string;
  note: string | null;
  is_auto: 0 | 1;
}

export function createRecord(
  occurredAt: Date,
  note?: string,
  isAuto: 0 | 1 = 0,
): MasturbationRecord {
  const occurredAtIso = occurredAt.toISOString();
  const createdAt = new Date().toISOString();
  const noteValue = note?.trim() || null;
  const { lastInsertRowid } = getDb().prepare(`
    INSERT INTO masturbation_records (occurred_at, created_at, note, is_auto)
    VALUES (?, ?, ?, ?)
  `).run(occurredAtIso, createdAt, noteValue, isAuto);
  return {
    id: Number(lastInsertRowid),
    occurred_at: occurredAtIso,
    created_at: createdAt,
    note: noteValue,
    is_auto: isAuto,
  };
}

export interface MasturbationCaptureSession {
  chat_id: string;
  prompt_message_id: number;
  created_at: string;
  reference_date: string | null;
  expires_at: string | null;
}

export function findCaptureSession(chatId: string): MasturbationCaptureSession | undefined {
  const session = getDb().prepare(
    'SELECT * FROM masturbation_capture_sessions WHERE chat_id = ?'
  ).get(chatId) as MasturbationCaptureSession | undefined;
  if (!session) return undefined;
  if (!session.expires_at || session.expires_at <= new Date().toISOString()) {
    deleteCaptureSession(chatId);
    return undefined;
  }
  return session;
}

export function saveCaptureSession(
  chatId: string,
  promptMessageId: number,
  referenceDate: string | null,
): void {
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + 10 * 60 * 1000);
  getDb().prepare(`
    INSERT INTO masturbation_capture_sessions (
      chat_id, prompt_message_id, created_at, reference_date, expires_at
    )
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(chat_id) DO UPDATE SET
      prompt_message_id = excluded.prompt_message_id,
      created_at = excluded.created_at,
      reference_date = excluded.reference_date,
      expires_at = excluded.expires_at
  `).run(chatId, promptMessageId, createdAt.toISOString(), referenceDate, expiresAt.toISOString());
}

export function deleteCaptureSession(chatId: string): void {
  getDb().prepare('DELETE FROM masturbation_capture_sessions WHERE chat_id = ?').run(chatId);
}

export function findRecordById(id: number): MasturbationRecord | undefined {
  return getDb().prepare('SELECT * FROM masturbation_records WHERE id = ?').get(id) as MasturbationRecord | undefined;
}

export function deleteRecordById(id: number): MasturbationRecord | undefined {
  const record = findRecordById(id);
  if (record) {
    getDb().prepare('DELETE FROM masturbation_records WHERE id = ?').run(id);
  }
  return record;
}

export function findLatestRecord(): MasturbationRecord | undefined {
  return getDb().prepare(`
    SELECT * FROM masturbation_records
    ORDER BY occurred_at DESC, id DESC
    LIMIT 1
  `).get() as MasturbationRecord | undefined;
}

export function deleteLatestRecord(): MasturbationRecord | undefined {
  const latest = findLatestRecord();
  if (latest) {
    getDb().prepare('DELETE FROM masturbation_records WHERE id = ?').run(latest.id);
  }
  return latest;
}

export function findRecordsInRange(rangeStartUtc: string, rangeEndUtc: string): MasturbationRecord[] {
  return getDb().prepare(`
    SELECT * FROM masturbation_records
    WHERE occurred_at >= ? AND occurred_at < ?
    ORDER BY occurred_at ASC, id ASC
  `).all(rangeStartUtc, rangeEndUtc) as MasturbationRecord[];
}

export function findRecordsByDate(dateKey: string): MasturbationRecord[] {
  const dayStart = bj(dateKey).startOf('day');
  const dayEnd = dayStart.add(1, 'day');
  return findRecordsInRange(dayStart.toISOString(), dayEnd.toISOString());
}

export function createAutoRecordForDate(dateKey: string): MasturbationRecord {
  const occurredAt = new Date(`${dateKey}T12:00:00+08:00`);
  return createRecord(occurredAt, undefined, 1);
}

export function deleteRecordsByDate(dateKey: string): number {
  const dayStart = bj(dateKey).startOf('day');
  const dayEnd = dayStart.add(1, 'day');
  const { changes } = getDb().prepare(`
    DELETE FROM masturbation_records
    WHERE occurred_at >= ? AND occurred_at < ?
  `).run(dayStart.toISOString(), dayEnd.toISOString());
  return changes;
}

export function deleteLatestRecordByDate(dateKey: string): MasturbationRecord | undefined {
  const dayStart = bj(dateKey).startOf('day');
  const dayEnd = dayStart.add(1, 'day');
  const latest = getDb().prepare(`
    SELECT * FROM masturbation_records
    WHERE occurred_at >= ? AND occurred_at < ?
    ORDER BY occurred_at DESC, id DESC
    LIMIT 1
  `).get(dayStart.toISOString(), dayEnd.toISOString()) as MasturbationRecord | undefined;
  if (latest) {
    getDb().prepare('DELETE FROM masturbation_records WHERE id = ?').run(latest.id);
  }
  return latest;
}
