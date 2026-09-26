import type Database from 'better-sqlite3';
import { z } from 'zod';
import { getDb } from './db.js';
import { bj, bjDate } from '../utils/time.js';
import type { LifeKind, LifeSettings, LifeStatus } from './lifeDashboardTypes.js';

export const lifeKindSchema = z.enum(['vitamin', 'work-checkin', 'bus']);
export const lifeActionSchema = z.enum(['confirm', 'snooze', 'stop']);
export const lifeDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => bj(value).format('YYYY-MM-DD') === value, '日期无效。');
const clockTime = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, '时间格式应为 HH:mm。');
export const lifeSettingsSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('vitamin'), enabled: z.boolean(), workdayStart: clockTime, workdayEnd: clockTime, restdayTime: clockTime }),
  z.object({ kind: z.literal('work-checkin'), enabled: z.boolean() }),
  z.object({ kind: z.literal('bus'), enabled: z.boolean(), time: clockTime }),
]).refine(value => value.kind !== 'vitamin' || value.workdayStart < value.workdayEnd, '维生素随机窗口的结束时间必须晚于开始时间，且在同一天。');

export const lifeKinds: LifeKind[] = ['vitamin', 'work-checkin', 'bus'];
export const lifeTitles: Record<LifeKind, string> = { vitamin: '维生素', 'work-checkin': '上班打卡', bus: '下车提醒' };
const defaults: LifeSettings[] = [
  { kind: 'vitamin', enabled: true, workdayStart: '20:45', workdayEnd: '21:00', restdayTime: '18:30' },
  { kind: 'work-checkin', enabled: true },
  { kind: 'bus', enabled: true, time: '09:22' },
];

export interface LifeDay {
  kind: LifeKind;
  date_key: string;
  status: Exclude<LifeStatus, 'not_scheduled'>;
  first_trigger_at: string | null;
  next_trigger_at: string | null;
  last_sent_at: string | null;
  finished_at: string | null;
  sent_count: number | null;
  error: string | null;
  reason: string | null;
  settings_json: string | null;
}

export function migrateLifeDashboard(db: Database.Database): void {
  db.exec(`
    CREATE TABLE life_reminder_settings (kind TEXT PRIMARY KEY, settings_json TEXT NOT NULL);
    CREATE TABLE life_reminder_days (
      kind TEXT NOT NULL,
      date_key TEXT NOT NULL,
      status TEXT NOT NULL,
      first_trigger_at TEXT,
      next_trigger_at TEXT,
      last_sent_at TEXT,
      finished_at TEXT,
      sent_count INTEGER,
      error TEXT,
      reason TEXT,
      settings_json TEXT,
      PRIMARY KEY (kind, date_key)
    );
    CREATE TABLE life_reminder_messages (
      kind TEXT NOT NULL, date_key TEXT NOT NULL, message_id INTEGER NOT NULL,
      PRIMARY KEY (kind, date_key, message_id),
      FOREIGN KEY (kind, date_key) REFERENCES life_reminder_days(kind, date_key)
    );
    INSERT INTO life_reminder_days (kind, date_key, status, next_trigger_at, reason)
      SELECT 'vitamin', date_key, CASE WHEN eaten = 1 THEN 'legacy_closed' ELSE 'legacy_unknown' END,
        CASE WHEN loop_active = 1 THEN next_trigger_at ELSE NULL END,
        CASE WHEN eaten = 1 THEN '历史记录已处理，确认时间未记录' ELSE '历史提醒的发送和处理结果未完整记录' END
      FROM vitamin_reminders;
    INSERT INTO life_reminder_days (kind, date_key, status, finished_at, reason)
      SELECT 'work-checkin', date_key, CASE WHEN completed = 1 THEN 'legacy_closed' ELSE 'legacy_unknown' END,
        completed_at, '历史提醒的结束原因未记录' FROM work_checkins;
    INSERT INTO life_reminder_days (kind, date_key, status, next_trigger_at, sent_count, reason)
      SELECT 'bus', date_key, CASE WHEN completed = 1 THEN 'legacy_closed' ELSE 'legacy_unknown' END,
        CASE WHEN loop_active = 1 THEN next_trigger_at ELSE NULL END, count,
        '历史提醒的结束原因未记录' FROM bus_reminders;
    INSERT INTO life_reminder_messages SELECT 'vitamin', date_key, message_id FROM vitamin_sent_messages;
    INSERT INTO life_reminder_messages SELECT 'work-checkin', date_key, message_id FROM work_checkin_messages;
    INSERT INTO life_reminder_messages SELECT 'bus', date_key, message_id FROM bus_reminder_messages;
  `);
  const insert = db.prepare('INSERT INTO life_reminder_settings (kind, settings_json) VALUES (?, ?)');
  for (const settings of defaults) insert.run(settings.kind, JSON.stringify(settings));
}

export function getLifeSettings(kind: LifeKind): LifeSettings {
  const row = getDb().prepare('SELECT settings_json FROM life_reminder_settings WHERE kind = ?').get(kind) as { settings_json: string };
  return lifeSettingsSchema.parse(JSON.parse(row.settings_json));
}

export function saveLifeSettings(value: LifeSettings): void {
  getDb().prepare('UPDATE life_reminder_settings SET settings_json = ? WHERE kind = ?').run(JSON.stringify(value), value.kind);
}

export function getLifeDay(kind: LifeKind, date: string): LifeDay | undefined {
  return getDb().prepare('SELECT * FROM life_reminder_days WHERE kind = ? AND date_key = ?').get(kind, date) as LifeDay | undefined;
}

export function createLifeDay(kind: LifeKind, date: string, firstTriggerAt: string | null): LifeDay {
  getDb().prepare(`INSERT OR IGNORE INTO life_reminder_days
    (kind, date_key, status, first_trigger_at, next_trigger_at, sent_count, settings_json)
    VALUES (?, ?, 'scheduled', ?, ?, 0, ?)`)
    .run(kind, date, firstTriggerAt, firstTriggerAt, JSON.stringify(getLifeSettings(kind)));
  return getLifeDay(kind, date)!;
}

export function patchLifeDay(kind: LifeKind, date: string, patch: Partial<Omit<LifeDay, 'kind' | 'date_key'>>): void {
  const fields = Object.entries(patch);
  getDb().prepare(`UPDATE life_reminder_days SET ${fields.map(([key]) => `${key} = ?`).join(', ')} WHERE kind = ? AND date_key = ?`)
    .run(...fields.map(([, value]) => value), kind, date);
}

export function lifeDayIsClosed(day: LifeDay): boolean {
  return ['confirmed', 'stopped', 'auto_closed', 'legacy_closed'].includes(day.status);
}

export function requireToday(date: string): void {
  lifeDateSchema.parse(date);
  if (date !== bjDate()) throw Object.assign(new Error('这条提醒不属于今天，操作已失效。'), { statusCode: 409 });
}

export function atLifeTime(date: string, time: string): Date {
  const [hour, minute] = time.split(':').map(Number);
  return bj(date).hour(hour!).minute(minute!).second(0).millisecond(0).toDate();
}
