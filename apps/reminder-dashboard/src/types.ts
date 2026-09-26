export type * from '../../../src/reminders/dashboardTypes'
export type * from '../../../src/reminders/lifeDashboardTypes'
import type { ReminderItem, ReminderRuleView } from '../../../src/reminders/dashboardTypes'

export type ViewName = 'today' | 'items' | 'rules' | 'life' | 'history'
export interface RuleDetailResponse { servedAt: string; rule: ReminderRuleView; runs: ReminderItem[] }
export interface RulePreviewResponse { summary: string; nextTriggerAt: string; preview: string[]; timezone: string }
export interface Feedback { text: string; error: boolean }
export interface Preset { id: string; label: string; reminderText: string; minutes: number }
export const viewFromPath = (path: string): ViewName => ({ '/': 'today', '/reminders': 'items', '/rules': 'rules', '/life': 'life', '/history': 'history' } as Record<string, ViewName>)[path]!
