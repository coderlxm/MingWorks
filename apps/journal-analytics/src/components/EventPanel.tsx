import type { AnalyticsOverview } from '../../../../src/shared/analyticsProtocol';
import { eventLabels, numberFormat } from '../format';
import { EmptyState, Panel } from './Primitives';

export function EventPanel({ events }: { events: AnalyticsOverview['events'] }) {
  return <Panel id="events" title="内容之外的回应" subtitle="搜索、表态、评论、留言、外链点击与简历下载点击 · 按事件发生日期统计 · 前 30 项。" action={<span className="whitespace-nowrap rounded-full bg-pink-50 px-3 py-1 text-xs font-medium text-pink-800">{numberFormat.format(events.length)} 项</span>}>
    {events.length === 0 ? <EmptyState title="暂时还没有互动事件" description="访客完成搜索、发表评论或点击外链等操作后，互动数据会显示在这里。" /> : <div className="table-scroll"><table className="data-table"><caption className="sr-only">关键事件和目标统计</caption><thead><tr><th scope="col">事件</th><th scope="col">目标</th><th scope="col" className="numeric">次数</th><th scope="col" className="numeric">访客</th></tr></thead><tbody>{events.map((event, index) => <tr key={index}><td className="whitespace-nowrap"><span className="rounded-md bg-stone-100 px-2 py-1 text-[11px] text-stone-600">{eventLabels[event.name]}</span></td><td className="max-w-96 break-all text-stone-500">{event.target || '—'}</td><td className="numeric font-semibold">{numberFormat.format(event.count)}</td><td className="numeric text-stone-500">{numberFormat.format(event.visitors)}</td></tr>)}</tbody></table></div>}
  </Panel>;
}
