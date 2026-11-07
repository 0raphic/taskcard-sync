import { useState, type ReactNode } from 'react';
import { TaskCard } from '../components/TaskCard';
import { useTasks } from '../lib/data';
import { Link } from '../lib/router';
import { isDone, isOverdue, isToday, type Task } from '../lib/types';

const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

export function Board() {
  const { tasks, error } = useTasks();
  const [printingToday, setPrintingToday] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  async function printToday(ids: string[]) {
    setPrintingToday(true);
    setFlash(null);
    try {
      const res = await fetch('/ds-api/cards.pdf', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(b.error || `生成失败 HTTP ${res.status}`);
      }
      const url = URL.createObjectURL(await res.blob());
      if (!window.open(url, '_blank')) setFlash('浏览器拦了弹窗，允许后重试');
    } catch (e) {
      setFlash(e instanceof Error ? e.message : String(e));
    } finally {
      setPrintingToday(false);
    }
  }
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
          <p className="font-mono text-[11px] tracking-[0.18em] text-oncanvas/40">{dateLabel}</p>
          <h1 className="mt-1 text-[26px] font-semibold leading-tight tracking-tight">
            今天先做哪张卡？
          </h1>
        </div>
        <p className="max-w-[30ch] text-[12px] leading-relaxed text-oncanvas/45">
          手机扫纸卡右上角的码 → 点一下状态 → 这块屏幕会自己变。不用刷新。
        </p>
      </header>

      {list.length > 0 && (today.length > 0 || overdue.length > 0) && (
        <div className="flex flex-wrap items-center gap-3 border border-amber/35 bg-amber/10 px-3 py-2 text-[12px] text-oncanvas/80">
          <span>
            今天要收的卡：{overdue.length > 0 && <b className="font-semibold">{overdue.length} 张已过期</b>}
            {overdue.length > 0 && today.length > 0 && ' · '}
            {today.length > 0 && <b className="font-semibold">{today.length} 张今天到期</b>}
          </span>
          <button
            type="button"
            disabled={printingToday}
            onClick={() => printToday([...overdue, ...today].slice(0, 8).map((t) => t.id))}
            className="ml-auto border border-oncanvas/25 px-3 py-1 text-[11px] text-oncanvas/80 hover:border-oncanvas/50 disabled:opacity-50"
          >
            {printingToday ? '排版中…' : '生成今日一页 →'}
          </button>
        </div>
      )}
      {flash && <p className="text-[12px] text-seal">{flash}</p>}

      {error && (
        <p className="border border-seal/50 bg-seal/10 px-3 py-2 text-[12px] text-oncanvas/80">
          连不上后端：{error}
          <span className="ml-2 text-oncanvas/50">（PocketBase 起了吗？见 README）</span>
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
            <p className="text-[11px] text-oncanvas/35">
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
    tone === 'seal' ? 'bg-seal' : tone === 'amber' ? 'bg-amber' : 'bg-oncanvas/25';

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline gap-2">
        <span aria-hidden className={`h-2 w-2 translate-y-px ${accent}`} />
        <h2 className="text-[13px] font-medium tracking-[0.14em] text-oncanvas/80">{title}</h2>
        <span className="font-mono text-[11px] text-oncanvas/30">{tasks.length}</span>
        {hint && <span className="ml-1 text-[11px] text-oncanvas/30">{hint}</span>}
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
          className="h-[132px] animate-pulse bg-oncanvas/10"
          style={{ animationDelay: `${i * 60}ms` }}
        />
      ))}
    </div>
  );
}
