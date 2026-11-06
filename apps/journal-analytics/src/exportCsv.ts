import type { AnalyticsFilters, AnalyticsOverview } from '../../../src/shared/analyticsProtocol';
import { deviceLabels, eventLabels, referrerLabel } from './format';

function csvCell(value: string | number): string {
  const text = String(value);
  const safe = /^[\s]*[=+\-@]/.test(text) || /^[\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function exportAnalyticsCsv(report: AnalyticsOverview, filters: AnalyticsFilters): void {
  const rows: Array<Array<string | number>> = [
    ['Journal Analytics', 'Asia/Shanghai'],
    ['统计开始', report.from, '统计结束（含）', report.to],
    ['路径筛选', filters.path || '全部', '来源筛选', filters.referrer ? referrerLabel(filters.referrer) : '全部', '设备筛选', filters.device ? deviceLabels[filters.device] : '全部'],
    ['生成时间', report.generatedAt],
    ['导出范围', '当前筛选的汇总和每日数据；维度排行榜前20项，事件与目标前30项，并非全部访问明细。'],
    [],
    ['指标', '当前周期', '上个周期'],
    ['访客 UV', report.current.visitors, report.previous.visitors],
    ['浏览 PV', report.current.pageviews, report.previous.pageviews],
    ['会话', report.current.sessions, report.previous.sessions],
    ['跳出率（%）', report.current.bounceRate, report.previous.bounceRate],
    ['平均每会话停留（秒）', report.current.avgDurationSeconds, report.previous.avgDurationSeconds],
    [], ['日期', '访客 UV', '浏览 PV', '会话'],
    ...report.daily.map(day => [day.date, day.visitors, day.pageviews, day.sessions]),
  ];
  for (const [label, items] of [['访问页面', report.pages], ['流量来源', report.referrers], ['设备', report.devices], ['浏览器', report.browsers], ['操作系统', report.systems]] as const) {
    rows.push([], [label, '访客 UV', '浏览 PV'], ...items.map(item => [label === '流量来源' ? referrerLabel(item.name) : item.name, item.visitors, item.pageviews]));
  }
  rows.push([], ['UTM 来源', '媒介', '活动', '访客 UV', '浏览 PV'], ...report.campaigns.map(item => [item.source, item.medium, item.campaign, item.visitors, item.pageviews]));
  rows.push([], ['事件', '目标', '次数', '访客 UV'], ...report.events.map(item => [eventLabels[item.name], item.target, item.count, item.visitors]));
  const content = '\ufeff' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8;' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `journal-analytics_${report.from}_${report.to}.csv`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
