import { useEffect, useState } from 'react';
import { TaskSheet } from '../components/TaskSheet';
import { logProgress, message, useTask, useUpdateTask, deleteTask } from '../lib/data';
import { pb } from '../lib/pb';
import { fmtDateTime } from '../lib/time';
import { Link, navigate } from '../lib/router';
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
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  async function remove() {
    setDeleting(true);
    setFlash(null);
    try {
      await deleteTask(id);
      navigate('/tasks');
    } catch (e) {
      setFlash(message(e));
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5">
      <div className="flex items-center justify-between">
        <Link to="/" className="text-[12px] text-oncanvas/50 hover:text-oncanvas">
          ← 看板
        </Link>
        <span className="font-mono text-[10px] text-oncanvas/25">
          {code ? <>短码 {code}</> : id}
        </span>
      </div>

      {error && <p className="text-[13px] text-seal">{error}</p>}
      {!task && !error && <div className="h-[360px] animate-pulse bg-oncanvas/10" />}

      {task && (
        <>
          <TaskSheet task={task} />

          <section className="flex flex-col gap-2">
            <h2 className="text-[11px] tracking-[0.18em] text-oncanvas/45">改状态</h2>
            <div className="grid grid-cols-4 gap-2">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={busy}
                  onClick={() => setStatus(s)}
                  className={`border px-2 py-2.5 text-[12px] transition-colors disabled:opacity-50 ${
                    task.status === s
                      ? 'border-seal bg-seal/15 text-oncanvas'
                      : 'border-line/20 text-oncanvas/70 hover:border-line/45'
                  }`}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
            {flash && <p className="text-[11px] text-oncanvas/45">{flash}</p>}
          </section>

          {(task.priority || task.dod || task.start || task.weekly_hours) && (
            <section className="space-y-1.5">
              <h2 className="text-[11px] tracking-[0.18em] text-oncanvas/45">卡面上的规划</h2>
              {task.priority && (
                <p className="text-[12px] text-oncanvas/70">
                  优先级 <span className="text-oncanvas">{task.priority}</span>
                </p>
              )}
              {task.dod && (
                <p className="text-[12px] text-oncanvas/70">
                  完成标准 <span className="text-oncanvas">{task.dod}</span>
                </p>
              )}
              {task.start && (
                <p className="text-[12px] text-oncanvas/70">
                  开始 <span className="text-oncanvas">{task.start}</span>
                </p>
              )}
              {task.weekly_hours ? (
                <p className="text-[12px] text-oncanvas/70">
                  每周投入 <span className="text-oncanvas">{task.weekly_hours} 小时</span>
                </p>
              ) : null}
            </section>
          )}

          {task.kind === 'long' && (
            <section className="flex flex-col gap-2">
              <h2 className="text-[11px] tracking-[0.18em] text-oncanvas/45">进度</h2>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setProgress((task.progress ?? 0) - 10)}
                  className="h-8 w-8 border border-line/20 text-oncanvas/70 hover:border-line/45"
                >
                  −
                </button>
                <span className="w-14 text-center font-mono text-[15px]">{task.progress ?? 0}%</span>
                <button
                  type="button"
                  onClick={() => setProgress((task.progress ?? 0) + 10)}
                  className="h-8 w-8 border border-line/20 text-oncanvas/70 hover:border-line/45"
                >
                  +
                </button>
              </div>
            </section>
          )}

          <section className="flex flex-col gap-2">
            <h2 className="text-[11px] tracking-[0.18em] text-oncanvas/45">进展记录</h2>
            <div className="flex gap-2">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addNote()}
                placeholder="今天推进到哪了？"
                className="flex-1 border border-line/20 bg-transparent px-3 py-2 text-[13px] text-oncanvas placeholder:text-oncanvas/25 focus:border-line/40"
              />
              <button
                type="button"
                disabled={busy || !note.trim()}
                onClick={addNote}
                className="border border-line/25 px-4 text-[12px] text-oncanvas/80 hover:border-line/50 disabled:opacity-40"
              >
                记一笔
              </button>
            </div>
            {logs.length === 0 ? (
              <p className="text-[11px] text-oncanvas/30">还没有记录。</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line/40">
                {logs.map((row) => (
                  <li key={row.id} className="flex items-baseline gap-3 py-2">
                    <span className="shrink-0 font-mono text-[10px] text-oncanvas/30">
                      {fmtDateTime(row.at)}
                    </span>
                    <span className="text-[12.5px] text-oncanvas/75">{row.note}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-2 flex flex-col gap-2 border border-seal/25 px-4 py-3">
            <h2 className="text-[11px] tracking-[0.18em] text-seal/80">删除</h2>
            {!confirming ? (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  className="border border-seal/45 px-3 py-2 text-[12px] text-seal/90 hover:border-seal hover:bg-seal/10"
                >
                  删除这张任务卡
                </button>
                <span className="text-[11px] text-oncanvas/35">删了就找不回来。</span>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-[12px] leading-relaxed text-oncanvas/60">
                  会一起删掉：短码 <span className="font-mono text-oncanvas/80">{code || '（还没生成）'}</span>、
                  {logs.length} 条进展记录。已经打印出去的纸卡扫这个码会显示「已经不在系统里」。
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={remove}
                    disabled={deleting}
                    className="bg-seal px-4 py-2 text-[12px] font-medium text-white hover:brightness-110 disabled:opacity-50"
                  >
                    {deleting ? '删除中…' : '确认删除'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    disabled={deleting}
                    className="border border-line/25 px-4 py-2 text-[12px] text-oncanvas/70 hover:border-line/45 disabled:opacity-40"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

