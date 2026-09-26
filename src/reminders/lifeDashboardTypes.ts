export type LifeKind = 'vitamin' | 'work-checkin' | 'bus';
export type LifeAction = 'confirm' | 'snooze' | 'stop';
export type LifeStatus = 'scheduled' | 'awaiting' | 'snoozed' | 'confirmed' | 'stopped' | 'auto_closed' | 'missed' | 'failed' | 'legacy_unknown' | 'legacy_closed' | 'not_scheduled';

export type LifeSettings =
  | { kind: 'vitamin'; enabled: boolean; workdayStart: string; workdayEnd: string; restdayTime: string }
  | { kind: 'work-checkin'; enabled: boolean }
  | { kind: 'bus'; enabled: boolean; time: string };

export interface LifeItem {
  kind: LifeKind;
  title: string;
  date: string;
  status: LifeStatus;
  firstTriggerAt: string | null;
  nextTriggerAt: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  lastSentAt: string | null;
  finishedAt: string | null;
  sentCount: number | null;
  error: string | null;
  reason: string | null;
  enabled: boolean;
  rule: string;
  settings: LifeSettings;
  actions: LifeAction[];
}

export interface FixedLifeRule {
  id: string;
  title: string;
  rule: string;
  nextAt: string | null;
  windowStart: string | null;
  windowEnd: string | null;
}

export interface LifeDashboard {
  date: string;
  items: LifeItem[];
  fixedRules: FixedLifeRule[];
}
