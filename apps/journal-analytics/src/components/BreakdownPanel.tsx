import { ArrowUpRight } from 'lucide-react';
import type { AnalyticsBreakdown, AnalyticsOverview } from '../../../../src/shared/analyticsProtocol';
import { numberFormat } from '../format';
import { EmptyState, Panel } from './Primitives';

export function BreakdownPanel({ title, subtitle, rows, label = value => value, onSelect, id, totalPageviews }: { title: string; subtitle: string; rows: AnalyticsBreakdown[]; label?: (value: string) => string; onSelect?: (value: string) => void; id?: string; totalPageviews: number }) {
  const max = Math.max(1, ...rows.map(item => item.pageviews));
  return <Panel title={title} subtitle={subtitle} id={id}>
    {rows.length === 0 ? <EmptyState /> : <div className="table-scroll"><table className="data-table ranking-table"><caption className="sr-only">{title}，按访客数排序，条形表示浏览次数</caption><thead><tr><th scope="col">{title === '热门页面' ? '页面路径' : title === '流量来源' ? '来源' : '名称'}</th><th scope="col" className="numeric">访客</th><th scope="col" className="numeric">浏览</th></tr></thead><tbody>{rows.map((item, index) => <tr key={item.name}>
      <td className="w-full min-w-36"><div className="relative rounded-md" style={{ background: `linear-gradient(to right, #eaf3ed ${item.pageviews / max * 100}%, transparent ${item.pageviews / max * 100}%)` }}>{onSelect ? <button type="button" className="group flex w-full items-center gap-2 px-2.5 py-2.5 text-left" onClick={() => onSelect(item.name)} title={`筛选 ${label(item.name)}`}><span className="text-[10px] text-emerald-800/45">{String(index + 1).padStart(2, '0')}</span><span className="max-w-72 truncate text-xs text-stone-700">{label(item.name)}</span><ArrowUpRight size={12} className="ml-auto shrink-0 text-emerald-600 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true" /></button> : <span className="flex items-center gap-2 px-2.5 py-2.5"><span className="text-[10px] text-emerald-800/45">{String(index + 1).padStart(2, '0')}</span><span className="max-w-60 truncate text-xs text-stone-700" title={label(item.name)}>{label(item.name)}</span></span>}</div></td>
      <td className="numeric text-stone-500">{numberFormat.format(item.visitors)}</td><td className="numeric"><span className="font-semibold text-stone-800">{numberFormat.format(item.pageviews)}</span><span className="mt-1 block text-[9px] text-stone-400">{totalPageviews > 0 ? (item.pageviews / totalPageviews * 100).toFixed(1) : '0'}%</span></td>
    </tr>)}</tbody></table></div>}
  </Panel>;
}

export function CampaignPanel({ rows }: { rows: AnalyticsOverview['campaigns'] }) {
  return <Panel title="推广活动" subtitle="通过链接中的 UTM 参数识别活动来源；只展示带 UTM 的访问 · 按访客排序 · 前 20 项。">
    {rows.length === 0 ? <EmptyState title="还没有推广活动数据" description="在分享链接中使用 utm_source、utm_medium 或 utm_campaign，后续访问就会出现在这里。" /> : <div className="table-scroll"><table className="data-table"><caption className="sr-only">推广活动流量</caption><thead><tr><th scope="col">活动</th><th scope="col">来源 / 媒介</th><th scope="col" className="numeric">访客</th><th scope="col" className="numeric">浏览</th></tr></thead><tbody>{rows.map((row, index) => <tr key={index}><td className="max-w-48 break-words font-medium">{row.campaign || '未命名活动'}</td><td className="max-w-48 break-words text-stone-500">{row.source || '未标记'}<span className="mx-2 text-stone-300">/</span>{row.medium || '未标记'}</td><td className="numeric">{numberFormat.format(row.visitors)}</td><td className="numeric">{numberFormat.format(row.pageviews)}</td></tr>)}</tbody></table></div>}
  </Panel>;
}
