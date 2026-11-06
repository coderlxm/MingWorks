import { useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChevronDown } from 'lucide-react';
import type { AnalyticsOverview } from '../../../../src/shared/analyticsProtocol';
import { numberFormat } from '../format';
import { EmptyState, Panel } from './Primitives';

export function TrafficChart({ report }: { report: AnalyticsOverview }) {
  const [metric, setMetric] = useState<'visitors' | 'pageviews'>('visitors');
  const label = metric === 'visitors' ? '独立访客 UV' : '页面浏览 PV';
  return <Panel title="来访趋势" subtitle={`${report.from} — ${report.to} · 按日统计`} className="min-w-0" action={<div className="segmented-control"><button type="button" aria-pressed={metric === 'visitors'} onClick={() => setMetric('visitors')}>访客 UV</button><button type="button" aria-pressed={metric === 'pageviews'} onClick={() => setMetric('pageviews')}>浏览 PV</button></div>}>
    {report.current.pageviews === 0 ? <EmptyState title="暂无访问数据" /> : <div className="h-64 w-full min-w-0" aria-label={`${label}每日趋势，具体数值可展开下方每日数据`}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart data={report.daily} margin={{ top: 12, right: 8, bottom: 0, left: -25 }} accessibilityLayer>
          <defs><linearGradient id="traffic-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#be185d" stopOpacity={0.2} /><stop offset="100%" stopColor="#be185d" stopOpacity={0.01} /></linearGradient></defs>
          <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#f1e5ec" />
          <XAxis dataKey="date" tickFormatter={value => String(value).slice(5).replace('-', '/')} axisLine={false} tickLine={false} tick={{ fill: '#95818d', fontSize: 11 }} minTickGap={32} tickMargin={12} />
          <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#95818d', fontSize: 11 }} />
          <Tooltip isAnimationActive={false} contentStyle={{ borderRadius: 12, border: '1px solid #ead5e1', fontSize: 12, boxShadow: '0 8px 25px #5b153e10' }} formatter={value => [numberFormat.format(Number(value)), label]} cursor={{ stroke: '#d9a6c0', strokeDasharray: '4 4' }} />
          <Area type="monotone" dataKey={metric} name={label} stroke="#be185d" strokeWidth={2.5} fill="url(#traffic-fill)" isAnimationActive={false} dot={report.daily.length === 1 ? { r: 4 } : false} activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>}
    <details className="mt-5 border-t border-stone-100 pt-4"><summary className="flex w-fit cursor-pointer list-none items-center gap-2 text-xs text-stone-500">查看每日数据 <ChevronDown size={13} aria-hidden="true" /></summary><div className="table-scroll mt-4 max-h-80"><table className="data-table"><caption className="sr-only">每日浏览、访客及会话</caption><thead><tr><th scope="col">日期</th><th scope="col" className="numeric">访客 UV</th><th scope="col" className="numeric">浏览 PV</th><th scope="col" className="numeric">会话</th></tr></thead><tbody>{report.daily.map(day => <tr key={day.date}><td>{day.date}</td><td className="numeric">{numberFormat.format(day.visitors)}</td><td className="numeric">{numberFormat.format(day.pageviews)}</td><td className="numeric">{numberFormat.format(day.sessions)}</td></tr>)}</tbody></table></div></details>
  </Panel>;
}
