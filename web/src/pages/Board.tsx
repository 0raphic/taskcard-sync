import { useEffect, useRef, useState } from 'react';
import { TaskCard } from '../components/TaskCard';
import { useTasks, useUpdateTask } from '../lib/data';
import { askNotify, notifyPermission, tickReminders } from '../lib/reminders';
import { Link } from '../lib/router';
import { isDone, isOverdue, isToday, type Task } from '../lib/types';

const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

type Column = {
  key: 'todo' | 'doing' | 'done';
  title: string;
  hint: string;
  match: (t: Task) => boolean;
};

const COLUMNS: Column[] = [
  { key: 'todo', title: '待办', hint: '还没开始 · 或先放着', match: (t) => !isDone(t) && t.status !== 'doing' },
  { key: 'doing', title: '进行中', hint: '正在做', match: (t) => t.status === 'doing' },
  { key: 'done', title: '已完成', hint: '收过的卡', match: (t) => isDone(t) },
];

const FOCUS: { key: 'all' | 'today' | 'overdue' | 'checklist'; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'today', label: '今天' },
  { key: 'overdue', label: '逾期' },
  { key: 'checklist', label: '有清单' },
];

export function Board() {
  const { tasks, error } = useTasks();
  const update = useUpdateTask();
  const [printingToday, setPrintingToday] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const [held, setHeld] = useState<Task | null>(null);
  const [focus, setFocus] = useState<'all' | 'today' | 'overdue' | 'checklist'>('all');
  const [q, setQ] = useState('');
  const [notifyState, setNotifyState] = useState(notifyPermission());
  const holdTimer = useRef<number | null>(null);
  const holdStart = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);

  useEffect(() => {
    tickReminders(tasks ?? []);
    const id = window.setInterval(() => tickReminders(tasks ?? []), 30_000);
    return () => window.clearInterval(id);
  }, [tasks]);

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

  function clearHold() {
    if (holdTimer.current) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }

  function startHold(t: Task, e: React.TouchEvent) {
    const p = e.touches[0];
    holdStart.current = { x: p.clientX, y: p.clientY };
    clearHold();
    holdTimer.current = window.setTimeout(() => {
      suppressClick.current = true;
      setHeld(t);
      navigator.vibrate?.(12);
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 800);
    }, 450);
  }

  function moveHold(e: React.TouchEvent) {
    const p = e.touches[0];
    const s = holdStart.current;
    if (!s) return;
    if (Math.abs(p.clientX - s.x) > 10 || Math.abs(p.clientY - s.y) > 10) clearHold();
  }

  async function moveTo(status: 'todo' | 'doing' | 'done') {
    const t = held;
    setHeld(null);
    if (!t || t.status === status) return;
    try {
      await update(t.id, { status });
    } catch (e) {
      setFlash(e instanceof Error ? e.message : String(e));
    }
  }

  async function drop(status: 'todo' | 'doing' | 'done') {
    const id = dragging;
    setDragging(null);
    setOverCol(null);
    if (!id) return;
    const t = (tasks ?? []).find((x) => x.id === id);
    if (!t || t.status === status) return;
    try {
      await update(id, { status });
    } catch (e) {
      setFlash(e instanceof Error ? e.message : String(e));
    }
  }

  // 空白卡是占位记录，内容还没写，不上看板
  const list = (tasks ?? []).filter((t) => !t.draft);

  const overdue = list.filter((t) => isOverdue(t));
  const today = list.filter((t) => isToday(t) && !isOverdue(t));

  const keyword = q.trim().toLowerCase();
  const shown = list.filter((t) => {
    if (focus === 'today' && !isToday(t)) return false;
    if (focus === 'overdue' && !isOverdue(t)) return false;
    if (focus === 'checklist' && !(t.checklist && t.checklist.length > 0)) return false;
    if (!keyword) return true;
    return (
      t.title.toLowerCase().includes(keyword) ||
      (t.description || '').toLowerCase().includes(keyword) ||
      (t.tags || '').toLowerCase().includes(keyword)
    );
  });

  const now = new Date();
  const dateLabel = `${now.getMonth() + 1} 月 ${now.getDate()} 日 · 周${WEEK[now.getDay()]}`;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] tracking-[0.18em] text-oncanvas/40">{dateLabel}</p>
          <h1 className="mt-1 text-[26px] font-semibold leading-tight tracking-tight">
            这一周，卡都在哪一格？
          </h1>
        </div>
        <p className="max-w-[34ch] text-[12px] leading-relaxed text-oncanvas/45">
          三列就是三个阶段。电脑上按住卡片拖到另一列；手机上长按卡片，弹出来选一列。
        </p>
      </header>

      {list.length > 0 && (today.length > 0 || overdue.length > 0) && (
        <div className="flex flex-wrap items-center gap-3 border border-amber/35 bg-amber/10 px-3 py-2 text-[12px] text-oncanvas/80">
          <span>
            今天要收的卡：{overdue.length > 0 && <b className="font-semibold">{overdue.length} 张已过期</b>}
            {overdue.length > 0 && today.length > 0 && ' · '}
            {today.length > 0 && <b className="font-semibold">{today.length} 张今天到期</b>}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {notifyState === 'default' && (
              <button
                type="button"
                onClick={async () => setNotifyState(await askNotify() ? 'granted' : Notification.permission)}
                className="border border-seal/60 px-3 py-1 text-[11px] text-seal hover:bg-seal/10"
              >
                开启到期通知
              </button>
            )}
            <button
              type="button"
              disabled={printingToday}
              onClick={() => printToday([...overdue, ...today].slice(0, 8).map((t) => t.id))}
              className="border border-oncanvas/25 px-3 py-1 text-[11px] text-oncanvas/80 hover:border-oncanvas/50 disabled:opacity-50"
            >
              {printingToday ? '排版中…' : '生成今日一页 →'}
            </button>
          </div>
        </div>
      )}
      {flash && <p className="text-[12px] text-seal">{flash}</p>}

      {error && (
        <p className="border border-seal/50 bg-seal/10 px-3 py-2 text-[12px] text-oncanvas/80">
          连不上后端：{error}
          <span className="ml-2 text-oncanvas/50">（PocketBase 起了吗？见 README）</span>
        </p>
      )}

      {tasks && (
        <div className="flex flex-wrap items-center gap-2 border-y border-line py-2">
          {FOCUS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFocus(f.key)}
              className={`border px-2.5 py-1 text-[11px] tracking-[0.06em] ${
                focus === f.key
                  ? 'border-ink bg-ink text-canvas'
                  : 'border-line text-ink-soft hover:border-ink hover:text-ink'
              }`}
            >
              {f.label}
            </button>
          ))}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜标题 / 标签"
            className="ml-auto w-[170px] border border-line bg-transparent px-2 py-1 text-[12px] outline-none placeholder:text-ink-soft/60 focus:border-ink"
          />
          <span className="font-mono text-[11px] text-ink-soft">
            {shown.length}/{list.length}
          </span>
        </div>
      )}

      {!tasks && !error && <Skeleton />}

      {tasks && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {COLUMNS.map((col) => {
            const items = shown.filter(col.match);
            const isOver = overCol === col.key;
            return (
              <section
                key={col.key}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverCol(col.key);
                }}
                onDragLeave={() => setOverCol((c) => (c === col.key ? null : c))}
                onDrop={(e) => {
                  e.preventDefault();
                  void drop(col.key);
                }}
                className={`flex min-h-[320px] flex-col gap-3 border p-3 transition-colors ${
                  isOver
                    ? 'border-seal/70 bg-seal/[0.06]'
                    : 'border-line/15 bg-oncanvas/[0.02]'
                }`}
              >
                <div className="flex items-baseline gap-2">
                  <span
                    aria-hidden
                    className={`h-2 w-2 translate-y-px ${
                      col.key === 'doing' ? 'bg-seal' : col.key === 'done' ? 'bg-moss' : 'bg-oncanvas/30'
                    }`}
                  />
                  <h2 className="text-[13px] font-medium tracking-[0.14em] text-oncanvas/80">
                    {col.title}
                  </h2>
                  <span className="font-mono text-[11px] text-oncanvas/30">{items.length}</span>
                  <span className="ml-auto text-[10px] text-oncanvas/25">{col.hint}</span>
                </div>

                <div className="flex flex-col gap-3">
                  {items.map((t) => (
                    <div
                      key={t.id}
                      onTouchStart={(e) => startHold(t, e)}
                      onTouchMove={moveHold}
                      onTouchEnd={clearHold}
                      onTouchCancel={clearHold}
                      onClickCapture={(e) => {
                        if (suppressClick.current) {
                          e.preventDefault();
                          e.stopPropagation();
                        }
                      }}
                      draggable
                      onDragStart={(e) => {
                        setDragging(t.id);
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', t.id);
                      }}
                      onDragEnd={() => {
                        setDragging(null);
                        setOverCol(null);
                      }}
                      className={dragging === t.id ? 'opacity-40' : ''}
                    >
                      <TaskCard task={t} />
                    </div>
                  ))}
                  {items.length === 0 && (
                    <p className="border border-dashed border-line/20 px-3 py-8 text-center text-[11px] text-oncanvas/25">
                      把卡拖到这里
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {held && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50 md:items-center md:justify-center">
          <button
            type="button"
            aria-label="取消"
            className="absolute inset-0 cursor-default"
            onClick={() => setHeld(null)}
          />
          <div className="relative w-full border-t border-line/20 bg-canvas p-4 md:w-[420px] md:border md:border-line/25">
            <p className="truncate text-[13px] font-medium text-oncanvas/85">{held.title}</p>
            <p className="mt-1 text-[11px] text-oncanvas/40">移到哪一列？</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {COLUMNS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  disabled={held.status === c.key}
                  onClick={() => moveTo(c.key)}
                  className={`border px-3 py-3 text-[12px] ${
                    held.status === c.key
                      ? 'border-line/20 text-oncanvas/25'
                      : 'border-line/25 text-oncanvas/80 hover:border-seal/60 hover:text-oncanvas'
                  }`}
                >
                  {c.title}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setHeld(null)}
              className="mt-2 w-full border border-line/15 px-3 py-2 text-[12px] text-oncanvas/50"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {tasks && (
        <p className="text-[11px] text-oncanvas/30">
          看不到「搁置」？它留在待办里，卡片上会标出来 ·{' '}
          <Link to="/tasks" className="underline decoration-line/30 underline-offset-4">
            全部任务
          </Link>
        </p>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="h-[320px] animate-pulse border border-line/10 bg-oncanvas/[0.04]"
          style={{ animationDelay: `${i * 80}ms` }}
        />
      ))}
    </div>
  );
}
