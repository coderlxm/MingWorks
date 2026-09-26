import type { Telegraf } from 'telegraf';
import { config } from '../config/index.js';
import { getDb } from './db.js';
import * as repo from './repository.js';
import { buildRRuleText, describeRecurrence, getNextTrigger, getOccurrencesInRange, type RecurrenceSpec } from './recurring.js';
import { scheduleReminder, cancelScheduledReminder, scheduleRecurringRule, cancelRecurringJob } from './scheduler.js';
import { buildCancelButton, buildRecurringRuleButtons } from './formatter.js';
import { bjFormat } from '../utils/time.js';
import { escapeHtml } from '../utils/html.js';

const changing = new Set<string>();
export function reminderError(message: string, statusCode = 409): Error {
  return Object.assign(new Error(message), { statusCode });
}
function future(date: Date): void {
  if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) throw reminderError('提醒时间必须在未来。', 400);
}
function revisionMatches(actual: number, expected: number): void {
  if (actual !== expected) throw reminderError('这条提醒已发生变化，请重新查看后操作。');
}
async function mutate<T>(key: string, action: () => Promise<T>): Promise<T> {
  if (changing.has(key)) throw reminderError('这条提醒正在更新，请等待操作结果。');
  changing.add(key);
  try { return await action(); } finally { changing.delete(key); }
}
async function updateTelegram(action: () => Promise<void>): Promise<void> {
  try { await action(); } catch (error) {
    throw Object.assign(new Error(`操作已保存，但 Telegram 卡片更新失败：${error instanceof Error ? error.message : String(error)}`), { applied: true, statusCode: 502 });
  }
}
function scheduleSavedOnce(bot: Telegraf, reminder: repo.Reminder): void {
  try { scheduleReminder(bot, reminder); } catch (error) {
    throw Object.assign(new Error(`提醒已保存，但调度失败：${error instanceof Error ? error.message : String(error)}`), { applied: true, statusCode: 500 });
  }
}
function scheduleSavedRule(bot: Telegraf, rule: repo.RecurringRule): void {
  try { scheduleRecurringRule(bot, rule); } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    getDb().prepare('UPDATE recurring_reminder_rules SET last_error = ? WHERE id = ?').run(message, rule.id);
    throw Object.assign(new Error(`规则已保存，但调度失败：${message}`), { applied: true, statusCode: 500 });
  }
}
export function requireOnce(id: number): repo.Reminder {
  const reminder = repo.findReminderById(id);
  if (!reminder || reminder.chat_id !== config.tgChatId) throw reminderError('提醒不存在。', 404);
  return reminder;
}
export function requireRule(id: number): repo.RecurringRule {
  const rule = repo.findRecurringRuleById(id);
  if (!rule || rule.chat_id !== config.tgChatId) throw reminderError('循环规则不存在。', 404);
  return rule;
}
export function requireRun(id: number): repo.RecurringRun {
  const run = repo.findRecurringRunById(id);
  if (!run) throw reminderError('这次提醒不存在。', 404);
  requireRule(run.rule_id);
  return run;
}
function editableOnce(id: number, revision: number): repo.Reminder {
  const row = requireOnce(id);
  revisionMatches(row.revision, revision);
  if (row.status !== 'pending') throw reminderError('这条提醒已经处理，旧操作已失效。');
  if (row.delivery_status === 'sending') throw reminderError('提醒正在发送，请收到消息后再操作。');
  return row;
}

export function createOnceReminder(bot: Telegraf, input: repo.CreateReminderInput): repo.Reminder {
  future(input.trigger_at);
  if (!input.text.trim()) throw reminderError('提醒内容不能为空。', 400);
  const reminder = getDb().transaction(() => repo.createReminder({ ...input, text: input.text.trim() }))();
  scheduleSavedOnce(bot, reminder);
  return reminder;
}

async function syncOnceCards(bot: Telegraf, before: repo.Reminder, after: repo.Reminder, action: string): Promise<void> {
  const result = action === 'done' ? '✅ 已完成' : action === 'cancelled' ? '已取消' : `已调整到 ${bjFormat(after.trigger_at)}`;
  const ids = [...new Set([before.source_message_id, before.sent_message_id].filter((id): id is number => id !== null))];
  await updateTelegram(async () => {
    for (const id of ids) {
      await bot.telegram.editMessageText(before.chat_id, id, undefined,
        `${result}\n${escapeHtml(after.text)}`,
        { parse_mode: 'HTML', ...(after.status === 'pending' && id === before.source_message_id
          ? buildCancelButton(after.id, after.revision) : { reply_markup: { inline_keyboard: [] } }) });
    }
  });
}

export async function updateOnceReminder(bot: Telegraf, id: number, expectedRevision: number, input: { text: string; triggerAt: Date }, action: 'edited' | 'snoozed' = 'edited'): Promise<repo.Reminder> {
  return mutate(`once:${id}`, async () => {
    const before = editableOnce(id, expectedRevision);
    future(input.triggerAt);
    if (!input.text.trim()) throw reminderError('提醒内容不能为空。', 400);
    getDb().transaction(() => {
      repo.recordOnceHistory(before, action, `${before.text !== input.text.trim() ? `新内容：${input.text.trim()}；` : ''}新计划：${bjFormat(input.triggerAt)}（北京时间）`);
      getDb().prepare(`UPDATE reminders SET text = ?, trigger_at = ?, delivery_status = 'waiting', sent_message_id = NULL,
        sent_at = NULL, last_error = NULL, revision = revision + 1, last_action = ?, updated_at = ? WHERE id = ?`)
        .run(input.text.trim(), input.triggerAt.toISOString(), action, new Date().toISOString(), id);
    })();
    cancelScheduledReminder(id);
    const after = requireOnce(id);
    scheduleSavedOnce(bot, after);
    await syncOnceCards(bot, before, after, action);
    return after;
  });
}

export async function actOnceReminder(bot: Telegraf, id: number, expectedRevision: number, action: 'done' | 'cancel' | 'snooze', triggerAt?: Date): Promise<repo.Reminder> {
  if (action === 'snooze') {
    if (!triggerAt) throw reminderError('请选择延期后的时间。', 400);
    return updateOnceReminder(bot, id, expectedRevision, { text: requireOnce(id).text, triggerAt }, 'snoozed');
  }
  return mutate(`once:${id}`, async () => {
    const before = editableOnce(id, expectedRevision);
    getDb().transaction(() => {
      if (action === 'done') repo.markReminderDone(id); else repo.cancelReminder(id);
      repo.recordOnceHistory(requireOnce(id), action === 'done' ? 'done' : 'cancelled');
    })();
    cancelScheduledReminder(id);
    const after = requireOnce(id);
    await syncOnceCards(bot, before, after, action === 'done' ? 'done' : 'cancelled');
    return after;
  });
}

export function previewReminderRule(spec: RecurrenceSpec) {
  const now = new Date();
  const rruleText = buildRRuleText(spec, now);
  const next = getNextTrigger(rruleText, spec.timezone, now, false, spec.calendarFilter);
  const end = new Date(now.getTime() + 7 * 86400000);
  const rule = { rrule_text: rruleText, timezone: spec.timezone, calendar_filter: spec.calendarFilter, text: '' } as repo.RecurringRule;
  const preview = getOccurrencesInRange(rule, now, end).map(row => row.triggerAt.toISOString());
  return { rruleText, summary: describeRecurrence(spec), nextTriggerAt: next.toISOString(), timezone: spec.timezone, preview };
}

export function createRuleReminder(bot: Telegraf, input: repo.CreateRecurringRuleInput): repo.RecurringRule {
  future(input.next_trigger_at);
  const rule = getDb().transaction(() => {
    const row = repo.createRecurringRule(input);
    repo.recordRuleHistory(row, 'created');
    return row;
  })();
  scheduleSavedRule(bot, rule);
  return rule;
}
async function syncRuleCard(bot: Telegraf, rule: repo.RecurringRule): Promise<void> {
  if (rule.source_message_id === null) return;
  const state = rule.status === 'active' ? `下次：${bjFormat(rule.next_trigger_at)}` : rule.status === 'paused' ? '已暂停' : '规则已结束';
  await updateTelegram(async () => {
    await bot.telegram.editMessageText(rule.chat_id, rule.source_message_id!, undefined,
      `🔄 ${escapeHtml(rule.text)}\n${state}`,
      { parse_mode: 'HTML', ...(rule.status === 'active' ? buildRecurringRuleButtons(rule.id, rule.revision) : { reply_markup: { inline_keyboard: [] } }) });
  });
}
export async function updateRuleReminder(bot: Telegraf, id: number, expectedRevision: number, text: string, spec: RecurrenceSpec): Promise<repo.RecurringRule> {
  return mutate(`rule:${id}`, async () => {
    const before = requireRule(id);
    revisionMatches(before.revision, expectedRevision);
    if (before.status === 'cancelled') throw reminderError('规则已结束，请新建规则。');
    if (before.timezone !== spec.timezone) throw reminderError('请保留这条规则原来的时区。', 400);
    const plan = previewReminderRule(spec);
    getDb().transaction(() => {
      getDb().prepare(`UPDATE recurring_reminder_rules SET text = ?, timezone = ?, rrule_text = ?, calendar_filter = ?,
        next_trigger_at = ?, updated_at = ?, revision = revision + 1, last_error = NULL WHERE id = ?`)
        .run(text, spec.timezone, plan.rruleText, spec.calendarFilter, plan.nextTriggerAt, new Date().toISOString(), id);
      repo.recordRuleHistory(requireRule(id), 'edited');
    })();
    cancelRecurringJob(id);
    const after = requireRule(id);
    if (after.status === 'active') scheduleSavedRule(bot, after);
    await syncRuleCard(bot, after);
    return after;
  });
}
export async function actRuleReminder(bot: Telegraf, id: number, expectedRevision: number, action: 'pause' | 'resume' | 'end'): Promise<repo.RecurringRule> {
  return mutate(`rule:${id}`, async () => {
    const before = requireRule(id);
    revisionMatches(before.revision, expectedRevision);
    if (before.status === 'cancelled' || (action === 'pause' && before.status !== 'active') || (action === 'resume' && before.status !== 'paused')) {
      throw reminderError('规则状态已经变化，这次操作已失效。');
    }
    const next = action === 'resume' ? getNextTrigger(before.rrule_text, before.timezone, new Date(), false, before.calendar_filter) : null;
    getDb().transaction(() => {
      repo.updateRecurringStatus(id, action === 'pause' ? 'paused' : action === 'resume' ? 'active' : 'cancelled');
      if (next) repo.updateRecurringNextTrigger(id, next);
      getDb().prepare('UPDATE recurring_reminder_rules SET last_error = NULL WHERE id = ?').run(id);
      repo.recordRuleHistory(requireRule(id), action === 'end' ? 'ended' : action === 'pause' ? 'paused' : 'resumed');
    })();
    cancelRecurringJob(id);
    const after = requireRule(id);
    if (action === 'resume') scheduleSavedRule(bot, after);
    await syncRuleCard(bot, after);
    return after;
  });
}
export async function actReminderRun(bot: Telegraf, id: number, expectedRevision: number, action: 'done' | 'skip'): Promise<repo.RecurringRun> {
  return mutate(`run:${id}`, async () => {
    const before = requireRun(id);
    revisionMatches(before.revision, expectedRevision);
    if (before.action !== 'none') throw reminderError('这次提醒已经处理。');
    if (before.delivery_status === 'sending') throw reminderError('这次提醒正在发送，请稍后操作。');
    getDb().transaction(() => {
      repo.updateRecurringRunAction(id, action);
      repo.recordRunHistory(requireRun(id), action);
    })();
    const after = requireRun(id);
    if (before.sent_message_id !== null) await updateTelegram(async () => {
      await bot.telegram.editMessageText(requireRule(before.rule_id).chat_id, before.sent_message_id!, undefined,
        `${action === 'done' ? '✅ 本次已完成' : '⏭️ 本次已跳过'}\n${escapeHtml(after.text_snapshot ?? requireRule(after.rule_id).text)}`,
        { parse_mode: 'HTML', reply_markup: { inline_keyboard: [] } });
    });
    return after;
  });
}
