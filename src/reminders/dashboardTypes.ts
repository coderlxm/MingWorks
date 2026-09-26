export type ReminderDisplayStatus = 'scheduled' | 'snoozed' | 'awaiting' | 'done' | 'cancelled' | 'skipped' | 'missed' | 'failed' | 'unknown';
export type ReminderDeliveryStatus = 'waiting' | 'sending' | 'sent' | 'failed' | 'missed' | 'unknown';
export interface ReminderItem {
  key: string;
  kind: 'once' | 'run' | 'forecast';
  id: number;
  ruleId: number | null;
  text: string;
  triggerAt: string;
  date: string;
  timezone: string;
  status: ReminderDisplayStatus;
  deliveryStatus: ReminderDeliveryStatus;
  sentAt: string | null;
  actedAt: string | null;
  error: string | null;
  note: string | null;
  revision: number;
}
export interface ReminderRecurrenceInput {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  byweekday: string[];
  bymonthday: number[];
  time: string;
  timezone: string;
  calendarFilter: 'china_workday' | null;
}
export interface ReminderRuleView {
  id: number;
  text: string;
  status: 'active' | 'paused' | 'cancelled';
  timezone: string;
  summary: string;
  recurrence: ReminderRecurrenceInput;
  nextTriggerAt: string | null;
  preview: string[];
  revision: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface ReminderBoardResponse {
  servedAt: string;
  date: string;
  timezone: 'Asia/Shanghai';
  pending: ReminderItem[];
  upcoming: ReminderItem[];
  handled: ReminderItem[];
  issues: ReminderItem[];
}
export interface ReminderListResponse { servedAt: string; items: ReminderItem[]; total: number; nextOffset: number | null }
export interface ReminderRulesResponse { servedAt: string; rules: ReminderRuleView[] }
export interface ReminderHistoryItem {
  id: string;
  kind: 'once' | 'run' | 'rule' | 'vitamin' | 'work-checkin' | 'bus';
  entityId: number | null;
  ruleId: number | null;
  text: string;
  triggerAt: string | null;
  occurredAt: string | null;
  date: string;
  action: string;
  deliveryStatus: ReminderDeliveryStatus;
  note: string | null;
  error: string | null;
}
export interface ReminderHistoryResponse { servedAt: string; items: ReminderHistoryItem[]; total: number; nextOffset: number | null }
export interface ReminderMutationResponse { ok: true; item?: ReminderItem; rule?: ReminderRuleView }
export interface ReminderApiError { error: string; applied?: boolean }
export interface ReminderOnceInput { text: string; triggerAt: string }
export interface ReminderRuleInput { text: string; recurrence: ReminderRecurrenceInput }
