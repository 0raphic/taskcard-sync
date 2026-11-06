import { useEffect, useState } from 'react';
import { TaskSheet } from '../components/TaskSheet';
import { logProgress, message, useTask, useUpdateTask } from '../lib/data';
import { pb } from '../lib/pb';
import { Link } from '../lib/router';
import {
  STATUSES,
  STATUS_LABEL,
  type ProgressLog,
  type Status,
} from '../lib/types';

export function Detail({ id }: { id: string }) {
  const { task, error } = useTask(id);
  const update = useUpdateTask();
  const [logs, setLogs] = useState<ProgressLog[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [code, setCode] = useState('');

  useEffect(() => {
    let alive = true;
    pb.collection('short_links')
      .getFirstListItem(`task="${id}"`)
      .then((row) => alive && setCode(String(row.code ?? '')))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    let alive = true;
    pb.collection('progress_logs')
      .getFullList<ProgressLog>({ filter: `task="${id}"`, sort: '-at' })
      .then((rows) => alive && setLogs(rows))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [id]);

  async function setStatus(status: Status) {
    setBusy(true);
    try {
      await update(id, { status });
      setFlash(`已改为「${STATUS_LABEL[status]}」`);
    } catch (e) {
      setFlash(message(e));
    } finally {
      setBusy(false);
    }
  }

  async function setProgress(progress: number) {
    await update(id, { progress: Math.max(0, Math.min(100, progress)) });
  }

  async function addNote() {
    if (!note.trim() || !task) return;
    setBusy(true);
    try {
      const row = await logProgress(task.id, note.trim());
      setLogs((prev) => [row as unknown as ProgressLog, ...prev]);
      setNote('');
    } catch (e) {
      setFlash(message(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5">
      <div className="flex items-center justify-between">
        <Link to="/" className="text-[12px] text-paper/50 hover:text-paper">
          ← 看板
        </Link>
        <span className="font-mono text-[10px] text-paper/25">
          {code ? <>短码 {code}</> : id}
        </span>
      </div>

      {error && <p className="text-[13px] text-seal">{error}</p>}
      {!task && !error && <div className="h-[360px] animate-pulse bg-paper/10" />}

      {task && (
        <>
          <TaskSheet task={task} />

          <section className="flex flex-col gap-2">
            <h2 className="text-[11px] tracking-[0.18em] text-paper/45">改状态</h2>
            <div className="grid grid-cols-4 gap-2">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={busy}
                  onClick={() => setStatus(s)}
                  className={`border px-2 py-2.5 text-[12px] transition-colors disabled:opacity-50 ${
                    task.status === s
                      ? 'border-seal bg-seal/15 text-paper'
                      : 'border-paper/20 text-paper/70 hover:border-paper/45'
                  }`}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
            {flash && <p className="text-[11px] text-paper/45">{flash}</p>}
          </section>

          {task.kind === 'long' && (
            <section className="flex flex-col gap-2">
              <h2 className="text-[11px] tracking-[0.18em] text-paper/45">进度</h2>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setProgress((task.progress ?? 0) - 10)}
                  className="h-8 w-8 border border-paper/20 text-paper/70 hover:border-paper/45"
                >
                  −
                </button>
                <span className="w-14 text-center font-mono text-[15px]">{task.progress ?? 0}%</span>
                <button
                  type="button"
                  onClick={() => setProgress((task.progress ?? 0) + 10)}
                  className="h-8 w-8 border border-paper/20 text-paper/70 hover:border-paper/45"
                >
                  +
                </button>
              </div>
            </section>
          )}

          <section className="flex flex-col gap-2">
            <h2 className="text-[11px] tracking-[0.18em] text-paper/45">进展记录</h2>
            <div className="flex gap-2">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addNote()}
                placeholder="今天推进到哪了？"
                className="flex-1 border border-paper/20 bg-transparent px-3 py-2 text-[13px] text-paper placeholder:text-paper/25 focus:border-paper/40"
              />
              <button
                type="button"
                disabled={busy || !note.trim()}
                onClick={addNote}
                className="border border-paper/25 px-4 text-[12px] text-paper/80 hover:border-paper/50 disabled:opacity-40"
              >
                记一笔
              </button>
            </div>
            {logs.length === 0 ? (
              <p className="text-[11px] text-paper/30">还没有记录。</p>
            ) : (
              <ul className="flex flex-col divide-y divide-white/5">
                {logs.map((row) => (
                  <li key={row.id} className="flex items-baseline gap-3 py-2">
                    <span className="shrink-0 font-mono text-[10px] text-paper/30">
                      {row.at ? row.at.slice(5, 16).replace('T', ' ') : ''}
                    </span>
                    <span className="text-[12.5px] text-paper/75">{row.note}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

