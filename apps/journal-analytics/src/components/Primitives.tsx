import { Activity, ArrowRight, AlertCircle } from 'lucide-react';
import type { ReactNode } from 'react';

export function Brand() {
  return <div className="flex items-center gap-3">
    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-pink-900 text-white"><Activity size={23} strokeWidth={1.6} aria-hidden="true" /></span>
    <p className="brand-wordmark">Journal<span className="text-pink-700">.</span></p>
  </div>;
}

export function Panel({ title, subtitle, children, action, id, className = '' }: { title: string; subtitle?: string; children: ReactNode; action?: ReactNode; id?: string; className?: string }) {
  return <section id={id} className={`panel scroll-mt-6 ${className}`} aria-label={title}>
    <div className="mb-6 flex items-start justify-between gap-4"><div><h2 className="text-[15px] font-semibold tracking-tight text-stone-900">{title}</h2>{subtitle && <p className="mt-1.5 text-xs leading-relaxed text-stone-500">{subtitle}</p>}</div>{action}</div>
    {children}
  </section>;
}

export function EmptyState({ title = '暂无数据', description }: { title?: string; description?: string }) {
  return <div className="flex min-h-40 flex-col items-center justify-center px-4 py-8 text-center"><span className="mb-3 flex size-10 items-center justify-center rounded-full bg-stone-100 text-stone-400"><Activity size={18} aria-hidden="true" /></span><p className="text-sm font-medium text-stone-600">{title}</p>{description && <p className="mt-2 max-w-80 text-xs leading-relaxed text-stone-500">{description}</p>}</div>;
}

export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-900"><div className="flex items-start gap-3"><AlertCircle className="mt-0.5 shrink-0" size={18} aria-hidden="true" /><div className="min-w-0 flex-1"><p className="font-semibold">数据读取失败</p><p className="mt-2 break-words leading-relaxed">{message}</p><p className="mt-1 text-xs text-red-800">自动刷新已暂停。</p>{onRetry && <button type="button" className="mt-4 inline-flex items-center gap-2 font-semibold underline underline-offset-4" onClick={onRetry}>重新读取 <ArrowRight size={14} aria-hidden="true" /></button>}</div></div></div>;
}
