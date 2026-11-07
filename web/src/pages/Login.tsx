import { useState } from 'react';
import { login, register } from '../lib/auth';
import { message } from '../lib/data';

export function Login() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === 'register') await register(email, password, name);
      else await login(email, password);
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  const field =
    'w-full border border-line/60 bg-surface px-3 py-2.5 text-[14px] outline-none focus:border-ink';

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-oncanvas">
      <header className="border-b border-line/40 px-5 py-3">
        <p className="font-mono text-[10px] tracking-[0.24em] text-oncanvas/45">TASK CARD / 01</p>
        <p className="text-[17px] font-semibold tracking-tight">任务卡片</p>
      </header>

      <main className="mx-auto flex w-full max-w-[460px] flex-1 flex-col justify-center px-5 py-10">
        <p className="font-mono text-[10px] tracking-[0.24em] text-oncanvas/45">ACCOUNT</p>
        <h1 className="mt-1 text-[26px] font-semibold tracking-tight">
          {mode === 'login' ? '登录，回到你的卡' : '建一个账号'}
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-oncanvas/55">
          账号只存这台电脑的 PocketBase 里。纸卡扫码页不用登录，谁拿着卡都能改那张卡。
        </p>

        <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
          {mode === 'register' && (
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] tracking-[0.2em] text-oncanvas/45">名字</span>
              <input
                className={field}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="怎么称呼你"
                autoComplete="nickname"
              />
            </label>
          )}
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] tracking-[0.2em] text-oncanvas/45">邮箱</span>
            <input
              className={field}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] tracking-[0.2em] text-oncanvas/45">密码</span>
            <input
              className={field}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'register' ? '至少 8 位' : '输入密码'}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              minLength={8}
              required
            />
          </label>

          {error && (
            <p className="border-l-2 border-seal px-3 py-2 text-[12px] leading-relaxed text-seal">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-1 bg-seal px-4 py-3 text-[14px] font-medium text-white disabled:opacity-60"
          >
            {busy ? '稍等…' : mode === 'login' ? '登录' : '注册并登录'}
          </button>
        </form>

        <button
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setError(null);
          }}
          className="mt-4 self-start text-[12px] text-oncanvas/55 underline underline-offset-4 hover:text-ink"
        >
          {mode === 'login' ? '没有账号？注册一个' : '已经有账号？去登录'}
        </button>
      </main>

      <footer className="flex items-center justify-between border-t border-line/40 px-5 py-3 font-mono text-[10px] tracking-[0.18em] text-oncanvas/35">
        <span>POCKETBASE / REACT</span>
        <span>{typeof window !== 'undefined' ? window.location.host : ''}</span>
      </footer>
    </div>
  );
}
