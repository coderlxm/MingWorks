import { useState } from 'react';
import type { FormEvent } from 'react';
import { CalendarDays, SlidersHorizontal, X } from 'lucide-react';
import type { AnalyticsDevice, AnalyticsFilters, AnalyticsOverview } from '../../../../src/shared/analyticsProtocol';
import { dateRange, deviceLabels, referrerLabel, todayInShanghai } from '../format';

const presets = [{ days: 1, label: '今日' }, { days: 7, label: '近 7 天' }, { days: 30, label: '近 30 天' }, { days: 90, label: '近 90 天' }];

export function FilterBar({ filters, report, onChange }: { filters: AnalyticsFilters; report: AnalyticsOverview | null; onChange: (filters: AnalyticsFilters) => void }) {
  const matchingPreset = presets.find(item => { const range = dateRange(item.days); return range.from === filters.from && range.to === filters.to; });
  const [custom, setCustom] = useState(!matchingPreset);
  const [error, setError] = useState('');
  const referrers = [...new Set(['(direct)', ...(filters.referrer ? [filters.referrer] : []), ...(report?.referrers.map(item => item.name || '(direct)') || [])])];
  const hasFilters = Boolean(filters.path || filters.referrer || filters.device);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const from = custom ? String(data.get('from')) : filters.from;
    const to = custom ? String(data.get('to')) : filters.to;
    if (from > to) { setError('开始日期不能晚于结束日期。'); return; }
    if ((Date.parse(to) - Date.parse(from)) / 86_400_000 >= 366) { setError('请将日期范围控制在 366 天以内。'); return; }
    setError('');
    onChange({ from, to, path: String(data.get('path')).trim(), referrer: String(data.get('referrer')), device: String(data.get('device')) as AnalyticsDevice | undefined || undefined });
  }

  function clear(key: 'path' | 'referrer' | 'device') {
    onChange({ ...filters, [key]: undefined });
  }

  return <div className="mb-7">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="segmented-control date-presets">{presets.map(item => <button key={item.days} type="button" aria-pressed={!custom && matchingPreset?.days === item.days} onClick={() => { setCustom(false); onChange({ ...filters, ...dateRange(item.days) }); }}>{item.label}</button>)}<button type="button" aria-pressed={custom} onClick={() => setCustom(true)}><CalendarDays size={13} aria-hidden="true" /><span>自定义</span></button></div>
      <p className="text-xs tabular-nums text-stone-500">{filters.from} <span className="mx-1 text-stone-300">—</span> {filters.to}<span className="ml-2 text-[10px] text-stone-400">UTC+8</span></p>
    </div>
    <form className="mt-4" onSubmit={submit}>
      {custom && <div className="mb-3 flex flex-wrap items-end gap-3 rounded-xl border border-stone-200 bg-white p-4"><label className="filter-label">开始日期<input type="date" name="from" required max={todayInShanghai()} defaultValue={filters.from} className="form-control" /></label><label className="filter-label">结束日期（含当日）<input type="date" name="to" required max={todayInShanghai()} defaultValue={filters.to} className="form-control" /></label><p className="pb-3 text-xs text-stone-500">最多 366 天，点击“应用筛选”生效。</p></div>}
      <div className="filter-grid rounded-xl border border-stone-200/80 bg-white p-3">
        <label className="filter-label"><span>页面路径</span><input name="path" defaultValue={filters.path || ''} placeholder="全部页面，或输入 /about" className="form-control w-full" list="analytics-paths" maxLength={300} /><datalist id="analytics-paths">{report?.pages.map(item => <option value={item.name} key={item.name} />)}</datalist></label>
        <label className="filter-label"><span>流量来源</span><select name="referrer" defaultValue={filters.referrer || ''} className="form-control w-full"><option value="">全部来源</option>{referrers.map(source => <option key={source} value={source}>{referrerLabel(source)}</option>)}</select></label>
        <label className="filter-label"><span>访问设备</span><select name="device" defaultValue={filters.device || ''} className="form-control w-full"><option value="">全部设备</option>{Object.entries(deviceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <button type="submit" className="btn-secondary self-end whitespace-nowrap"><SlidersHorizontal size={14} aria-hidden="true" />应用筛选</button>
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
    </form>
    {hasFilters && <div className="mt-3 flex flex-wrap items-center gap-2 text-xs"><span className="mr-1 text-stone-400">正在筛选</span>{filters.path && <button type="button" className="filter-chip" onClick={() => clear('path')} title={`清除页面筛选 ${filters.path}`}><span className="max-w-52 truncate">{filters.path}</span><X size={12} aria-hidden="true" /></button>}{filters.referrer && <button type="button" className="filter-chip" onClick={() => clear('referrer')}>{referrerLabel(filters.referrer)}<X size={12} aria-hidden="true" /><span className="sr-only">清除来源筛选</span></button>}{filters.device && <button type="button" className="filter-chip" onClick={() => clear('device')}>{deviceLabels[filters.device]}<X size={12} aria-hidden="true" /><span className="sr-only">清除设备筛选</span></button>}<button type="button" className="ml-1 text-stone-500 underline underline-offset-4" onClick={() => onChange({ from: filters.from, to: filters.to })}>清除全部</button></div>}
  </div>;
}
