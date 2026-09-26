import Fastify from 'fastify';
import { timingSafeEqual } from 'node:crypto';
import type { Telegraf } from 'telegraf';
import { z } from 'zod';
import { config } from '../config/index.js';
import { bjDate, shiftBjDate } from '../utils/time.js';
import * as repo from './repository.js';
import { actOnceReminder, actRuleReminder, actReminderRun, createOnceReminder, createRuleReminder, previewReminderRule, reminderError, requireOnce, requireRule, updateOnceReminder, updateRuleReminder } from './actions.js';
import { onceItem, runItem, ruleView, readReminderBoard, readReminderList, readReminderHistory } from './dashboard.js';
import { actLife, readLifeDashboard, updateLifeSettings } from './lifeDashboard.js';

const dateSchema = z.iso.date();
const instantSchema = z.iso.datetime({ offset: true });
const textSchema = z.string().trim().min(1, '请输入提醒内容。').max(1000);
const revisionSchema = z.number().int().positive();
const recurrenceSchema = z.object({
  freq: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
  byweekday: z.array(z.enum(['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'])).max(7),
  bymonthday: z.array(z.number().int().min(1).max(31)).max(31),
  time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, '时间格式应为 HH:mm。'),
  timezone: z.string().min(1), calendarFilter: z.enum(['china_workday']).nullable(),
}).superRefine((value, ctx) => {
  if (value.freq === 'WEEKLY' && value.byweekday.length === 0) ctx.addIssue({ code: 'custom', message: '请选择至少一个星期。' });
  if (value.freq === 'MONTHLY' && value.bymonthday.length === 0) ctx.addIssue({ code: 'custom', message: '请选择每月日期。' });
  if (value.calendarFilter && (value.freq !== 'DAILY' || value.byweekday.length || value.bymonthday.length)) ctx.addIssue({ code: 'custom', message: '中国工作日必须使用每天规则。' });
  if ((value.freq !== 'WEEKLY' && value.byweekday.length) || (value.freq !== 'MONTHLY' && value.bymonthday.length)) ctx.addIssue({ code: 'custom', message: '星期或日期与所选频率不一致。' });
  try { new Intl.DateTimeFormat('zh-CN', { timeZone: value.timezone }); } catch { ctx.addIssue({ code: 'custom', message: '时区无效。' }); }
});
const onceSchema = z.object({ text: textSchema, triggerAt: instantSchema });
const ruleSchema = z.object({ text: textSchema, recurrence: recurrenceSchema });
const pagination = { offset: z.coerce.number().int().min(0).default(0), limit: z.coerce.number().int().min(1).max(200).default(30) };
const lifeKind = z.enum(['vitamin', 'work-checkin', 'bus']);
function id(input: string): number { return z.coerce.number().int().positive().parse(input); }

export async function startReminderDashboardApi(bot: Telegraf): Promise<void> {
  const token = process.env.REMINDER_DASHBOARD_API_TOKEN;
  if (!token) return;
  const port = z.coerce.number().int().min(1).max(65535).parse(process.env.REMINDER_DASHBOARD_API_PORT ?? '3421');
  const api = Fastify({ bodyLimit: 16384 });
  api.addHook('onRequest', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    const supplied = Buffer.from(request.headers.authorization ?? '');
    const expected = Buffer.from(`Bearer ${token}`);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return reply.code(401).send({ error: 'Unauthorized' });
  });
  api.setErrorHandler((error, _request, reply) => {
    const detail = error as { statusCode?: number; applied?: boolean };
    reply.code(error instanceof z.ZodError ? 400 : detail.statusCode ?? 500).send({
      error: error instanceof z.ZodError ? error.issues.map(issue => issue.message).join('；') : error instanceof Error ? error.message : String(error),
      ...(detail.applied ? { applied: true } : {}),
    });
  });
  api.get('/api/reminders/board', async request => {
    const query = z.object({ date: dateSchema.default(bjDate()), days: z.coerce.number().refine(value => value === 1 || value === 7).default(1) }).parse(request.query);
    return readReminderBoard(query.date, query.days);
  });
  api.get('/api/reminders/items', async request => {
    const query = z.object({ q: z.string().max(1000).optional(), status: z.enum(['active', 'all', 'scheduled', 'snoozed', 'awaiting', 'done', 'cancelled', 'missed', 'failed', 'unknown']).default('active'),
      from: dateSchema.optional(), to: dateSchema.optional(), ...pagination }).parse(request.query);
    if (query.from && query.to && query.from > query.to) throw reminderError('结束日期不能早于开始日期。', 400);
    return readReminderList(query);
  });
  api.get<{ Params: { id: string } }>('/api/reminders/items/:id', async request => ({ servedAt: new Date().toISOString(), item: onceItem(requireOnce(id(request.params.id))) }));
  api.post('/api/reminders/items', async request => {
    const input = onceSchema.parse(request.body);
    return { ok: true, item: onceItem(createOnceReminder(bot, { chat_id: config.tgChatId, text: input.text, trigger_at: new Date(input.triggerAt) })) };
  });
  api.put<{ Params: { id: string } }>('/api/reminders/items/:id', async request => {
    const input = onceSchema.extend({ revision: revisionSchema }).parse(request.body);
    return { ok: true, item: onceItem(await updateOnceReminder(bot, id(request.params.id), input.revision, { text: input.text, triggerAt: new Date(input.triggerAt) })) };
  });
  api.post<{ Params: { id: string } }>('/api/reminders/items/:id/actions', async request => {
    const input = z.object({ action: z.enum(['done', 'cancel', 'snooze']), revision: revisionSchema, triggerAt: instantSchema.optional() }).parse(request.body);
    return { ok: true, item: onceItem(await actOnceReminder(bot, id(request.params.id), input.revision, input.action, input.triggerAt ? new Date(input.triggerAt) : undefined)) };
  });
  api.get('/api/reminders/rules', async request => {
    const query = z.object({ status: z.enum(['all', 'active', 'paused', 'cancelled']).default('all') }).parse(request.query);
    return { servedAt: new Date().toISOString(), rules: repo.listRecurringRules(config.tgChatId).filter(row => query.status === 'all' || row.status === query.status).map(ruleView) };
  });
  api.get<{ Params: { id: string } }>('/api/reminders/rules/:id', async request => {
    const rule = requireRule(id(request.params.id));
    return { servedAt: new Date().toISOString(), rule: ruleView(rule), runs: repo.listRecurringRuns(config.tgChatId, rule.id).map(runItem) };
  });
  api.post('/api/reminders/rules/preview', async request => {
    const input = ruleSchema.parse(request.body);
    const { rruleText: _rruleText, ...preview } = previewReminderRule(input.recurrence);
    return preview;
  });
  api.post('/api/reminders/rules', async request => {
    const input = ruleSchema.parse(request.body);
    if (input.recurrence.timezone !== 'Asia/Shanghai') throw reminderError('新建规则请使用北京时间。', 400);
    const preview = previewReminderRule(input.recurrence);
    return { ok: true, rule: ruleView(createRuleReminder(bot, { chat_id: config.tgChatId, text: input.text, timezone: input.recurrence.timezone,
      rrule_text: preview.rruleText, calendar_filter: input.recurrence.calendarFilter, next_trigger_at: new Date(preview.nextTriggerAt), source: 'deterministic' })) };
  });
  api.put<{ Params: { id: string } }>('/api/reminders/rules/:id', async request => {
    const input = ruleSchema.extend({ revision: revisionSchema }).parse(request.body);
    return { ok: true, rule: ruleView(await updateRuleReminder(bot, id(request.params.id), input.revision, input.text, input.recurrence)) };
  });
  api.post<{ Params: { id: string } }>('/api/reminders/rules/:id/actions', async request => {
    const input = z.object({ action: z.enum(['pause', 'resume', 'end']), revision: revisionSchema }).parse(request.body);
    return { ok: true, rule: ruleView(await actRuleReminder(bot, id(request.params.id), input.revision, input.action)) };
  });
  api.post<{ Params: { id: string } }>('/api/reminders/runs/:id/actions', async request => {
    const input = z.object({ action: z.enum(['done', 'skip']), revision: revisionSchema }).parse(request.body);
    return { ok: true, item: runItem(await actReminderRun(bot, id(request.params.id), input.revision, input.action)) };
  });
  api.get('/api/reminders/history', async request => {
    const query = z.object({ from: dateSchema.default(shiftBjDate(bjDate(), -6)), to: dateSchema.default(bjDate()),
      kind: z.enum(['all', 'once', 'run', 'rule', 'vitamin', 'work-checkin', 'bus']).default('all'), ...pagination }).parse(request.query);
    if (query.from > query.to) throw reminderError('结束日期不能早于开始日期。', 400);
    return readReminderHistory(query);
  });
  api.get('/api/reminders/life', async request => {
    const query = z.object({ date: dateSchema.default(bjDate()) }).parse(request.query);
    return readLifeDashboard(query.date);
  });
  api.post<{ Params: { kind: string } }>('/api/reminders/life/:kind/actions', async request => {
    const input = z.object({ date: dateSchema, action: z.enum(['confirm', 'snooze', 'stop']) }).parse(request.body);
    return actLife(bot, lifeKind.parse(request.params.kind), input.date, input.action);
  });
  api.put<{ Params: { kind: string } }>('/api/reminders/life/:kind/settings', async request => updateLifeSettings(bot, lifeKind.parse(request.params.kind), request.body));
  await api.listen({ host: '127.0.0.1', port });
  process.once('SIGINT', () => { void api.close(); });
  process.once('SIGTERM', () => { void api.close(); });
  console.log(`Reminder internal dashboard API listening on 127.0.0.1:${port}`);
}
