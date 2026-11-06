import type { AnalyticsDevice, AnalyticsEventName, AnalyticsFilters } from '../../../src/shared/analyticsProtocol';

export const numberFormat = new Intl.NumberFormat('zh-CN');
export const timezone = 'Asia/Shanghai';

export function todayInShanghai(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function dateRange(days: number): Pick<AnalyticsFilters, 'from' | 'to'> {
  const to = todayInShanghai();
  const from = new Date(`${to}T00:00:00+08:00`);
  from.setUTCDate(from.getUTCDate() - days + 1);
  return { from: new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(from), to };
}

export function formatTimestamp(value: string, includeYear = false): string {
  return new Intl.DateTimeFormat('zh-CN', { timeZone: timezone, year: includeYear ? 'numeric' : undefined, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));
}

export function formatDuration(seconds: number): string {
  const rounded = Math.round(seconds);
  return rounded < 60 ? `${rounded}秒` : `${Math.floor(rounded / 60)}分${rounded % 60}秒`;
}

export const deviceLabels: Record<AnalyticsDevice, string> = { desktop: '桌面设备', mobile: '手机', tablet: '平板', unknown: '未识别设备' };
export const eventLabels: Record<AnalyticsEventName, string> = {
  outbound_click: '外链点击', search: '站内搜索', reaction: '表态', comment: '发表评论', guestbook_message: '留言', resume_download_click: '简历下载点击',
};

export function referrerLabel(value: string): string {
  return value === '(direct)' || value === '' ? '直接访问' : value;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
