import type { ReactNode } from 'react';
import { TaskCard } from '../components/TaskCard';
import { useTasks } from '../lib/data';
import { Link } from '../lib/router';
import { isDone, isOverdue, isToday, type Task } from '../lib/types';

const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

export function Board() {
  const { tasks, error } = useTasks();
  // 空白卡是占位记录，内容还没写，不上看板
  const list = (tasks ?? []).filter((t) => !t.draft);

  const overdue = list.filter((t) => isOverdue(t));
  const today = list.filter((t) => isToday(t) && !isOverdue(t));
  const shortRest = list.filter(
    (t) => t.kind === 'short' && !isOverdue(t) && !isToday(t) && !isDone(t),
  );
  const long = list.filter((t) => t.kind === 'long');
  const done = list.filter((t) => isDone(t));

  const now = new Date();
  const dateLabel = `${now.getMonth() + 1} 月 ${now.getDate()} 日 · 周${WEEK[now.getDay()]}`;

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] tracking-[0.18em] text-paper/40">{dateLabel}</p>
          <h1 className="mt-1 text-[26px] font-semibold leading-tight tracking-tight">
            今天先做哪张卡？
          </h1>
        </div>
        <p className="max-w-[30ch] text-[12px] leading-relaxed text-paper/45">
          手机扫纸卡右上角的码 → 点一下状态 → 这块屏幕会自己变。不用刷新。
        </p>
      </header>

      {error && (
        <p className="border border-seal/50 bg-seal/10 px-3 py-2 text-[12px] text-paper/80">
          连不上后端：{error}
          <span className="ml-2 text-paper/50">（PocketBase 起了吗？见 README）</span>
        </p>
      )}

      {!tasks && !error && <Skeleton />}

      {tasks && (
        <>
          <Section title="逾期" tone="seal" tasks={overdue} hint="先处理，或者把截止日改掉">
            {overdue.slice(0, 8).map((t) => (
              <TaskCard key={t.id} task={t} />
            ))}
          </Section>

          <Section title="今天" tone="amber" tasks={today}>
            {today.slice(0, 8).map((t) => (
              <TaskCard key={t.id} task={t} />
            ))}
          </Section>

          <Section title="接下来" tone="plain" tasks={shortRest}>
            {shortRest.slice(0, 8).map((t) => (
              <TaskCard key={t.id} task={t} />
            ))}
          </Section>

          <Section title="长期目标" tone="plain" tasks={long}>
            {long.map((t) => (
              <TaskCard key={t.id} task={t} />
            ))}
          </Section>

          {done.length > 0 && (
            <p className="text-[11px] text-paper/35">
              已完成 {done.length} 张 ·{' '}
              <Link to="/tasks" className="underline decoration-paper/30 underline-offset-4">
                全部任务
              </Link>
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Section({
  title,
  tone,
  tasks,
  hint,
  children,
}: {
  title: string;
  tone: 'seal' | 'amber' | 'plain';
  tasks: Task[];
  hint?: string;
  children: ReactNode;
}) {
  if (tasks.length === 0) return null;

  const accent =
    tone === 'seal' ? 'bg-seal' : tone === 'amber' ? 'bg-amber' : 'bg-paper/25';

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline gap-2">
        <span aria-hidden className={`h-2 w-2 translate-y-px ${accent}`} />
        <h2 className="text-[13px] font-medium tracking-[0.14em] text-paper/80">{title}</h2>
        <span className="font-mono text-[11px] text-paper/30">{tasks.length}</span>
        {hint && <span className="ml-1 text-[11px] text-paper/30">{hint}</span>}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {children}
      </div>
    </section>
  );
}

function Skeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="h-[132px] animate-pulse bg-paper/10"
          style={{ animationDelay: `${i * 60}ms` }}
        />
      ))}
    </div>
  );
}
