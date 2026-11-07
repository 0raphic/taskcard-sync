import type { ReactNode } from 'react';
import { Link, usePathname } from '../lib/router';
import { THEME_CYCLE, THEME_LABEL, useTheme } from '../lib/theme';

const NAV = [
  { to: '/', label: '看板' },
  { to: '/tasks', label: '全部任务' },
  { to: '/cards', label: '卡片' },
  { to: '/capture', label: '录入' },
  { to: '/print', label: '打印' },
  { to: '/settings', label: '设置' },
];

const THEME_GLYPH: Record<string, string> = { system: '◐', light: '☀', dark: '☾' };

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const [mode, setMode] = useTheme();
  const nextMode = THEME_CYCLE[(THEME_CYCLE.indexOf(mode) + 1) % THEME_CYCLE.length];

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-[1180px] items-center gap-5 px-4 sm:px-6">
          <Link to="/" className="flex shrink-0 items-baseline gap-2" ariaLabel="回到看板">
            <span className="shrink-0 whitespace-nowrap text-[14px] font-semibold tracking-[0.08em] sm:text-[15px]">任务卡片</span>
            <span className="hidden text-[10px] tracking-[0.24em] text-oncanvas/40 sm:inline">
              TASK CARD
            </span>
          </Link>

          <nav className="ml-auto flex min-w-0 items-center gap-0.5 overflow-x-auto sm:gap-1">
            {NAV.map((item) => {
              const active = item.to === '/' ? path === '/' : path.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`shrink-0 whitespace-nowrap px-2 py-1.5 text-[13px] transition-colors sm:px-2.5 ${
                    active ? 'text-oncanvas' : 'text-oncanvas/55 hover:text-oncanvas/85'
                  }`}
                >
                  {item.label}
                  <span
                    aria-hidden
                    className={`mt-1 block h-px transition-colors ${
                      active ? 'bg-seal' : 'bg-transparent'
                    }`}
                  />
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => setMode(nextMode)}
              title={`主题：${THEME_LABEL[mode]}（点一下换成${THEME_LABEL[nextMode]}）`}
              aria-label={`主题：${THEME_LABEL[mode]}`}
              className="ml-1 shrink-0 border border-line px-2 py-1 text-[13px] text-oncanvas/60 hover:border-oncanvas/35 hover:text-oncanvas"
            >
              {THEME_GLYPH[mode]}
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>

      <footer className="border-t border-line px-4 py-5 text-[11px] text-oncanvas/35 sm:px-6">
        <div className="mx-auto flex w-full max-w-[1180px] flex-wrap items-center gap-x-4 gap-y-1">
          <span>PocketBase · React · 同一份数据，纸卡与网页同步</span>
          <span className="ml-auto font-mono">http{location.protocol === 'https:' ? 's' : ''}://{location.host}</span>
        </div>
      </footer>
    </div>
  );
}
