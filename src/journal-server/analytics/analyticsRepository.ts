import type Database from 'better-sqlite3';
import type {
  AnalyticsBreakdown,
  AnalyticsDevice,
  AnalyticsEventName,
  AnalyticsFilters,
  AnalyticsMetrics,
  AnalyticsOverview,
} from '../../shared/analyticsProtocol.js';

const dayMs = 86_400_000;
const chinaOffsetMs = 8 * 60 * 60 * 1000;

interface AnalyticsPageviewRecord {
  id: string;
  visitorHash: string;
  sessionHash: string;
  path: string;
  referrer: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  browser: string;
  system: string;
  device: AnalyticsDevice;
  now: number;
}

interface QueryRange {
  where: string;
  params: Array<string | number>;
}

function dateLabel(timestamp: number): string {
  return new Date(timestamp + chinaOffsetMs).toISOString().slice(0, 10);
}

function filterRange(filters: AnalyticsFilters, from: number, to: number): QueryRange {
  const conditions = ['p.created_at >= ?', 'p.created_at < ?'];
  const params: Array<string | number> = [from, to];
  if (filters.path) {
    conditions.push('p.path = ?');
    params.push(filters.path);
  }
  if (filters.referrer) {
    conditions.push('p.referrer = ?');
    params.push(filters.referrer === '(direct)' ? '' : filters.referrer);
  }
  if (filters.device) {
    conditions.push('p.device = ?');
    params.push(filters.device);
  }
  return { where: conditions.join(' AND '), params };
}

export class AnalyticsRepository {
  constructor(private readonly database: Database.Database) {}

  recordPageview(input: AnalyticsPageviewRecord): void {
    this.database.prepare(`
      INSERT INTO journal_analytics_pageviews (
        id, visitor_hash, session_hash, path, referrer,
        utm_source, utm_medium, utm_campaign, browser, system, device,
        created_at, last_seen_at, active_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      ON CONFLICT(id) DO NOTHING
    `).run(
      input.id, input.visitorHash, input.sessionHash, input.path, input.referrer,
      input.utmSource, input.utmMedium, input.utmCampaign,
      input.browser, input.system, input.device, input.now, input.now,
    );
  }

  recordActivity(id: string, visitorHash: string, activeMs: number, now: number): boolean {
    return this.database.prepare(`
      UPDATE journal_analytics_pageviews
      SET active_ms = MAX(active_ms, MIN(?, MAX(0, ? - created_at))),
        last_seen_at = MAX(last_seen_at, ?)
      WHERE id = ? AND visitor_hash = ?
    `).run(activeMs, now, now, id, visitorHash).changes > 0;
  }

  recordEvent(input: {
    pageviewId: string;
    visitorHash: string;
    name: AnalyticsEventName;
    target: string;
    now: number;
  }): boolean {
    return this.database.prepare(`
      INSERT INTO journal_analytics_events (pageview_id, name, target, created_at)
      SELECT id, ?, ?, ? FROM journal_analytics_pageviews
      WHERE id = ? AND visitor_hash = ?
    `).run(input.name, input.target, input.now, input.pageviewId, input.visitorHash).changes > 0;
  }

  overview(filters: AnalyticsFilters, now = Date.now()): AnalyticsOverview {
    const from = Date.parse(`${filters.from}T00:00:00+08:00`);
    const to = Date.parse(`${filters.to}T00:00:00+08:00`) + dayMs;
    const length = to - from;
    const currentRange = filterRange(filters, from, to);
    const previousRange = filterRange(filters, from - length, from);
    const eventRange = filterRange(filters, 0, now + 1);
    eventRange.where += ' AND e.created_at >= ? AND e.created_at < ?';
    eventRange.params.push(from, to);
    const realtimeRange = filterRange(filters, 0, now + 1);
    realtimeRange.where += ' AND p.last_seen_at >= ?';
    realtimeRange.params.push(now - 5 * 60 * 1000);

    const rawDaily = this.database.prepare(`
      SELECT strftime('%Y-%m-%d', p.created_at / 1000, 'unixepoch', '+8 hours') AS date,
        COUNT(DISTINCT p.visitor_hash) AS visitors, COUNT(*) AS pageviews,
        COUNT(DISTINCT p.session_hash) AS sessions
      FROM journal_analytics_pageviews p
      WHERE ${currentRange.where}
      GROUP BY date ORDER BY date
    `).all(...currentRange.params) as AnalyticsOverview['daily'];
    const dailyByDate = new Map(rawDaily.map(row => [row.date, row]));
    const daily: AnalyticsOverview['daily'] = [];
    for (let day = from; day < to; day += dayMs) {
      const date = dateLabel(day);
      daily.push(dailyByDate.get(date) ?? { date, visitors: 0, pageviews: 0, sessions: 0 });
    }

    const campaigns = this.database.prepare(`
      SELECT p.utm_source AS source, p.utm_medium AS medium, p.utm_campaign AS campaign,
        COUNT(DISTINCT p.visitor_hash) AS visitors, COUNT(*) AS pageviews
      FROM journal_analytics_pageviews p
      WHERE ${currentRange.where}
        AND (p.utm_source != '' OR p.utm_medium != '' OR p.utm_campaign != '')
      GROUP BY p.utm_source, p.utm_medium, p.utm_campaign
      ORDER BY visitors DESC, pageviews DESC, source, medium, campaign LIMIT 20
    `).all(...currentRange.params) as Array<Omit<AnalyticsOverview['campaigns'][number], 'name'>>;

    const events = this.database.prepare(`
      SELECT e.name, e.target, COUNT(*) AS count,
        COUNT(DISTINCT p.visitor_hash) AS visitors
      FROM journal_analytics_events e
      JOIN journal_analytics_pageviews p ON p.id = e.pageview_id
      WHERE ${eventRange.where}
      GROUP BY e.name, e.target
      ORDER BY count DESC, e.name, e.target LIMIT 30
    `).all(...eventRange.params) as AnalyticsOverview['events'];

    const first = this.database.prepare(`
      SELECT MIN(created_at) AS first FROM journal_analytics_pageviews
    `).get() as { first: number | null };
    const realtimeMetrics = this.metrics(realtimeRange);
    const recent = this.database.prepare(`
      SELECT p.path, p.referrer, p.device, p.created_at AS createdAt
      FROM journal_analytics_pageviews p WHERE ${realtimeRange.where}
      ORDER BY p.last_seen_at DESC, p.created_at DESC LIMIT 12
    `).all(...realtimeRange.params) as Array<{
      path: string; referrer: string; device: AnalyticsDevice; createdAt: number;
    }>;

    return {
      timezone: 'Asia/Shanghai',
      from: filters.from,
      to: filters.to,
      previousFrom: dateLabel(from - length),
      previousTo: dateLabel(from - dayMs),
      firstCollectedAt: first.first === null ? null : new Date(first.first).toISOString(),
      generatedAt: new Date(now).toISOString(),
      current: this.metrics(currentRange),
      previous: this.metrics(previousRange),
      daily,
      pages: this.breakdown('path', currentRange),
      referrers: this.breakdown('referrer', currentRange),
      devices: this.breakdown('device', currentRange),
      browsers: this.breakdown('browser', currentRange),
      systems: this.breakdown('system', currentRange),
      campaigns: campaigns.map(row => ({
        ...row, name: [row.source, row.medium, row.campaign].filter(Boolean).join(' / '),
      })),
      events,
      realtime: {
        visitors: realtimeMetrics.visitors,
        pageviews: realtimeMetrics.pageviews,
        pages: this.breakdown('path', realtimeRange),
        recent: recent.map(row => ({ ...row, createdAt: new Date(row.createdAt).toISOString() })),
      },
    };
  }

  private metrics(range: QueryRange): AnalyticsMetrics {
    const totals = this.database.prepare(`
      SELECT COUNT(DISTINCT p.visitor_hash) AS visitors, COUNT(*) AS pageviews,
        COUNT(DISTINCT p.session_hash) AS sessions, COALESCE(SUM(p.active_ms), 0) AS activeMs
      FROM journal_analytics_pageviews p WHERE ${range.where}
    `).get(...range.params) as {
      visitors: number; pageviews: number; sessions: number; activeMs: number;
    };
    const bounce = this.database.prepare(`
      SELECT COUNT(*) AS count FROM (
        SELECT p.session_hash FROM journal_analytics_pageviews p
        WHERE ${range.where} GROUP BY p.session_hash HAVING COUNT(*) = 1
      )
    `).get(...range.params) as { count: number };
    return {
      visitors: totals.visitors,
      pageviews: totals.pageviews,
      sessions: totals.sessions,
      bounceRate: totals.sessions === 0 ? 0 : Math.round(bounce.count / totals.sessions * 1000) / 10,
      avgDurationSeconds: totals.sessions === 0 ? 0 : Math.round(totals.activeMs / totals.sessions / 1000),
    };
  }

  private breakdown(
    column: 'path' | 'referrer' | 'device' | 'browser' | 'system',
    range: QueryRange,
  ): AnalyticsBreakdown[] {
    return this.database.prepare(`
      SELECT p.${column} AS name, COUNT(DISTINCT p.visitor_hash) AS visitors,
        COUNT(*) AS pageviews
      FROM journal_analytics_pageviews p WHERE ${range.where}
      GROUP BY p.${column} ORDER BY visitors DESC, pageviews DESC, name LIMIT 20
    `).all(...range.params) as AnalyticsBreakdown[];
  }
}
