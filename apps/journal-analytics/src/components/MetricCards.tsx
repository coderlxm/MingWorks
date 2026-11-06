import { ArrowDownRight, ArrowUpRight, CornerDownRight, Eye, MousePointer2, Timer, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AnalyticsMetrics } from '../../../../src/shared/analyticsProtocol';
import { formatDuration, numberFormat } from '../format';

function Delta({ current, previous, percentagePoints = false }: { current: number; previous: number; percentagePoints?: boolean }) {
  const difference = current - previous;
  const value = percentagePoints ? `${Math.abs(difference).toFixed(1)}个百分点` : previous === 0 ? (current === 0 ? '持平' : '新增') : `${Math.abs(difference / previous * 100).toFixed(1)}%`;
  if (difference === 0) return <span className="text-stone-400">— 持平</span>;
  const Icon = difference > 0 ? ArrowUpRight : ArrowDownRight;
  return <span className="inline-flex items-center gap-0.5 text-stone-600"><Icon size={14} aria-hidden="true" />{value}</span>;
}

export function MetricCards({ current, previous }: { current: AnalyticsMetrics; previous: AnalyticsMetrics }) {
  const cards: Array<{ label: string; abbreviation: string; key: keyof AnalyticsMetrics; icon: LucideIcon; value: string; hint: string }> = [
    { label: '独立访客', abbreviation: 'UV', key: 'visitors', icon: Users, value: numberFormat.format(current.visitors), hint: '按匿名浏览器标识去重，非实际人数' },
    { label: '页面浏览', abbreviation: 'PV', key: 'pageviews', icon: Eye, value: numberFormat.format(current.pageviews), hint: '公开页面的浏览次数' },
    { label: '访问会话', abbreviation: 'SESSIONS', key: 'sessions', icon: MousePointer2, value: numberFormat.format(current.sessions), hint: '连续 30 分钟无活动后开始新会话' },
    { label: '跳出率', abbreviation: 'BOUNCE', key: 'bounceRate', icon: CornerDownRight, value: `${current.bounceRate.toFixed(1)}%`, hint: '筛选范围内只有一次浏览的会话占比' },
    { label: '平均停留', abbreviation: 'DURATION', key: 'avgDurationSeconds', icon: Timer, value: formatDuration(current.avgDurationSeconds), hint: '筛选页面累计可见时长除以会话数' },
  ];
  return <div className="grid grid-cols-2 gap-3 xl:grid-cols-5 lg:gap-4">{cards.map(({ label, abbreviation, key, icon: Icon, value, hint }, index) => <article key={key} className={`metric-card ${index === 0 ? 'metric-featured' : ''} ${index === 4 ? 'col-span-2 xl:col-span-1' : ''}`}>
    <div className="flex items-center justify-between gap-2"><span className="text-xs font-medium text-stone-600">{label}</span><Icon size={16} className="text-stone-400" strokeWidth={1.7} aria-hidden="true" /></div>
    <p className="mt-1.5 text-[9px] font-semibold tracking-widest text-stone-400">{abbreviation}</p>
    <p className="my-5 truncate text-[28px] font-semibold leading-none tracking-tight text-stone-900 lg:text-[31px]" title={hint}>{value}</p>
    <div className="text-[11px]"><Delta current={current[key]} previous={previous[key]} percentagePoints={key === 'bounceRate'} /><span className="ml-1.5 text-stone-400">较上期</span></div>
    <p className="sr-only">{hint}</p>
  </article>)}</div>;
}
