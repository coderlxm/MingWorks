import { useCallback, useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { getSession } from './api';
import { errorMessage } from './format';
import { Dashboard } from './components/Dashboard';
import { LoginScreen } from './components/LoginScreen';
import { Brand } from './components/Primitives';

export default function App() {
  const [authentication, setAuthentication] = useState<'checking' | 'signed-in' | 'signed-out' | 'error'>('checking');
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setAuthentication('checking');
    async function load() {
      try {
        const authenticated = await getSession(controller.signal);
        if (!controller.signal.aborted) setAuthentication(authenticated ? 'signed-in' : 'signed-out');
      } catch (failure) {
        if (controller.signal.aborted) return;
        setError(errorMessage(failure));
        setAuthentication('error');
      }
    }
    void load();
    return () => controller.abort();
  }, [revision]);

  const onSessionExpired = useCallback(() => {
    setError('登录已过期，请重新输入管理员密码。');
    setAuthentication('signed-out');
  }, []);
  const onLogout = useCallback(() => {
    setError('');
    setAuthentication('signed-out');
  }, []);

  if (authentication === 'signed-in') return <Dashboard onSessionExpired={onSessionExpired} onLogout={onLogout} />;
  if (authentication === 'signed-out') return <LoginScreen notice={error} onLogin={() => { setError(''); setAuthentication('signed-in'); }} />;
  return <main className="flex min-h-dvh items-center justify-center px-5"><div className="panel w-full max-w-md p-8"><Brand /><h1 className="mt-8 text-xl font-semibold">Journal 访问统计</h1>{authentication === 'checking' ? <p role="status" className="mt-6 flex items-center gap-3 text-sm text-stone-500"><LoaderCircle className="animate-spin text-pink-700" size={17} aria-hidden="true" />正在确认登录状态…</p> : <div role="alert" className="mt-5"><p className="text-sm text-red-700">连接失败：{error}</p><button type="button" className="btn-primary mt-5" onClick={() => setRevision(value => value + 1)}>重新连接</button></div>}</div></main>;
}
