import { Radio } from 'lucide-react';
import type { AnalyticsOverview } from '../../../../src/shared/analyticsProtocol';
import { deviceLabels, formatTimestamp, numberFormat } from '../format';

export function RealtimePanel({ realtime }: { realtime: AnalyticsOverview['realtime'] }) {
  return <section aria-label="最近 5 分钟访问" className="realtime-panel flex flex-col overflow-hidden rounded-2xl p-6 text-white">
    <div className="flex items-center justify-between"><p className="flex items-center gap-2 text-xs font-medium text-emerald-100"><span className="size-1.5 rounded-full bg-emerald-300" />最近 5 分钟</p><Radio size={17} className="text-emerald-300/70" aria-hidden="true" /></div>
    <div className="mt-6 flex items-baseline gap-3"><p className="text-5xl font-medium tabular-nums tracking-tight">{numberFormat.format(realtime.visitors)}</p><span className="text-xs text-emerald-100/70">个浏览器访客 · {numberFormat.format(realtime.pageviews)} 个活跃页面</span></div>
    <p className="mt-3 text-[10px] leading-5 text-emerald-100/60">独立于所选日期，受页面、来源和设备筛选影响。</p>
    <div className="mt-5 grow border-t border-white/10 pt-5"><h3 className="text-[10px] tracking-wider text-emerald-100/60">最近活跃页面 · 右侧为首次打开时间</h3>{realtime.recent.length === 0 ? <p className="mt-6 text-xs leading-6 text-emerald-100/70">暂时没有符合筛选条件的来访。</p> : <ol className="mt-3 space-y-3">{realtime.recent.slice(0, 5).map((item, index) => <li key={`${item.createdAt}-${index}`} className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="truncate text-xs text-white/90" title={item.path}>{item.path}</p><p className="mt-1 text-[10px] text-emerald-100/50">{deviceLabels[item.device]}</p></div><time dateTime={item.createdAt} className="whitespace-nowrap text-[10px] tabular-nums text-emerald-100/65">{formatTimestamp(item.createdAt)}</time></li>)}</ol>}</div>
    <p className="mt-5 text-[10px] text-emerald-100/50">每 30 秒刷新 · 按匿名浏览器标识去重</p>
  </section>;
}
