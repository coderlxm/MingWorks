import schedule from 'node-schedule';
import type { Telegraf } from 'telegraf';
import type { Reminder, RecurringRule } from './repository.js';
import * as repo from './repository.js';
import { formatReminderMessage, buildReminderButtons, formatRecurringReminderMessage, buildRecurringReminderButtons } from './formatter.js';
import { getNextTrigger } from './recurring.js';
import { getDb } from './db.js';

const jobs = new Map<number, schedule.Job>();
const recurJobs = new Map<number, schedule.Job>();

export function scheduleReminder(bot: Telegraf, reminder: Reminder): void {
  cancelScheduledReminder(reminder.id);
  const triggerAt = new Date(reminder.trigger_at);

  const job = schedule.scheduleJob(triggerAt, async () => {
    const current = repo.findReminderById(reminder.id);
    if (!current || current.status !== 'pending' || current.revision !== reminder.revision) return;
    repo.markOnceDelivery(current.id, current.revision, 'sending');

    try {
      const msg = await bot.telegram.sendMessage(
        reminder.chat_id,
        formatReminderMessage(current),
        {
          parse_mode: 'HTML',
          link_preview_options: { is_disabled: true },
          ...buildReminderButtons(current.id, current.revision)
        }
      );
      repo.setSentMessageId(current.id, msg.message_id);
      repo.recordOnceHistory(repo.findReminderById(current.id)!, 'sent');
    } catch (err) {
      repo.markOnceDelivery(current.id, current.revision, 'failed', err instanceof Error ? err.message : String(err));
      repo.recordOnceHistory(repo.findReminderById(current.id)!, 'send_failed');
      throw err;
    }
  });

  if (!job) {
    repo.markOnceDelivery(reminder.id, reminder.revision, 'missed');
    repo.recordOnceHistory(repo.findReminderById(reminder.id)!, 'missed');
    throw new Error(`提醒时间已过，未能安排：${reminder.trigger_at}`);
  }
  job.on('error', error => console.error(`Reminder id=${reminder.id} failed:`, error));
  jobs.set(reminder.id, job);
}

export function cancelScheduledReminder(id: number): void {
  const job = jobs.get(id);
  if (job) {
    job.cancel();
    jobs.delete(id);
  }
}

export function schedulePendingReminders(bot: Telegraf): void {
  const reminders = repo.findPendingReminders();
  const now = new Date();

  for (const reminder of reminders) {
    const triggerAt = new Date(reminder.trigger_at);
    if (triggerAt <= now) {
      if (reminder.delivery_status === 'sent' || reminder.delivery_status === 'failed' || reminder.delivery_status === 'missed'
        || reminder.delivery_status === 'unknown') continue;
      if (reminder.delivery_status === 'sending') {
        repo.markOnceDelivery(reminder.id, reminder.revision, 'unknown', '发送过程中服务中断，发送结果未知。');
        repo.recordOnceHistory(repo.findReminderById(reminder.id)!, 'delivery_unknown');
      } else if (reminder.delivery_status === 'waiting') {
        repo.markOnceDelivery(reminder.id, reminder.revision, 'missed');
        repo.recordOnceHistory(repo.findReminderById(reminder.id)!, 'missed');
      }
      continue;
    }
    scheduleReminder(bot, reminder);
  }

  if (reminders.length > 0) {
    console.log(`Scheduled ${reminders.length} pending reminder(s).`);
  }
}

function scheduleRecurringRule(bot: Telegraf, rule: RecurringRule): void {
  cancelRecurringJob(rule.id);
  let triggerAt = new Date(rule.next_trigger_at);
  const now = new Date();
  if (triggerAt <= now) {
    triggerAt = getNextTrigger(rule.rrule_text, rule.timezone, now, false, rule.calendar_filter);
    repo.updateRecurringNextTrigger(rule.id, triggerAt);
  }

  const job = schedule.scheduleJob(triggerAt, async () => {
    const current = repo.findRecurringRuleById(rule.id);
    if (!current || current.status !== 'active' || current.revision !== rule.revision) return;

    const run = repo.createRecurringRun({ rule_id: rule.id, trigger_at: new Date(current.next_trigger_at) });
    try {
      const nextTrigger = getNextTrigger(current.rrule_text, current.timezone, new Date(current.next_trigger_at), false, current.calendar_filter);
      repo.updateRecurringNextTrigger(rule.id, nextTrigger);
      scheduleRecurringRule(bot, { ...current, next_trigger_at: nextTrigger.toISOString() });
      const msg = await bot.telegram.sendMessage(
        rule.chat_id,
        formatRecurringReminderMessage(current),
        {
          parse_mode: 'HTML',
          link_preview_options: { is_disabled: true },
          ...buildRecurringReminderButtons(current.id, run.id, current.revision, run.revision),
        }
      );
      repo.setRecurringRunSentMessageId(run.id, msg.message_id);
      getDb().prepare('UPDATE recurring_reminder_rules SET last_triggered_at = ? WHERE id = ?').run(current.next_trigger_at, rule.id);
      getDb().prepare('UPDATE recurring_reminder_rules SET last_error = NULL WHERE id = ? AND revision = ?').run(rule.id, current.revision);
      repo.recordRunHistory(repo.findRecurringRunById(run.id)!, 'sent');
    } catch (err) {
      repo.markRunDelivery(run.id, 'failed', err instanceof Error ? err.message : String(err));
      repo.recordRunHistory(repo.findRecurringRunById(run.id)!, 'send_failed');
      getDb().prepare('UPDATE recurring_reminder_rules SET last_error = ? WHERE id = ? AND revision = ?')
        .run(err instanceof Error ? err.message : String(err), rule.id, current.revision);
      throw err;
    }
  });

  if (!job) {
    throw new Error(`Failed to schedule recurring rule id=${rule.id} trigger_at=${triggerAt.toISOString()}`);
  }
  job.on('error', error => console.error(`Recurring reminder rule_id=${rule.id} failed:`, error));
  recurJobs.set(rule.id, job);
}

export function cancelRecurringJob(id: number): void {
  const job = recurJobs.get(id);
  if (job) {
    job.cancel();
    recurJobs.delete(id);
  }
}

export function schedulePendingRecurringRules(bot: Telegraf): void {
  const interrupted = getDb().prepare("SELECT * FROM recurring_reminder_runs WHERE delivery_status = 'sending'").all() as repo.RecurringRun[];
  getDb().transaction(() => {
    for (const run of interrupted) {
      repo.markRunDelivery(run.id, 'unknown', '发送过程中服务中断，发送结果未知。');
      repo.recordRunHistory(repo.findRecurringRunById(run.id)!, 'delivery_unknown');
    }
  })();
  const rules = repo.findActiveRecurringRules();

  for (const rule of rules) {
    try {
      scheduleRecurringRule(bot, rule);
    } catch (err) {
      console.error(`Failed to schedule recurring rule id=${rule.id}:`, err);
      throw err;
    }
  }

  if (rules.length > 0) {
    console.log(`Scheduled ${rules.length} recurring rule(s).`);
  }
}

export { scheduleRecurringRule };
