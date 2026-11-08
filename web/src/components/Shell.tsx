import type { ReactNode } from 'react';
import { Link, usePathname } from '../lib/router';
import { logout, useAuth } from '../lib/auth';
import { THEME_CYCLE, THEME_LABEL, useTheme } from '../lib/theme';

const NAV = [
  { to: '/', label: '看板', en: 'BOARD' },
  { to: '/tasks', label: '任务', en: 'TASKS' },
  { to: '/cards', label: '卡片', en: 'CARDS' },
  { to: '/stats', label: '统计', en: 'STATS' },
  { to: '/capture', label: '录入', en: 'CAPTURE' },
  { to: '/print', label: '打印', en: 'PRINT' },
  { to: '/settings', label: '设置', en: 'SETUP' },
];

const THEME_GLYPH: Record<string, string> = { system: '◐', light: '☀', dark: '☾' };

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { user } = useAuth();
  const [mode, setMode] = useTheme();
  const nextMode = THEME_CYCLE[(THEME_CYCLE.indexOf(mode) + 1) % THEME_CYCLE.length];

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-ink/80 bg-canvas">
        <div className="mx-auto flex h-14 w-full max-w-[1180px] items-center gap-5 px-4 sm:px-6">
          <Link to="/" className="flex shrink-0 items-baseline gap-2" ariaLabel="回到看板">
            <span className="shrink-0 whitespace-nowrap text-[15px] font-bold tracking-[0.02em]">
              任务卡片
            </span>
            <span className="hidden text-[9px] font-medium tracking-[0.3em] text-ink-soft sm:inline">
              TASK CARD / 01
            </span>
          </Link>

          <nav className="ml-auto flex min-w-0 items-center gap-0 overflow-x-auto">
            {NAV.map((item) => {
              const active = item.to === '/' ? path === '/' : path.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`group flex shrink-0 flex-col items-center gap-1 px-2 py-1.5 sm:px-3 ${
                    active ? 'text-oncanvas' : 'text-oncanvas/50 hover:text-oncanvas'
                  }`}
                >
                  <span className="whitespace-nowrap text-[12px] sm:text-[13px]">{item.label}</span>
                  <span
                    aria-hidden
                    className={`h-[3px] w-full ${active ? 'bg-seal' : 'bg-transparent'}`}
                  />
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => setMode(nextMode)}
              title={`主题：${THEME_LABEL[mode]}（点一下换成${THEME_LABEL[nextMode]}）`}
              aria-label={`主题：${THEME_LABEL[mode]}`}
              className="ml-2 grid h-7 w-7 shrink-0 place-items-center border border-ink/25 text-[13px] text-oncanvas/60 hover:border-ink hover:text-oncanvas"
            >
              {THEME_GLYPH[mode]}
            </button>
            {user && (
              <button
                type="button"
                onClick={() => {
                  logout();
                  window.location.reload();
                }}
                title={`${user.email} · 退出登录`}
                className="ml-2 hidden shrink-0 max-w-[150px] truncate border border-ink/20 px-2 py-1 text-[11px] text-oncanvas/55 hover:border-ink hover:text-oncanvas sm:block"
              >
                {user.name || user.email.split('@')[0]}
              </button>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>

      <footer className="border-t border-line px-4 py-5 text-[10px] uppercase tracking-[0.18em] text-oncanvas/40 sm:px-6">
        <div className="mx-auto flex w-full max-w-[1180px] flex-wrap items-center gap-x-4 gap-y-1">
          <span>PocketBase / React / 纸卡与网页同一份数据</span>
          <span className="ml-auto font-mono tracking-normal">
            http{location.protocol === 'https:' ? 's' : ''}://{location.host}
          </span>
        </div>
      </footer>
    </div>
  );
}
