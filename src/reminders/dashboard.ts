import rrulePkg from 'rrule';
import { config } from '../config/index.js';
import { bj, bjDate } from '../utils/time.js';
import { getDb } from './db.js';
import * as repo from './repository.js';
import { describeRecurrence, getOccurrencesInRange } from './recurring.js';
import type { ReminderItem, ReminderRuleView, ReminderRecurrenceInput, ReminderBoardResponse, ReminderHistoryItem, ReminderListResponse } from './dashboardTypes.js';
import { readLifeHistory } from './lifeDashboard.js';

const { RRule } = rrulePkg as { RRule: typeof import('rrule')['RRule'] };

export function onceItem(row: repo.Reminder): ReminderItem {
  const status = row.status !== 'pending' ? row.status
    : row.delivery_status === 'sent' ? 'awaiting'
      : row.delivery_status === 'failed' ? 'failed'
        : row.delivery_status === 'missed' ? 'missed'
          : row.delivery_status === 'unknown' ? 'unknown'
            : row.last_action === 'snoozed' ? 'snoozed' : 'scheduled';
  return { key: `once:${row.id}`, kind: 'once', id: row.id, ruleId: null, text: row.text,
    triggerAt: row.trigger_at, date: bjDate(row.trigger_at), timezone: 'Asia/Shanghai', status,
    deliveryStatus: row.delivery_status, sentAt: row.sent_at, actedAt: row.done_at ?? row.cancelled_at,
    error: row.last_error, note: row.status === 'cancelled' && row.last_action === null ? '旧记录未保存取消原因，可能由系统关闭。'
      : row.delivery_status === 'unknown' ? '旧记录或中断的发送无法确认本次结果。' : null,
    revision: row.revision };
}
export function runItem(row: repo.RecurringRun): ReminderItem {
  const rule = repo.findRecurringRuleById(row.rule_id)!;
  return { key: `run:${row.id}`, kind: 'run', id: row.id, ruleId: row.rule_id,
    text: row.text_snapshot ?? rule.text, triggerAt: row.trigger_at, date: bjDate(row.trigger_at),
    timezone: row.timezone_snapshot ?? rule.timezone,
    status: row.action === 'done' ? 'done' : row.action === 'skip' ? 'skipped' : row.delivery_status === 'sent' ? 'awaiting'
      : row.delivery_status === 'failed' ? 'failed' : row.delivery_status === 'sending' ? 'scheduled' : 'unknown',
    deliveryStatus: row.delivery_status, sentAt: row.sent_at, actedAt: row.acted_at, error: row.last_error,
    note: row.snapshot_note ?? (row.delivery_status === 'unknown' ? '发送结果未知。' : null),
    revision: row.revision };
}

export function ruleRecurrence(row: repo.RecurringRule): ReminderRecurrenceInput {
  const parsed = RRule.fromString(row.rrule_text).options;
  const freq = parsed.freq === RRule.DAILY ? 'DAILY' : parsed.freq === RRule.WEEKLY ? 'WEEKLY' : parsed.freq === RRule.MONTHLY ? 'MONTHLY' : null;
  if (!freq) throw new Error('这条规则的频率不属于当前支持的每天、每周或每月。');
  return { freq, byweekday: (parsed.byweekday ?? []).map(day => ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'][day]!),
    bymonthday: parsed.bymonthday ?? [], time: `${String(parsed.byhour[0]).padStart(2, '0')}:${String(parsed.byminute[0]).padStart(2, '0')}`,
    timezone: row.timezone, calendarFilter: row.calendar_filter };
}
export function ruleView(row: repo.RecurringRule): ReminderRuleView {
  const recurrence = ruleRecurrence(row);
  const view: ReminderRuleView = { id: row.id, text: row.text, status: row.status, timezone: row.timezone,
    summary: describeRecurrence(recurrence), recurrence, nextTriggerAt: row.status === 'active' ? row.next_trigger_at : null,
    preview: [], revision: row.revision, error: row.last_error, createdAt: row.created_at, updatedAt: row.updated_at };
  if (row.status === 'cancelled') return view;
  try { view.preview = getOccurrencesInRange(row, new Date(), bj().add(7, 'day').toDate()).map(item => item.triggerAt.toISOString()); }
  catch (error) { view.error = error instanceof Error ? error.message : String(error); }
  return view;
}

export function readReminderBoard(date: string, days: number): ReminderBoardResponse {
  const now = new Date();
  const start = bj(date).startOf('day').toDate();
  const end = bj(date).add(days, 'day').startOf('day').subtract(1, 'millisecond').toDate();
  const all = [...repo.listReminders(config.tgChatId).map(onceItem), ...repo.listRecurringRuns(config.tgChatId).map(runItem)];
  const inRange = (item: ReminderItem) => item.triggerAt >= start.toISOString() && item.triggerAt <= end.toISOString();
  const upcoming = all.filter(item => inRange(item) && ['scheduled', 'snoozed'].includes(item.status));
  const issues = all.filter(item => ['missed', 'failed', 'unknown'].includes(item.status));
  for (const row of repo.findActiveRecurringByChatId(config.tgChatId)) {
    try {
      const lower = new Date(Math.max(start.getTime(), now.getTime(), new Date(row.next_trigger_at).getTime()));
      if (lower > end) continue;
      for (const entry of getOccurrencesInRange(row, lower, end)) {
        const triggerAt = entry.triggerAt.toISOString();
        upcoming.push({ key: `forecast:${row.id}:${triggerAt}`, kind: 'forecast', id: row.id, ruleId: row.id,
          text: row.text, triggerAt, date: bjDate(triggerAt), timezone: row.timezone, status: 'scheduled',
          deliveryStatus: 'waiting', sentAt: null, actedAt: null, error: null, note: describeRecurrence(ruleRecurrence(row)), revision: row.revision });
      }
    } catch (error) {
      issues.push({ key: `rule-error:${row.id}`, kind: 'forecast', id: row.id, ruleId: row.id, text: row.text,
        triggerAt: row.next_trigger_at, date: bjDate(row.next_trigger_at), timezone: row.timezone, status: 'failed', deliveryStatus: 'unknown',
        sentAt: null, actedAt: null, error: error instanceof Error ? error.message : String(error), note: '循环计划计算失败。', revision: row.revision });
    }
  }
  return { servedAt: now.toISOString(), date, timezone: 'Asia/Shanghai',
    pending: all.filter(item => item.status === 'awaiting').sort((a, b) => a.triggerAt.localeCompare(b.triggerAt)),
    upcoming: upcoming.sort((a, b) => a.triggerAt.localeCompare(b.triggerAt)),
    handled: all.filter(item => ['done', 'cancelled', 'skipped'].includes(item.status) && item.actedAt !== null
      && item.actedAt >= start.toISOString() && item.actedAt <= end.toISOString()), issues };
}
export function readReminderList(input: { q?: string | undefined; status: string; from?: string | undefined; to?: string | undefined; offset: number; limit: number }): ReminderListResponse {
  const rows = repo.listReminders(config.tgChatId).map(onceItem).filter(item =>
    (!input.q || item.text.toLocaleLowerCase().includes(input.q.toLocaleLowerCase()))
    && (!input.from || item.date >= input.from) && (!input.to || item.date <= input.to)
    && (input.status === 'all' || (input.status === 'active' ? !['done', 'cancelled'].includes(item.status) : item.status === input.status)));
  return { servedAt: new Date().toISOString(), items: rows.slice(input.offset, input.offset + input.limit), total: rows.length,
    nextOffset: input.offset + input.limit < rows.length ? input.offset + input.limit : null };
}
export function readReminderHistory(input: { from: string; to: string; kind: string; offset: number; limit: number }) {
  const start = bj(input.from).startOf('day').toISOString();
  const end = bj(input.to).endOf('day').toISOString();
  const raw = getDb().prepare('SELECT * FROM reminder_history WHERE chat_id = ? AND trigger_at >= ? AND trigger_at <= ? ORDER BY id DESC')
    .all(config.tgChatId, start, end) as repo.HistoryRow[];
  const items: ReminderHistoryItem[] = raw.map(row => ({ id: `reminder:${row.id}`, kind: row.kind, entityId: row.entity_id, ruleId: row.rule_id,
    text: row.text, triggerAt: row.trigger_at, occurredAt: row.occurred_at, date: bjDate(row.trigger_at), action: row.action,
    deliveryStatus: row.delivery_status, note: row.note, error: row.error }));
  items.push(...readLifeHistory(input.from, input.to));
  const selected = items.filter(item => input.kind === 'all' || item.kind === input.kind)
    .sort((a, b) => (b.occurredAt ?? b.triggerAt ?? b.date).localeCompare(a.occurredAt ?? a.triggerAt ?? a.date));
  return { servedAt: new Date().toISOString(), items: selected.slice(input.offset, input.offset + input.limit), total: selected.length,
    nextOffset: input.offset + input.limit < selected.length ? input.offset + input.limit : null };
}
