import type { ReactNode } from 'react';
import { Link, usePathname } from '../lib/router';

const NAV = [
  { to: '/', label: '看板' },
  { to: '/tasks', label: '全部任务' },
  { to: '/capture', label: '录入' },
  { to: '/settings', label: '设置' },
];

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-mat/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-[1180px] items-center gap-5 px-4 sm:px-6">
          <Link to="/" className="flex items-baseline gap-2" ariaLabel="回到看板">
            <span className="text-[15px] font-semibold tracking-[0.08em]">任务卡片</span>
            <span className="hidden text-[10px] tracking-[0.24em] text-paper/40 sm:inline">
              TASK CARD
            </span>
          </Link>

          <nav className="ml-auto flex items-center gap-1">
            {NAV.map((item) => {
              const active = item.to === '/' ? path === '/' : path.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`px-2.5 py-1.5 text-[13px] transition-colors ${
                    active ? 'text-paper' : 'text-paper/55 hover:text-paper/85'
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
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>

      <footer className="border-t border-white/10 px-4 py-5 text-[11px] text-paper/35 sm:px-6">
        <div className="mx-auto flex w-full max-w-[1180px] flex-wrap items-center gap-x-4 gap-y-1">
          <span>PocketBase · React · 同一份数据，纸卡与网页同步</span>
          <span className="ml-auto font-mono">http{location.protocol === 'https:' ? 's' : ''}://{location.host}</span>
        </div>
      </footer>
    </div>
  );
}
