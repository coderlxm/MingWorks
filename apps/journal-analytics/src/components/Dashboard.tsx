import { useEffect, useState } from 'react';
import { Activity, ArrowUpRight, ChartNoAxesCombined, Compass, Download, FileText, Globe, Info, LoaderCircle, LogOut, RefreshCw, Users } from 'lucide-react';
import type { AnalyticsDevice, AnalyticsFilters, AnalyticsOverview } from '../../../../src/shared/analyticsProtocol';
import { ApiError, getAnalytics, logout } from '../api';
import { dateRange, deviceLabels, errorMessage, formatTimestamp, referrerLabel } from '../format';
import { exportAnalyticsCsv } from '../exportCsv';
import { Brand, ErrorNotice } from './Primitives';
import { FilterBar } from './FilterBar';
import { MetricCards } from './MetricCards';
import { TrafficChart } from './TrafficChart';
import { RealtimePanel } from './RealtimePanel';
import { BreakdownPanel, CampaignPanel } from './BreakdownPanel';
import { EventPanel } from './EventPanel';

const navigation = [
  { id: 'overview', label: '访问总览', icon: ChartNoAxesCombined },
  { id: 'content', label: '内容表现', icon: FileText },
  { id: 'sources', label: '流量来源', icon: Compass },
  { id: 'audience', label: '访客设备', icon: Users },
  { id: 'events', label: '互动事件', icon: Activity },
];

export function Dashboard({ onSessionExpired, onLogout }: { onSessionExpired: () => void; onLogout: () => void }) {
  const [filters, setFilters] = useState<AnalyticsFilters>(() => dateRange(7));
  const [revision, setRevision] = useState(0);
  const [report, setReport] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [logoutError, setLogoutError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const [activeSection, setActiveSection] = useState('overview');

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    setReport(null);
    setError('');
    async function load() {
      setLoading(true);
      try {
        const data = await getAnalytics(filters, controller.signal);
        if (controller.signal.aborted) return;
        setReport(data);
        setError('');
        timer = setTimeout(() => { void load(); }, 30_000);
      } catch (failure) {
        if (controller.signal.aborted) return;
        setReport(null);
        setError(errorMessage(failure));
        if (failure instanceof ApiError && failure.status === 401) onSessionExpired();
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [filters, revision, onSessionExpired]);

  async function signOut() {
    setLoggingOut(true);
    setLogoutError('');
    try {
      await logout();
      onLogout();
    } catch (failure) {
      setLogoutError(errorMessage(failure));
    } finally {
      setLoggingOut(false);
    }
  }

  function refresh() { setRevision(value => value + 1); }

  return <div className="min-h-dvh">
    <a className="skip-link" href="#dashboard-content">跳到统计内容</a>
    <aside className="sidebar fixed inset-y-0 left-0 z-20 hidden w-56 flex-col border-r border-stone-200/80 bg-[#fff9fc] p-6 lg:flex">
      <Brand />
      <p className="mb-3 mt-14 text-[9px] font-semibold tracking-[0.18em] text-stone-400">WORKSPACE</p>
      <nav aria-label="看板导航" className="space-y-1.5">{navigation.map(({ id, label, icon: Icon }) => <a href={`#${id}`} className={`nav-item ${activeSection === id ? 'nav-active' : ''}`} key={id} aria-current={activeSection === id ? 'location' : undefined} onClick={() => setActiveSection(id)}><Icon size={17} strokeWidth={1.7} aria-hidden="true" />{label}{id === 'overview' && <span className="ml-auto size-1.5 rounded-full bg-pink-600" />}</a>)}</nav>
      <div className="mt-auto border-t border-stone-200/80 pt-5"><div className="flex items-center gap-2 text-xs font-medium text-stone-600"><span className="flex size-7 items-center justify-center rounded-lg border border-stone-200 bg-white"><Globe size={13} aria-hidden="true" /></span>Journal 站点统计</div><p className="mt-3 text-[10px] leading-5 text-stone-400">专注内容，也了解阅读内容的人。</p><a href="https://feeds.xmcloud.buzz/" className="mt-3 flex items-center gap-2 text-xs text-stone-500">打开 Journal <ArrowUpRight size={13} aria-hidden="true" /></a></div>
    </aside>

    <main id="dashboard-content" className="mx-auto max-w-[1700px] px-4 pb-12 pt-6 sm:px-8 lg:ml-56 lg:px-9 lg:pt-9 xl:px-12">
      <div className="mb-8 flex items-center justify-between lg:hidden"><Brand compact /><a href="https://feeds.xmcloud.buzz/" className="btn-secondary text-xs">打开站点 <ArrowUpRight size={13} aria-hidden="true" /></a></div>
      <header id="overview" className="mb-8 scroll-mt-6">
        <div className="flex flex-wrap items-start justify-between gap-5"><div><div className="mb-3 flex items-center gap-2"><span className="eyebrow">JOURNAL INSIGHTS</span><span className="rounded-full border border-pink-200 bg-pink-50 px-2 py-0.5 text-[9px] font-medium text-pink-800">公开站点</span></div><h1 className="text-2xl font-semibold tracking-tight text-stone-900 sm:text-[29px]">看见每一次来访<span className="text-pink-700">。</span></h1><p className="mt-3 text-xs leading-6 text-stone-500">从一次发现，到一次阅读。了解你的 Journal 正在发生什么。</p></div>
          <div className="flex flex-wrap items-center gap-2 pt-1"><a href="https://feeds.xmcloud.buzz/" className="btn-secondary hidden xl:inline-flex">打开站点 <ArrowUpRight size={14} aria-hidden="true" /></a><button type="button" className="btn-secondary" disabled={loading} onClick={refresh} aria-label="刷新统计数据"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} aria-hidden="true" /><span className="hidden sm:inline">刷新</span></button><button type="button" className="btn-primary" disabled={!report || loading} onClick={() => { if (report) exportAnalyticsCsv(report, filters); }}><Download size={14} aria-hidden="true" />导出 CSV</button><button type="button" className="icon-button" disabled={loggingOut} onClick={() => { void signOut(); }} aria-label="退出登录" title="退出登录"><LogOut size={16} aria-hidden="true" /></button></div>
        </div>
        <nav aria-label="看板导航" className="-mx-4 mt-5 flex gap-1 overflow-x-auto border-b border-stone-200 px-4 pb-3 lg:hidden">{navigation.map(({ id, label }) => <a href={`#${id}`} key={id} onClick={() => setActiveSection(id)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs ${activeSection === id ? 'bg-pink-100 text-pink-900' : 'text-stone-500'}`}>{label}</a>)}</nav>
      </header>

      {logoutError && <p role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">退出失败：{logoutError}<button type="button" className="ml-3 underline underline-offset-4" disabled={loggingOut} onClick={() => { void signOut(); }}>重新退出</button></p>}
      <FilterBar key={JSON.stringify(filters)} filters={filters} report={report} onChange={setFilters} />
      {error && <ErrorNotice message={error} onRetry={refresh} />}
      {loading && !report && <div role="status" className="panel flex min-h-80 flex-col items-center justify-center text-stone-500"><LoaderCircle size={24} className="mb-4 animate-spin text-pink-700" aria-hidden="true" /><p className="text-sm">正在读取来访数据…</p><p className="mt-2 text-xs text-stone-400">{filters.from} — {filters.to}</p></div>}
      {report && <div aria-busy={loading} className="space-y-5">
        <MetricCards current={report.current} previous={report.previous} />
        <p className="flex flex-wrap items-center justify-between gap-2 px-1 text-[10px] leading-5 text-stone-400"><span>对比上期 {report.previousFrom} — {report.previousTo} · 相同筛选条件</span><span role="status">{loading ? '正在更新…' : `更新于 ${formatTimestamp(report.generatedAt)} · 每 30 秒刷新`}</span></p>
        <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,2.2fr)_minmax(270px,1fr)]"><TrafficChart report={report} /><RealtimePanel realtime={report.realtime} /></div>
        <div id="content" className="grid scroll-mt-6 gap-5 xl:grid-cols-2">
          <BreakdownPanel title="热门页面" subtitle="访客最常到访的内容 · 按访客排序 · 前 20 项 · 点击路径筛选" rows={report.pages} totalPageviews={report.current.pageviews} onSelect={path => setFilters({ ...filters, path })} />
          <BreakdownPanel id="sources" title="流量来源" subtitle="来访前的外部网站 · 按访客排序 · 前 20 项 · 点击来源筛选" rows={report.referrers} totalPageviews={report.current.pageviews} label={referrerLabel} onSelect={referrer => setFilters({ ...filters, referrer: referrer || '(direct)' })} />
        </div>
        <CampaignPanel rows={report.campaigns} />
        <div id="audience" className="grid scroll-mt-6 gap-5 xl:grid-cols-3">
          <BreakdownPanel title="访问设备" subtitle="设备类型 · 按访客排序 · 点击设备筛选" rows={report.devices} totalPageviews={report.current.pageviews} label={value => deviceLabels[value as AnalyticsDevice]} onSelect={device => setFilters({ ...filters, device: device as AnalyticsDevice })} />
          <BreakdownPanel title="浏览器" subtitle="浏览器分类 · 按访客排序 · 前 20 项" rows={report.browsers} totalPageviews={report.current.pageviews} label={value => value === 'unknown' ? '未识别浏览器' : value} />
          <BreakdownPanel title="操作系统" subtitle="系统分类 · 按访客排序 · 前 20 项" rows={report.systems} totalPageviews={report.current.pageviews} label={value => value === 'unknown' ? '未识别系统' : value} />
        </div>
        <EventPanel events={report.events} />
        <details className="rounded-xl border border-stone-200/70 bg-stone-100/50 p-5"><summary className="flex w-fit cursor-pointer list-none items-center gap-2 text-xs font-medium text-stone-600"><Info size={14} aria-hidden="true" />统计口径与采集范围</summary><div className="mt-4 grid gap-4 text-[11px] leading-6 text-stone-500 sm:grid-cols-2"><p>访客 UV 按匿名浏览器标识去重，清除浏览器数据或更换设备会计为新访客，并非实际人数。连续 30 分钟无活动后产生新会话。所有日期均按北京时间（Asia/Shanghai）统计。</p><p>跳出率为筛选范围内只有一次浏览的会话占比；平均停留为筛选页面累计可见时长除以会话数。跨日访客会在每天分别计入，所以每日 UV 之和可能高于周期 UV。</p><p>仅采集公开页面，排除管理员访问与已知爬虫。页面参数、私密内容及密码不进入统计；推广来源只记录 UTM 参数。首次采集之前的访问无法还原。</p><p>实时面板显示最近 5 分钟有活动的浏览器访客和页面记录，不等于最近新增 PV。排行榜按访客排序，条形和占比表示浏览量；页面、来源和受众最多展示前 20 项，事件展示前 30 项。</p></div></details>
        <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-stone-200/70 pt-5 text-[10px] text-stone-400"><span>{report.firstCollectedAt ? `开始采集于 ${formatTimestamp(report.firstCollectedAt, true)}` : '尚未收到首条访问数据'}<span className="mx-2">·</span>Asia/Shanghai</span></footer>
      </div>}
    </main>
  </div>;
}
