import { ArrowRight, LockKeyhole, LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { login } from '../api';
import { errorMessage } from '../format';
import { Brand } from './Primitives';

export function LoginScreen({ onLogin, notice }: { onLogin: () => void; notice: string }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(password);
      setPassword('');
      onLogin();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setLoading(false);
    }
  }

  return <main className="flex min-h-dvh items-center justify-center px-5 py-14">
    <div className="w-full max-w-md">
      <div className="mb-12 flex justify-center"><Brand /></div>
      <div className="panel p-8 sm:p-10">
        <span className="mb-6 inline-flex size-11 items-center justify-center rounded-full bg-pink-50 text-pink-800"><LockKeyhole size={20} aria-hidden="true" /></span>
        <p className="eyebrow">YOUR JOURNAL, IN NUMBERS</p><h1 className="mt-3 text-2xl font-semibold tracking-tight">看见每一次来访</h1>
        <p className="mt-3 text-sm leading-7 text-stone-500">登录你的 Journal 管理员账号，了解内容如何被发现、阅读与回应。</p>
        <form className="mt-8" onSubmit={submit}>
          <label htmlFor="admin-password" className="text-xs font-semibold text-stone-700">管理员密码</label>
          <input id="admin-password" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} className="form-control mt-2 w-full" disabled={loading} autoFocus />
          {(error || notice) && <p role="alert" className="mt-3 text-xs leading-6 text-red-700">{error || notice}</p>}
          <button disabled={loading} className="btn-primary mt-6 w-full justify-center" type="submit">{loading ? <LoaderCircle className="animate-spin" size={16} aria-hidden="true" /> : <>进入统计看板 <ArrowRight size={16} aria-hidden="true" /></>}</button>
        </form>
      </div>
      <p className="mt-6 text-center text-xs text-stone-500">使用 Journal 现有的管理员密码。</p>
      <a href="https://feeds.xmcloud.buzz/" className="mx-auto mt-5 flex w-fit items-center gap-1 text-xs text-pink-800">返回 Journal <ArrowRight size={13} aria-hidden="true" /></a>
    </div>
  </main>;
}
