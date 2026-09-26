import { getDb } from './db.js';
import type { ReminderDeliveryStatus } from './dashboardTypes.js';

export interface Reminder {
  id: number;
  chat_id: string;
  text: string;
  trigger_at: string;
  status: 'pending' | 'done' | 'cancelled';
  created_at: string;
  done_at: string | null;
  cancelled_at: string | null;
  source_message_id: number | null;
  sent_message_id: number | null;
  delivery_status: ReminderDeliveryStatus;
  sent_at: string | null;
  last_error: string | null;
  revision: number;
  last_action: string | null;
  updated_at: string | null;
}

export interface CreateReminderInput {
  chat_id: string;
  text: string;
  trigger_at: Date;
  source_message_id?: number;
}

export function createReminder(input: CreateReminderInput): Reminder {
  const db = getDb();
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO reminders (chat_id, text, trigger_at, status, created_at, source_message_id, delivery_status, last_action, updated_at)
    VALUES (?, ?, ?, 'pending', ?, ?, 'waiting', 'created', ?)
  `);
  const result = stmt.run(
    input.chat_id,
    input.text,
    input.trigger_at.toISOString(),
    now,
    input.source_message_id ?? null, now
  );
  const reminder = findReminderById(Number(result.lastInsertRowid))!;
  recordOnceHistory(reminder, 'created');
  return reminder;
}

export function findPendingReminders(): Reminder[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM reminders
    WHERE status = 'pending'
    ORDER BY trigger_at ASC
  `);
  return stmt.all() as Reminder[];
}

export function findPendingByChatId(chatId: string): Reminder[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM reminders
    WHERE chat_id = ? AND status = 'pending'
    ORDER BY trigger_at ASC
  `);
  return stmt.all(chatId) as Reminder[];
}

export function findReminderById(id: number): Reminder | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM reminders WHERE id = ?');
  return (stmt.get(id) as Reminder) ?? null;
}

export function markReminderDone(id: number): void {
  const db = getDb();
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE reminders SET status = 'done', done_at = ?, revision = revision + 1, last_action = 'done', updated_at = ?
    WHERE id = ? AND status = 'pending'
  `);
  stmt.run(now, now, id);
}

export function cancelReminder(id: number): void {
  const db = getDb();
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE reminders SET status = 'cancelled', cancelled_at = ?, revision = revision + 1, last_action = 'cancelled', updated_at = ?
    WHERE id = ? AND status = 'pending'
  `);
  stmt.run(now, now, id);
}

export function updateReminderTriggerAt(id: number, triggerAt: Date): void {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE reminders SET trigger_at = ?, delivery_status = 'waiting', sent_message_id = NULL,
      sent_at = NULL, last_error = NULL, revision = revision + 1, last_action = 'snoozed', updated_at = ?
    WHERE id = ? AND status = 'pending'
  `);
  stmt.run(triggerAt.toISOString(), new Date().toISOString(), id);
}

export function setSentMessageId(id: number, messageId: number): void {
  const db = getDb();
  const stmt = db.prepare("UPDATE reminders SET sent_message_id = ?, sent_at = ?, delivery_status = 'sent', last_error = NULL WHERE id = ?");
  stmt.run(messageId, new Date().toISOString(), id);
}

export function setSourceMessageId(id: number, messageId: number): void {
  const db = getDb();
  const stmt = db.prepare('UPDATE reminders SET source_message_id = ? WHERE id = ?');
  stmt.run(messageId, id);
}

export interface RecurringRule {
  id: number;
  chat_id: string;
  text: string;
  timezone: string;
  rrule_text: string;
  calendar_filter: 'china_workday' | null;
  next_trigger_at: string;
  status: 'active' | 'paused' | 'cancelled';
  source: 'deterministic' | 'ai';
  source_message_id: number | null;
  created_at: string;
  updated_at: string;
  last_triggered_at: string | null;
  revision: number;
  last_error: string | null;
}

export interface RecurringRun {
  id: number;
  rule_id: number;
  trigger_at: string;
  sent_message_id: number | null;
  action: 'done' | 'skip' | 'none';
  acted_at: string | null;
  created_at: string;
  text_snapshot: string | null;
  timezone_snapshot: string | null;
  rule_snapshot: string | null;
  snapshot_note: string | null;
  delivery_status: ReminderDeliveryStatus;
  sent_at: string | null;
  last_error: string | null;
  revision: number;
}

export interface CreateRecurringRuleInput {
  chat_id: string;
  text: string;
  timezone: string;
  rrule_text: string;
  calendar_filter?: 'china_workday' | null;
  next_trigger_at: Date;
  source: 'deterministic' | 'ai';
  source_message_id?: number;
}

export function createRecurringRule(input: CreateRecurringRuleInput): RecurringRule {
  const db = getDb();
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO recurring_reminder_rules
      (chat_id, text, timezone, rrule_text, calendar_filter, next_trigger_at, status, source, source_message_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)
  `);
  const result = stmt.run(
    input.chat_id, input.text, input.timezone, input.rrule_text, input.calendar_filter ?? null,
    input.next_trigger_at.toISOString(), input.source,
    input.source_message_id ?? null, now, now
  );
  return findRecurringRuleById(Number(result.lastInsertRowid))!;
}

export function findRecurringRuleById(id: number): RecurringRule | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM recurring_reminder_rules WHERE id = ?');
  return (stmt.get(id) as RecurringRule) ?? null;
}

export function setRecurringSourceMessageId(id: number, messageId: number): void {
  const db = getDb();
  const stmt = db.prepare('UPDATE recurring_reminder_rules SET source_message_id = ? WHERE id = ?');
  stmt.run(messageId, id);
}

export function findActiveRecurringRules(): RecurringRule[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM recurring_reminder_rules
    WHERE status = 'active'
    ORDER BY next_trigger_at ASC
  `);
  return stmt.all() as RecurringRule[];
}

export function findActiveRecurringByChatId(chatId: string): RecurringRule[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM recurring_reminder_rules
    WHERE chat_id = ? AND status = 'active'
    ORDER BY next_trigger_at ASC
  `);
  return stmt.all(chatId) as RecurringRule[];
}

export function updateRecurringNextTrigger(id: number, nextTriggerAt: Date, lastTriggeredAt?: Date): void {
  const db = getDb();
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE recurring_reminder_rules
    SET next_trigger_at = ?, updated_at = ?, last_triggered_at = COALESCE(?, last_triggered_at)
    WHERE id = ?
  `);
  stmt.run(nextTriggerAt.toISOString(), now, lastTriggeredAt ? lastTriggeredAt.toISOString() : null, id);
}

export function updateRecurringStatus(id: number, status: 'active' | 'paused' | 'cancelled'): void {
  const db = getDb();
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE recurring_reminder_rules SET status = ?, updated_at = ?, revision = revision + 1 WHERE id = ?
  `);
  stmt.run(status, now, id);
}

export function createRecurringRun(input: { rule_id: number; trigger_at: Date; sent_message_id?: number }): RecurringRun {
  const db = getDb();
  const now = new Date().toISOString();
  const rule = findRecurringRuleById(input.rule_id)!;
  const stmt = db.prepare(`
    INSERT INTO recurring_reminder_runs (rule_id, trigger_at, sent_message_id, action, created_at, text_snapshot, timezone_snapshot, rule_snapshot, delivery_status)
    VALUES (?, ?, ?, 'none', ?, ?, ?, ?, 'sending')
  `);
  const result = stmt.run(
    input.rule_id, input.trigger_at.toISOString(),
    input.sent_message_id ?? null, now, rule.text, rule.timezone, rule.rrule_text
  );
  return findRecurringRunById(Number(result.lastInsertRowid))!;
}

export function findRecurringRunById(id: number): RecurringRun | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM recurring_reminder_runs WHERE id = ?');
  return (stmt.get(id) as RecurringRun) ?? null;
}

export function updateRecurringRunAction(id: number, action: 'done' | 'skip'): void {
  const db = getDb();
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE recurring_reminder_runs SET action = ?, acted_at = ?, revision = revision + 1 WHERE id = ? AND action = 'none'
  `);
  stmt.run(action, now, id);
}

export function setRecurringRunSentMessageId(id: number, messageId: number): void {
  const db = getDb();
  const stmt = db.prepare("UPDATE recurring_reminder_runs SET sent_message_id = ?, sent_at = ?, delivery_status = 'sent', last_error = NULL WHERE id = ?");
  stmt.run(messageId, new Date().toISOString(), id);
}

export function findPendingRemindersInRange(
  chatId: string,
  start: Date,
  end: Date
): Reminder[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM reminders
    WHERE chat_id = ?
      AND status = 'pending'
      AND trigger_at >= ?
      AND trigger_at <= ?
    ORDER BY trigger_at ASC
  `);
  return stmt.all(chatId, start.toISOString(), end.toISOString()) as Reminder[];
}

export function searchPendingReminders(
  chatId: string,
  query: string
): Reminder[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM reminders
    WHERE chat_id = ?
      AND status = 'pending'
      AND text LIKE ? ESCAPE '\\'
    ORDER BY trigger_at ASC
  `);
  return stmt.all(chatId, `%${escapeLikePattern(query)}%`) as Reminder[];
}

export function searchActiveRecurringRules(
  chatId: string,
  query: string
): RecurringRule[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM recurring_reminder_rules
    WHERE chat_id = ?
      AND status = 'active'
      AND text LIKE ? ESCAPE '\\'
    ORDER BY next_trigger_at ASC
  `);
  return stmt.all(chatId, `%${escapeLikePattern(query)}%`) as RecurringRule[];
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

export interface HistoryRow {
  id: number; kind: 'once' | 'run' | 'rule'; entity_id: number; rule_id: number | null;
  chat_id: string; text: string; trigger_at: string; occurred_at: string | null;
  action: string; delivery_status: ReminderDeliveryStatus; note: string | null; error: string | null;
}

export function recordHistory(input: Omit<HistoryRow, 'id'>): void {
  getDb().prepare(`INSERT INTO reminder_history
    (kind, entity_id, rule_id, chat_id, text, trigger_at, occurred_at, action, delivery_status, note, error)
    VALUES (@kind, @entity_id, @rule_id, @chat_id, @text, @trigger_at, @occurred_at, @action, @delivery_status, @note, @error)`).run(input);
}

export function recordOnceHistory(reminder: Reminder, action: string, note: string | null = null): void {
  recordHistory({ kind: 'once', entity_id: reminder.id, rule_id: null, chat_id: reminder.chat_id,
    text: reminder.text, trigger_at: reminder.trigger_at, occurred_at: new Date().toISOString(), action,
    delivery_status: reminder.delivery_status, note, error: reminder.last_error });
}

export function recordRunHistory(run: RecurringRun, action: string): void {
  const rule = findRecurringRuleById(run.rule_id)!;
  recordHistory({ kind: 'run', entity_id: run.id, rule_id: rule.id, chat_id: rule.chat_id,
    text: run.text_snapshot ?? rule.text, trigger_at: run.trigger_at, occurred_at: new Date().toISOString(), action,
    delivery_status: run.delivery_status, note: run.snapshot_note, error: run.last_error });
}

export function recordRuleHistory(rule: RecurringRule, action: string): void {
  recordHistory({ kind: 'rule', entity_id: rule.id, rule_id: rule.id, chat_id: rule.chat_id, text: rule.text,
    trigger_at: new Date().toISOString(), occurred_at: new Date().toISOString(), action,
    delivery_status: 'unknown', note: null, error: rule.last_error });
}

export function listReminders(chatId: string): Reminder[] {
  return getDb().prepare('SELECT * FROM reminders WHERE chat_id = ? ORDER BY trigger_at DESC').all(chatId) as Reminder[];
}
export function listRecurringRules(chatId: string): RecurringRule[] {
  return getDb().prepare('SELECT * FROM recurring_reminder_rules WHERE chat_id = ? ORDER BY next_trigger_at').all(chatId) as RecurringRule[];
}
export function listRecurringRuns(chatId: string, ruleId?: number): RecurringRun[] {
  return getDb().prepare(`SELECT r.* FROM recurring_reminder_runs r JOIN recurring_reminder_rules p ON p.id = r.rule_id
    WHERE p.chat_id = ? ${ruleId === undefined ? '' : 'AND r.rule_id = ?'} ORDER BY r.trigger_at DESC`)
    .all(...(ruleId === undefined ? [chatId] : [chatId, ruleId])) as RecurringRun[];
}

export function markOnceDelivery(id: number, revision: number, status: ReminderDeliveryStatus, error: string | null = null): void {
  getDb().prepare('UPDATE reminders SET delivery_status = ?, last_error = ? WHERE id = ? AND revision = ?')
    .run(status, error, id, revision);
}
export function markRunDelivery(id: number, status: ReminderDeliveryStatus, error: string | null = null): void {
  getDb().prepare('UPDATE recurring_reminder_runs SET delivery_status = ?, last_error = ? WHERE id = ?').run(status, error, id);
}
