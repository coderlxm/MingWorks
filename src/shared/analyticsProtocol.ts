import { z } from 'zod';

export const analyticsEventNames = [
  'outbound_click', 'search', 'reaction', 'comment', 'guestbook_message', 'resume_download_click',
] as const;
export type AnalyticsEventName = typeof analyticsEventNames[number];
export type AnalyticsDevice = 'desktop' | 'mobile' | 'tablet' | 'unknown';

export const analyticsPublicPathPattern = /^(?:\/(?:about|resume|search|games|ai|guestbook)?|\/archive(?:\/\d{4}\/(?:0[1-9]|1[0-2]))?|\/photos(?:\/[0-9a-f]{64})?|\/p\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

const identity = z.string().uuid();
const campaign = z.string().trim().max(100).default('');
export const analyticsPageviewSchema = z.object({
  id: identity,
  visitorId: identity,
  sessionId: identity,
  path: z.string().max(300).regex(analyticsPublicPathPattern),
  referrer: z.string().max(2048).default(''),
  utmSource: campaign,
  utmMedium: campaign,
  utmCampaign: campaign,
});
export type AnalyticsPageviewInput = z.input<typeof analyticsPageviewSchema>;

export const analyticsActivitySchema = z.object({
  pageviewId: identity,
  visitorId: identity,
  activeMs: z.number().int().min(0).max(86_400_000),
});
export type AnalyticsActivityInput = z.infer<typeof analyticsActivitySchema>;

export const analyticsEventSchema = z.object({
  pageviewId: identity,
  visitorId: identity,
  name: z.enum(analyticsEventNames),
  target: z.string().trim().max(253).default(''),
});
export type AnalyticsEventInput = z.input<typeof analyticsEventSchema>;

export interface AnalyticsFilters {
  from: string;
  to: string;
  path?: string | undefined;
  referrer?: string | undefined;
  device?: AnalyticsDevice | undefined;
}

export interface AnalyticsMetrics {
  visitors: number;
  pageviews: number;
  sessions: number;
  bounceRate: number;
  avgDurationSeconds: number;
}

export interface AnalyticsBreakdown {
  name: string;
  visitors: number;
  pageviews: number;
}

export interface AnalyticsOverview {
  timezone: 'Asia/Shanghai';
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
  firstCollectedAt: string | null;
  generatedAt: string;
  current: AnalyticsMetrics;
  previous: AnalyticsMetrics;
  daily: Array<{ date: string; visitors: number; pageviews: number; sessions: number }>;
  pages: AnalyticsBreakdown[];
  referrers: AnalyticsBreakdown[];
  devices: AnalyticsBreakdown[];
  browsers: AnalyticsBreakdown[];
  systems: AnalyticsBreakdown[];
  campaigns: Array<AnalyticsBreakdown & { source: string; medium: string; campaign: string }>;
  events: Array<{ name: AnalyticsEventName; target: string; count: number; visitors: number }>;
  realtime: {
    visitors: number;
    pageviews: number;
    pages: AnalyticsBreakdown[];
    recent: Array<{ path: string; referrer: string; device: AnalyticsDevice; createdAt: string }>;
  };
}
