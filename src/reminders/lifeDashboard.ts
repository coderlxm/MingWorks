import schedule from 'node-schedule';
import type { Telegraf } from 'telegraf';
import { z } from 'zod';
import { config } from '../config/index.js';
import { isChinaWorkdayStrict } from '../calendar/chinaWorkday.js';
import { bj, bjDate } from '../utils/time.js';
import { buildBusReminderButtons, buildVitaminButtons, buildWorkCheckinButtons, formatBusReminderMessage, formatVitaminMessage, formatWorkCheckinFollowUpMessage } from '../formatters/index.js';
import { sendTelegramMessage, sendTelegramMessageWithId } from '../publishers/telegram.js';
import { getDb } from './db.js';
import { atLifeTime, createLifeDay, getLifeDay, getLifeSettings, lifeActionSchema, lifeDateSchema, lifeDayIsClosed, lifeKinds, lifeKindSchema, lifeSettingsSchema, lifeTitles, patchLifeDay, requireToday, saveLifeSettings, type LifeDay } from './lifeSettings.js';
import type { FixedLifeRule, LifeAction, LifeDashboard, LifeItem, LifeKind, LifeSettings } from './lifeDashboardTypes.js';
import type { ReminderHistoryItem } from './dashboardTypes.js';

const jobs = new Map<LifeKind, schedule.Job>();
const repeatMinutes = { vitamin: 30, bus: 2 } as const;

function cancelJob(kind: LifeKind): void {
  jobs.get(kind)?.cancel();
  jobs.delete(kind);
}

function scheduleAt(bot: Telegraf, kind: 'vitamin' | 'bus', date: string, at: string): void {
  cancelJob(kind);
  const job = schedule.scheduleJob(new Date(at), async () => {
    jobs.delete(kind);
    const day = getLifeDay(kind, date);
    if (date !== bjDate() || !getLifeSettings(kind).enabled || !day || lifeDayIsClosed(day) || day.next_trigger_at !== at) return;
    if (kind === 'bus' && day.sent_count !== null && day.sent_count >= 3) {
      await finishDay(bot, kind, date, 'auto_closed', '已达到最多 3 次提醒，确认时段已结束。');
      return;
    }
    await sendSpecial(bot, kind, date);
  });
  if (!job) {
    const error = new Error('生活提醒的计划时间已过，无法安排。');
    patchLifeDay(kind, date, { status: 'failed', next_trigger_at: null, finished_at: new Date().toISOString(), error: error.message });
    throw error;
  }
  job.on('error', error => console.error(`[life:${kind}]`, error));
  jobs.set(kind, job);
}

function windowFor(settings: LifeSettings, date: string): { start: Date; end: Date | null } | null {
  const workday = isChinaWorkdayStrict(bj(date).toDate());
  if (settings.kind === 'vitamin') {
    return workday
      ? { start: atLifeTime(date, settings.workdayStart), end: atLifeTime(date, settings.workdayEnd) }
      : { start: atLifeTime(date, settings.restdayTime), end: null };
  }
  if (!workday) return null;
  return { start: atLifeTime(date, settings.kind === 'bus' ? settings.time : '09:55'), end: null };
}

function ruleText(settings: LifeSettings): string {
  if (settings.kind === 'vitamin') return `中国工作日 ${settings.workdayStart}–${settings.workdayEnd} 随机开始；非工作日 ${settings.restdayTime}；每 30 分钟提醒至当天结束`;
  if (settings.kind === 'bus') return `中国工作日 ${settings.time} 开始，每 2 分钟一次，最多 3 次`;
  return '中国工作日随 09:55 新闻发出，09:59 补提醒，10:00 自动结束';
}

function prepareDay(kind: LifeKind, date = bjDate(), rescheduleUnsent = false): LifeDay | undefined {
  const settings = getLifeSettings(kind);
  if (!settings.enabled) return getLifeDay(kind, date);
  const window = windowFor(settings, date);
  if (!window) return getLifeDay(kind, date);
  const existing = getLifeDay(kind, date);
  if (existing && !rescheduleUnsent) return existing;
  const now = Date.now();
  const start = window.end && window.end.getTime() > now ? Math.max(window.start.getTime(), now) : window.start.getTime();
  const first = window.end && window.end.getTime() > start
    ? new Date(start + Math.ceil(Math.random() * (window.end.getTime() - start)))
    : new Date(start);
  const followUp = kind === 'work-checkin' ? atLifeTime(date, '09:59') : null;
  const next = first.getTime() > now ? first : followUp && followUp.getTime() > now ? followUp : null;
  createLifeDay(kind, date, first.toISOString());
  patchLifeDay(kind, date, {
    status: next ? 'scheduled' : 'missed',
    first_trigger_at: first.toISOString(),
    next_trigger_at: next?.toISOString() ?? null,
    settings_json: JSON.stringify(settings),
    sent_count: 0,
    error: null,
    reason: next ? null : '本次计划时间已过，未自动补发。',
    finished_at: next ? null : new Date().toISOString(),
  });
  return getLifeDay(kind, date);
}

async function clearButtons(bot: Telegraf, kind: LifeKind, date: string): Promise<void> {
  const rows = getDb().prepare('SELECT message_id FROM life_reminder_messages WHERE kind = ? AND date_key = ?').all(kind, date) as Array<{ message_id: number }>;
  for (const row of rows) {
    await bot.telegram.editMessageReplyMarkup(config.tgChatId, row.message_id, undefined, { inline_keyboard: [] });
    getDb().prepare('DELETE FROM life_reminder_messages WHERE kind = ? AND date_key = ? AND message_id = ?').run(kind, date, row.message_id);
  }
}

async function finishDay(bot: Telegraf, kind: LifeKind, date: string, status: 'confirmed' | 'stopped' | 'auto_closed', reason: string): Promise<void> {
  createLifeDay(kind, date, null);
  if (date === bjDate()) cancelJob(kind);
  patchLifeDay(kind, date, { status, reason, finished_at: new Date().toISOString(), next_trigger_at: null });
  try { await clearButtons(bot, kind, date); }
  catch (error) { throw Object.assign(error instanceof Error ? error : new Error(String(error)), { applied: true }); }
}

async function sendTracked(bot: Telegraf | undefined, kind: LifeKind, date: string, message: string): Promise<boolean> {
  const day = getLifeDay(kind, date);
  if (date !== bjDate() || !getLifeSettings(kind).enabled || !day || lifeDayIsClosed(day)) return false;
  cancelJob(kind);
  patchLifeDay(kind, date, { next_trigger_at: null, error: null });
  const keyboard = kind === 'vitamin' ? buildVitaminButtons(date) : kind === 'bus' ? buildBusReminderButtons(date) : buildWorkCheckinButtons(date);
  let messageId: number;
  try {
    messageId = await sendTelegramMessageWithId(message, bot, keyboard.reply_markup);
  } catch (error) {
    const current = getLifeDay(kind, date)!;
    const planUnchanged = current.status === day.status && current.next_trigger_at === null;
    patchLifeDay(kind, date, { error: error instanceof Error ? error.message : String(error), ...(planUnchanged && !lifeDayIsClosed(current) ? { status: 'failed' as const, finished_at: new Date().toISOString() } : {}) });
    throw error;
  }
  getDb().prepare('INSERT INTO life_reminder_messages (kind, date_key, message_id) VALUES (?, ?, ?)').run(kind, date, messageId);
  const current = getLifeDay(kind, date)!;
  const stillActive = date === bjDate() && getLifeSettings(kind).enabled && !lifeDayIsClosed(current);
  const planUnchanged = current.status === day.status && current.next_trigger_at === null;
  patchLifeDay(kind, date, { last_sent_at: new Date().toISOString(), sent_count: current.sent_count === null ? null : current.sent_count + 1, ...(stillActive && planUnchanged ? { status: 'awaiting' as const, finished_at: null, reason: null } : {}) });
  if (!stillActive && bot) {
    await bot.telegram.editMessageReplyMarkup(config.tgChatId, messageId, undefined, { inline_keyboard: [] });
    getDb().prepare('DELETE FROM life_reminder_messages WHERE kind = ? AND date_key = ? AND message_id = ?').run(kind, date, messageId);
  }
  return stillActive && planUnchanged;
}

async function sendSpecial(bot: Telegraf, kind: 'vitamin' | 'bus', date: string): Promise<void> {
  const sent = await sendTracked(bot, kind, date, kind === 'vitamin' ? formatVitaminMessage() : formatBusReminderMessage());
  if (!sent) return;
  const current = getLifeDay(kind, date)!;
  if (lifeDayIsClosed(current) || current.next_trigger_at !== null) return;
  const next = bj().add(repeatMinutes[kind], 'minute');
  if (next.format('YYYY-MM-DD') !== date) return;
  patchLifeDay(kind, date, { next_trigger_at: next.toISOString(), ...(kind === 'bus' && current.sent_count !== null && current.sent_count >= 3 ? { reason: '已提醒 3 次，2 分钟后自动结束；期间仍可确认。' } : {}) });
  scheduleAt(bot, kind, date, next.toISOString());
}

function restoreSpecial(bot: Telegraf, kind: 'vitamin' | 'bus'): void {
  cancelJob(kind);
  if (!getLifeSettings(kind).enabled) return;
  const date = bjDate();
  const day = prepareDay(kind, date);
  if (!day || lifeDayIsClosed(day) || day.status === 'failed' || !day.next_trigger_at) return;
  if (bjDate(day.next_trigger_at) !== date) {
    patchLifeDay(kind, date, { next_trigger_at: null, reason: '后续提醒超出当天范围，已停止安排。' });
    return;
  }
  if (new Date(day.next_trigger_at).getTime() <= Date.now()) {
    if (kind === 'bus' && day.sent_count !== null && day.sent_count >= 3) {
      patchLifeDay(kind, date, { next_trigger_at: null, status: 'auto_closed', finished_at: day.next_trigger_at, reason: '已达到最多 3 次提醒，确认时段已结束。' });
      return;
    }
    patchLifeDay(kind, date, { next_trigger_at: null, status: day.last_sent_at ? 'awaiting' : day.status === 'legacy_unknown' ? 'legacy_unknown' : 'missed', reason: '重启时计划时间已过，未自动补发。' });
    return;
  }
  scheduleAt(bot, kind, date, day.next_trigger_at);
}

export function restoreVitaminLoop(bot: Telegraf): void { restoreSpecial(bot, 'vitamin'); }
export function restoreBusReminderLoop(bot: Telegraf): void { restoreSpecial(bot, 'bus'); }

export function startLifeDay(bot: Telegraf): void {
  const date = bjDate();
  const expired = getDb().prepare("SELECT * FROM life_reminder_days WHERE date_key < ? AND status IN ('scheduled', 'awaiting', 'snoozed')").all(date) as LifeDay[];
  for (const day of expired) {
    patchLifeDay(day.kind, day.date_key, { status: 'auto_closed', next_trigger_at: null, finished_at: bj(day.date_key).add(1, 'day').startOf('day').toISOString(), reason: '当天提醒时段已结束。' });
  }
  restoreVitaminLoop(bot);
  restoreBusReminderLoop(bot);
  const work = prepareDay('work-checkin', date);
  if (work && !lifeDayIsClosed(work) && work.status !== 'failed' && work.next_trigger_at && new Date(work.next_trigger_at).getTime() <= Date.now()) {
    const followUp = atLifeTime(date, '09:59');
    const next = followUp.getTime() > Date.now() ? followUp.toISOString() : null;
    patchLifeDay('work-checkin', date, { next_trigger_at: next, status: work.last_sent_at ? 'awaiting' : next ? 'scheduled' : 'missed', reason: '已过的计划不自动补发。' });
  }
}

export function isVitaminEatenToday(): boolean {
  const day = getLifeDay('vitamin', bjDate());
  return day?.status === 'confirmed' || day?.status === 'legacy_closed';
}

export async function triggerVitaminReminder(bot: Telegraf): Promise<void> {
  if (!getLifeSettings('vitamin').enabled) return;
  const date = bjDate();
  const day = getLifeDay('vitamin', date) ?? createLifeDay('vitamin', date, new Date().toISOString());
  if (lifeDayIsClosed(day)) return;
  await sendSpecial(bot, 'vitamin', date);
}

export async function triggerBusReminder(bot: Telegraf): Promise<void> {
  if (!getLifeSettings('bus').enabled || !isChinaWorkdayStrict(new Date())) return;
  const date = bjDate();
  const day = getLifeDay('bus', date) ?? createLifeDay('bus', date, new Date().toISOString());
  if (lifeDayIsClosed(day) || (day.sent_count !== null && day.sent_count >= 3)) return;
  await sendSpecial(bot, 'bus', date);
}

export function beginWorkCheckin(date = bjDate()): void {
  requireToday(date);
  if (!getLifeSettings('work-checkin').enabled || !isChinaWorkdayStrict(new Date()) || bj().hour() >= 10) return;
  const day = getLifeDay('work-checkin', date);
  if (day && lifeDayIsClosed(day)) return;
  createLifeDay('work-checkin', date, atLifeTime(date, '09:55').toISOString());
  patchLifeDay('work-checkin', date, { status: 'scheduled', next_trigger_at: null, finished_at: null, reason: null });
}

export async function sendMorningNewsWithWorkCheckin(message: string, bot?: Telegraf): Promise<void> {
  const date = bjDate();
  const day = getLifeDay('work-checkin', date);
  if (!day || lifeDayIsClosed(day) || !getLifeSettings('work-checkin').enabled || bj().hour() >= 10) {
    await sendTelegramMessage(message, bot);
    return;
  }
  const sent = await sendTracked(bot, 'work-checkin', date, message);
  const followUp = atLifeTime(date, '09:59');
  const current = getLifeDay('work-checkin', date)!;
  if (sent && !lifeDayIsClosed(current) && current.next_trigger_at === null && followUp.getTime() > Date.now()) {
    patchLifeDay('work-checkin', date, { next_trigger_at: followUp.toISOString() });
  }
}

export function recordWorkCheckinError(error: unknown, date: string): void {
  const day = getLifeDay('work-checkin', date);
  if (day && !lifeDayIsClosed(day)) {
    patchLifeDay('work-checkin', date, {
      error: error instanceof Error ? error.message : String(error),
      ...(day.status === 'scheduled' && day.next_trigger_at === null ? { status: 'failed' as const, finished_at: new Date().toISOString() } : {}),
    });
  }
}

export async function sendWorkCheckinFollowUpIfPending(bot: Telegraf): Promise<void> {
  const day = getLifeDay('work-checkin', bjDate());
  if (!day || lifeDayIsClosed(day) || day.status === 'failed' || !getLifeSettings('work-checkin').enabled) return;
  await sendTracked(bot, 'work-checkin', day.date_key, formatWorkCheckinFollowUpMessage());
}

export async function closeExpiredWorkCheckin(bot: Telegraf): Promise<void> {
  const day = getLifeDay('work-checkin', bjDate());
  if (bj().hour() >= 10 && day && !lifeDayIsClosed(day)) await finishDay(bot, 'work-checkin', day.date_key, 'auto_closed', '已到 10:00 打卡提醒截止时间。');
}

export async function completeWorkCheckin(bot: Telegraf, date = bjDate()): Promise<boolean> {
  await actLife(bot, 'work-checkin', date, 'confirm');
  return true;
}

export async function completeBusReminder(bot: Telegraf, date = bjDate()): Promise<boolean> {
  await actLife(bot, 'bus', date, 'confirm');
  return true;
}

export async function actLife(bot: Telegraf, rawKind: unknown, date: string, rawAction: unknown): Promise<LifeDashboard> {
  const kind = lifeKindSchema.parse(rawKind);
  const action = lifeActionSchema.parse(rawAction);
  requireToday(date);
  const settings = getLifeSettings(kind);
  if (!settings.enabled) throw Object.assign(new Error('请先开启这项生活提醒。'), { statusCode: 409 });
  if (!windowFor(settings, date)) throw Object.assign(new Error('今天不是这项提醒的执行日。'), { statusCode: 409 });
  const day = getLifeDay(kind, date) ?? prepareDay(kind, date);
  if (day && lifeDayIsClosed(day)) throw Object.assign(new Error('今天的这项提醒已经结束。'), { statusCode: 409 });
  if (action === 'snooze') {
    if (kind !== 'vitamin') throw Object.assign(new Error('只有维生素支持 30 分钟后提醒。'), { statusCode: 400 });
    const next = bj().add(30, 'minute');
    if (next.format('YYYY-MM-DD') !== date) throw Object.assign(new Error('30 分钟后已是次日，无法延后今天的提醒。'), { statusCode: 400 });
    createLifeDay(kind, date, next.toISOString());
    patchLifeDay(kind, date, { status: 'snoozed', next_trigger_at: next.toISOString(), finished_at: null, reason: '30 分钟后提醒', error: null });
    try {
      scheduleAt(bot, kind, date, next.toISOString());
      await clearButtons(bot, kind, date);
    }
    catch (error) { throw Object.assign(error instanceof Error ? error : new Error(String(error)), { applied: true }); }
  } else {
    await finishDay(bot, kind, date, action === 'confirm' ? 'confirmed' : 'stopped', action === 'confirm' ? '用户确认完成。' : '今天不再提醒。');
  }
  try { return readLifeDashboard(date); }
  catch (error) { throw Object.assign(error instanceof Error ? error : new Error(String(error)), { applied: true }); }
}

export async function updateLifeSettings(bot: Telegraf, rawKind: unknown, input: unknown): Promise<LifeDashboard> {
  const kind = lifeKindSchema.parse(rawKind);
  const fields = z.record(z.string(), z.unknown()).parse(input);
  const settings = lifeSettingsSchema.parse({ ...fields, kind });
  windowFor(settings, bjDate());
  const previous = getLifeSettings(kind);
  if (JSON.stringify(settings) === JSON.stringify(previous)) return readLifeDashboard(bjDate());
  saveLifeSettings(settings);
  try {
    cancelJob(kind);
    const day = getLifeDay(kind, bjDate());
    if (!settings.enabled) {
      if (!day || !lifeDayIsClosed(day)) await finishDay(bot, kind, bjDate(), 'stopped', '长期关闭了这项提醒。');
    } else {
      const rescheduleUnsent = !!day && day.settings_json !== null && day.last_sent_at === null && day.sent_count === 0 && (day.status === 'scheduled' || day.status === 'missed' || day.status === 'failed' || (!previous.enabled && day.status === 'stopped' && day.reason === '长期关闭了这项提醒。'));
      prepareDay(kind, bjDate(), rescheduleUnsent);
      if (kind === 'vitamin') restoreVitaminLoop(bot);
      if (kind === 'bus') restoreBusReminderLoop(bot);
      if (kind === 'work-checkin') await closeExpiredWorkCheckin(bot);
    }
    return readLifeDashboard(bjDate());
  } catch (error) {
    throw Object.assign(error instanceof Error ? error : new Error(String(error)), { applied: true });
  }
}

function fixedRules(date: string): FixedLifeRule[] {
  const workday = isChinaWorkdayStrict(bj(date).toDate());
  const rows: Array<[string, string, string, string, string | null, boolean]> = [
    ['sleep', '休息提醒', '每天 00:10，仅发送提示', '00:10', null, true],
    ['wakeup', '起床提醒', '每天 08:30，仅发送提示', '08:30', null, true],
    ['coffee', '咖啡提醒', '中国工作日 08:58，仅发送提示', '08:58', null, workday],
    ['photo', '拍照提醒', '中国工作日 12:55–14:00 随机提示', '12:55', '14:00', workday],
    ['lu', 'Lu 记录提示', '每天 22:00，当天无记录时提示；可忽略', '22:00', null, true],
  ];
  return rows.map(([id, title, rule, start, end, applies]) => ({ id, title, rule, nextAt: applies && !end ? atLifeTime(date, start).toISOString() : null, windowStart: applies ? atLifeTime(date, start).toISOString() : null, windowEnd: applies && end ? atLifeTime(date, end).toISOString() : null }));
}

export function readLifeDashboard(date = bjDate()): LifeDashboard {
  lifeDateSchema.parse(date);
  const items: LifeItem[] = lifeKinds.map(kind => {
    const settings = getLifeSettings(kind);
    const day = getLifeDay(kind, date);
    const currentWindow = windowFor(settings, date);
    const instanceSettings = day?.settings_json ? lifeSettingsSchema.parse(JSON.parse(day.settings_json)) : null;
    const window = day ? instanceSettings ? windowFor(instanceSettings, date) : null : currentWindow;
    const today = date === bjDate();
    const future = date >= bjDate();
    const actionable = today && settings.enabled && currentWindow !== null && (!day || !lifeDayIsClosed(day));
    const actions: LifeAction[] = actionable ? ['confirm', ...(kind === 'vitamin' && settings.enabled ? ['snooze' as const] : []), 'stop'] : [];
    const plan = settings.enabled && window !== null && future;
    const busMaxReached = kind === 'bus' && (day?.sent_count ?? 0) >= 3;
    return {
      kind, title: lifeTitles[kind], date,
      status: day?.status ?? (plan ? 'scheduled' : 'not_scheduled'),
      firstTriggerAt: day ? day.first_trigger_at : plan && !window.end ? window.start.toISOString() : null,
      nextTriggerAt: busMaxReached ? null : day?.next_trigger_at ?? (day ? null : plan && !window.end ? window.start.toISOString() : null),
      windowStart: plan ? window.start.toISOString() : null,
      windowEnd: plan && window.end ? window.end.toISOString() : null,
      lastSentAt: day?.last_sent_at ?? null, finishedAt: day?.finished_at ?? null, sentCount: day?.sent_count ?? null,
      error: day?.error ?? null, reason: day?.reason ?? null, enabled: settings.enabled,
      rule: instanceSettings ? ruleText(instanceSettings) : day ? '历史规则未记录' : ruleText(settings),
      settings, actions,
    };
  });
  return { date, items, fixedRules: fixedRules(date) };
}

export function readLifeHistory(from: string, to: string): ReminderHistoryItem[] {
  lifeDateSchema.parse(from);
  lifeDateSchema.parse(to);
  const rows = getDb().prepare('SELECT * FROM life_reminder_days WHERE date_key >= ? AND date_key <= ? ORDER BY date_key DESC').all(from, to) as LifeDay[];
  return rows.flatMap((day): ReminderHistoryItem[] => {
    const result: ReminderHistoryItem[] = [];
    const base = { kind: day.kind, entityId: null, ruleId: null, text: lifeTitles[day.kind], triggerAt: day.first_trigger_at, date: day.date_key };
    if (day.last_sent_at) {
      result.push({ ...base, id: `life:sent:${day.kind}:${day.date_key}`, occurredAt: day.last_sent_at, action: 'sent', deliveryStatus: 'sent', note: '当天最近一次发送；不代表已经完成。', error: null });
    }
    if (!['scheduled', 'snoozed', 'awaiting'].includes(day.status)) {
      result.push({ ...base, id: `life:${day.kind}:${day.date_key}`, occurredAt: day.finished_at ?? day.last_sent_at,
        action: day.status, deliveryStatus: day.error ? 'failed' : day.last_sent_at ? 'sent' : day.status === 'missed' ? 'missed' : day.sent_count === 0 ? 'waiting' : 'unknown', note: day.reason, error: day.error });
    }
    return result;
  });
}
