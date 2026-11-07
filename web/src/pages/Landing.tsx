import { useState } from 'react';
import { TaskSheet } from '../components/TaskSheet';
import { logProgress, message, useShortLink, useUpdateTask } from '../lib/data';
import { Link, navigate } from '../lib/router';
import { STATUS_LABEL, type Status } from '../lib/types';

export function Landing({ code }: { code: string }) {
  const { loading, task, link, error, notFound } = useShortLink(code);
  const update = useUpdateTask();
  const [pending, setPending] = useState<Status | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [note, setNote] = useState('');

  async function act(status: Status) {
    if (!task) return;
    setPending(status);
    setFlash(null);
    try {
      await update(task.id, { status });
      setFlash(`已标记为「${STATUS_LABEL[status]}」`);
    } catch (e) {
      setFlash(`没改成：${message(e)}`);
    } finally {
      setPending(null);
    }
  }

  const pct = Math.max(0, Math.min(100, task?.progress ?? 0));

  async function bump(delta: number) {
    if (!task) return;
    try {
      await update(task.id, { progress: Math.max(0, Math.min(100, (task.progress ?? 0) + delta)) });
      setFlash(`进度 ${Math.max(0, Math.min(100, (task.progress ?? 0) + delta))}%`);
    } catch (e) {
      setFlash(`没改成：${message(e)}`);
    }
  }

  async function addNote() {
    if (!task || !note.trim()) return;
    try {
      await logProgress(task.id, note.trim());
      setNote('');
      setFlash('进展记下了');
    } catch (e) {
      setFlash(`没记上：${message(e)}`);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-mat px-4 py-8">
      <div className="w-full max-w-[420px]">
        <div className="mb-3 flex items-center justify-between px-1 font-mono text-[10px] tracking-[0.2em] text-paper/40">
          <span>任务卡片 · 扫码</span>
          <span className="text-paper/60">{code}</span>
        </div>

        {loading && <div className="h-[380px] animate-pulse bg-paper/10" />}

        {!loading && error && (
          <div className="bg-paper px-6 py-10 text-ink trim">
            <p className="text-[15px] font-semibold">这张卡不在系统里了</p>
            <p className="mt-2 text-[12px] leading-relaxed text-ink-soft">
              可能它已经被删掉（纸上这张就留作便签），也可能短码印错了、或者数据库还没导入。
            </p>
            {!notFound && error && !error.startsWith('这个短码') && (
              <p className="mt-3 font-mono text-[11px] leading-relaxed text-ink-soft/70">{error}</p>
            )}
            <Link
              to="/"
              className="mt-6 inline-block border border-ink/25 px-3 py-2 text-[12px] hover:bg-ink/5"
            >
              回看板
            </Link>
          </div>
        )}

        {task && <TaskSheet task={task} code={code} scans={link?.scans} />}

        {task?.kind === 'long' && (
          <section className="mt-3 border border-paper/15 bg-paper/[0.03] px-3 pb-3 pt-2.5">
            <div className="flex items-center justify-between text-[10px] tracking-[0.16em] text-paper/45">
              <span>长期任务 · 进度</span>
              <span className="font-mono text-[12px] tracking-normal text-paper/80">{pct}%</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => bump(-10)}
                className="h-9 w-9 shrink-0 border border-paper/25 text-[16px] leading-none text-paper/80 hover:border-paper/50"
                aria-label="进度减 10%"
              >
                −
              </button>
              <div className="h-1.5 flex-1 bg-paper/10">
                <div className="h-full bg-seal transition-[width] duration-300" style={{ width: `${pct}%` }} />
              </div>
              <button
                type="button"
                onClick={() => bump(10)}
                className="h-9 w-9 shrink-0 border border-paper/25 text-[16px] leading-none text-paper/80 hover:border-paper/50"
                aria-label="进度加 10%"
              >
                ＋
              </button>
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="写一句进展，记到详情里"
                className="min-w-0 flex-1 border border-paper/20 bg-transparent px-2 py-1.5 text-[12px] text-paper placeholder:text-paper/25 focus:border-paper/40"
              />
              <button
                type="button"
                onClick={addNote}
                className="shrink-0 border border-paper/25 px-3 text-[11px] text-paper/80 hover:border-paper/50"
              >
                记一笔
              </button>
            </div>
          </section>
        )}

        {task && (
          <div className="mt-4 flex flex-col gap-2">
            <button
              type="button"
              disabled={pending !== null}
              onClick={() => act('done')}
              className="w-full bg-seal px-4 py-4 text-[15px] font-semibold tracking-[0.1em] text-paper transition-colors hover:bg-seal/90 disabled:opacity-50"
            >
              {pending === 'done' ? '提交中…' : '✓ 做完了'}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={pending !== null}
                onClick={() => act('doing')}
                className="border border-paper/25 px-4 py-3 text-[13px] text-paper/85 transition-colors hover:border-paper/50 disabled:opacity-50"
              >
                正在进行
              </button>
              <button
                type="button"
                disabled={pending !== null}
                onClick={() => act('paused')}
                className="border border-paper/25 px-4 py-3 text-[13px] text-paper/85 transition-colors hover:border-paper/50 disabled:opacity-50"
              >
                先搁置
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 px-1 pt-1 text-[11px] text-paper/40">
              <span>{flash ?? '点一下，网页和纸卡就同步了'}</span>
              <Link
                to={`/tasks/${task.id}`}
                className="shrink-0 underline decoration-paper/25 underline-offset-4"
              >
                详情
              </Link>
            </div>
          </div>
        )}

        <p className="mt-8 text-center text-[10px] tracking-[0.18em] text-paper/25">
          <button
            type="button"
            className="underline-offset-4 hover:underline"
            onClick={() => navigate('/')}
          >
            任务卡片 · 一叠纸 + 一个网页
          </button>
        </p>
      </div>
    </div>
  );
}
