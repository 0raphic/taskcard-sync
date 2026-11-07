import { useState } from 'react';
import { TaskSheet } from '../components/TaskSheet';
import { logProgress, message, useShortLink, useUpdateTask } from '../lib/data';
import { Link } from '../lib/router';
import { STATUS_LABEL, type Status } from '../lib/types';
import { fileToJpegDataUrl } from '../lib/image';

export function Landing({ code }: { code: string }) {
  const { loading, task, link, error, notFound, revoked } = useShortLink(code);
  const update = useUpdateTask();
  const [pending, setPending] = useState<Status | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [done, setDone] = useState<{ title: string; hint: string } | null>(null);
  const [note, setNote] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [review, setReview] = useState('');

  async function act(status: Status) {
    if (!task) return;
    // 完成前先问一句复盘，可跳过
    if (status === 'done') {
      setReviewing(true);
      return;
    }
    setPending(status);
    setFlash(null);
    try {
      await update(task.id, { status });
      setFlash(`已标记为「${STATUS_LABEL[status]}」`);
      setDone({ title: `已标记为「${STATUS_LABEL[status]}」`, hint: '看板上已经同步，不用刷新。' });
    } catch (e) {
      setFlash(`没改成：${message(e)}`);
    } finally {
      setPending(null);
    }
  }

  async function finish() {
    if (!task) return;
    setPending('done');
    setFlash(null);
    try {
      if (review.trim()) await logProgress(task.id, `复盘：${review.trim()}`);
      await update(task.id, { status: 'done' });
      setReviewing(false);
      setReview('');
      setFlash('做完了，纸卡可以收进文件夹了');
      setDone({ title: '这张卡做完了', hint: '看板上已经进「已完成」，纸卡可以收进文件夹。' });
    } catch (e) {
      setFlash(`没改成：${message(e)}`);
    } finally {
      setPending(null);
    }
  }

  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState<{
    title?: string;
    priority?: string;
    dod?: string;
    start?: string;
    due?: string;
    estimate_min?: number | null;
    description?: string;
    materials?: string;
    notes?: string;
    progress?: number | null;
    weekly_hours?: number | null;
  } | null>(null);

  async function fromPhoto(file: File) {
    setScanning(true);
    setFlash(null);
    try {
      const image = await fileToJpegDataUrl(file);
      const res = await fetch('/ds-api/scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ image, code }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        fields?: Record<string, unknown>;
      };
      if (!res.ok || !body.ok) throw new Error(body.error || `识别失败 HTTP ${res.status}`);
      const f = body.fields ?? {};
      setFields({
        title: typeof f.title === 'string' ? f.title : '',
        due: typeof f.due === 'string' ? f.due : '',
        estimate_min: typeof f.estimate_min === 'number' ? f.estimate_min : null,
        description: typeof f.description === 'string' ? f.description : '',
        materials: typeof f.materials === 'string' ? f.materials : '',
        notes: typeof f.notes === 'string' ? f.notes : '',
        progress: typeof f.progress === 'number' ? f.progress : null,
      });
      setFlash('认出来了，核对一下再保存');
    } catch (e) {
      setFlash(`没认出来：${message(e)}`);
    } finally {
      setScanning(false);
    }
  }

  async function saveFields() {
    if (!task || !fields) return;
    setSaving(true);
    setFlash(null);
    try {
      // 只写「卡面上确实读到了」的字段：空白项保留系统里原来的值，避免误清空
      const payload: Record<string, unknown> = {};
      const title = (fields.title ?? '').trim();
      const due = (fields.due ?? '').trim();
      const desc = (fields.description ?? '').trim();
      const materials = (fields.materials ?? '').trim();
      const notes = (fields.notes ?? '').trim();
      const dod = (fields.dod ?? '').trim();
      const priority = (fields.priority ?? '').trim();
      const start = (fields.start ?? '').trim();
      if (title) payload.title = title;
      if (due) payload.due = due;
      if (fields.estimate_min) payload.estimate_min = fields.estimate_min;
      if (desc) payload.description = desc;
      if (materials) payload.materials = materials;
      if (notes) payload.notes = notes;
      if (dod) payload.dod = dod;
      if (priority) payload.priority = priority;
      if (start) payload.start = start;
      if (task.kind === 'long' && fields.weekly_hours) payload.weekly_hours = fields.weekly_hours;
      if (task.kind === 'long' && fields.progress != null) {
        payload.progress = Math.max(0, Math.min(100, fields.progress));
      }
      if (Object.keys(payload).length === 0) {
        setFlash('卡面上没读到内容，可以把字写清楚一点再拍');
        return;
      }
      await update(task.id, payload);
      setFields(null);
      setFlash('已经写回这张卡，看板同步更新了');
      setDone({ title: '已写回这张卡', hint: '看板、全部任务里都是新内容了。' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setFlash(`没写回去：${message(e)}`);
    } finally {
      setSaving(false);
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
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-4 py-8">
      <div className="w-full max-w-[420px]">
        <header className="sticky top-0 z-10 -mx-1 mb-3 flex items-center justify-between bg-canvas/95 px-1 py-2 backdrop-blur">
          <Link
            to="/"
            className="flex items-center gap-1 text-[12px] text-oncanvas/70 hover:text-oncanvas"
          >
            <span aria-hidden>←</span> 回看板
          </Link>
          <span className="font-mono text-[10px] tracking-[0.2em] text-oncanvas/40">{code}</span>
        </header>

        {loading && <div className="h-[380px] animate-pulse bg-oncanvas/10" />}

        {!loading && revoked && (
          <div className="bg-surface px-6 py-10 text-ink trim">
            <p className="text-[15px] font-semibold">这张卡已经作废</p>
            <p className="mt-2 text-[12px] leading-relaxed text-ink-soft">
              这张纸的码已经停用，再写回也不会生效。手上这张可以留着当便签；
              需要的话去「卡片」页补印一张。
            </p>
            <div className="mt-6 flex gap-2">
              <Link to="/cards" className="border border-ink/25 px-3 py-2 text-[12px] hover:bg-ink/5">
                去卡片页
              </Link>
              <Link to="/" className="border border-ink/25 px-3 py-2 text-[12px] hover:bg-ink/5">
                回看板
              </Link>
            </div>
          </div>
        )}

        {!loading && !revoked && error && (
          <div className="bg-surface px-6 py-10 text-ink trim">
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

        {task && (
          <TaskSheet task={task} code={code} scans={link?.scans} lastScan={link?.last_scan_at} />
        )}

        {done && (
          <section className="mt-3 border border-moss/40 bg-surface px-4 py-3.5 text-ink">
            <p className="text-[13px] font-semibold">{done.title}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">{done.hint}</p>
            <div className="mt-3 flex gap-2">
              <Link
                to="/"
                className="flex-1 bg-seal px-3 py-2.5 text-center text-[13px] font-medium text-white"
              >
                回看板
              </Link>
              <button
                type="button"
                onClick={() => setDone(null)}
                className="border border-ink/20 px-3 py-2.5 text-[12px] text-ink-soft hover:border-ink/40"
              >
                留在这页
              </button>
            </div>
          </section>
        )}

        {task?.kind === 'long' && (
          <section className="mt-3 border border-line/15 bg-oncanvas/[0.03] px-3 pb-3 pt-2.5">
            <div className="flex items-center justify-between text-[10px] tracking-[0.16em] text-oncanvas/45">
              <span>长期任务 · 进度</span>
              <span className="font-mono text-[12px] tracking-normal text-oncanvas/80">{pct}%</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => bump(-10)}
                className="h-9 w-9 shrink-0 border border-line/25 text-[16px] leading-none text-oncanvas/80 hover:border-line/50"
                aria-label="进度减 10%"
              >
                −
              </button>
              <div className="h-1.5 flex-1 bg-oncanvas/10">
                <div className="h-full bg-seal transition-[width] duration-300" style={{ width: `${pct}%` }} />
              </div>
              <button
                type="button"
                onClick={() => bump(10)}
                className="h-9 w-9 shrink-0 border border-line/25 text-[16px] leading-none text-oncanvas/80 hover:border-line/50"
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
                className="min-w-0 flex-1 border border-line/20 bg-transparent px-2 py-1.5 text-[12px] text-oncanvas placeholder:text-oncanvas/25 focus:border-line/40"
              />
              <button
                type="button"
                onClick={addNote}
                className="shrink-0 border border-line/25 px-3 text-[11px] text-oncanvas/80 hover:border-line/50"
              >
                记一笔
              </button>
            </div>
          </section>
        )}

        {task && !fields && (
          <div className="mt-4 flex flex-col gap-2">
            <label
              className={
                done
                  ? `flex w-full cursor-pointer items-center justify-center gap-2 border border-line/25 px-4 py-3.5 text-[13px] text-oncanvas/80 transition-colors hover:border-line/50 ${scanning ? 'opacity-60' : ''}`
                  : `flex w-full cursor-pointer items-center justify-center gap-2 bg-seal px-4 py-4 text-[15px] font-semibold tracking-[0.06em] text-white transition-colors hover:bg-seal/90 ${scanning ? 'opacity-60' : ''}`
              }
            >
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                disabled={scanning}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) void fromPhoto(f);
                }}
              />
              {scanning ? '识别中…' : '拍一张，更新这张卡'}
            </label>
            <label className="flex w-full cursor-pointer items-center justify-center border border-line/25 px-4 py-3 text-[13px] text-oncanvas/85 transition-colors hover:border-line/50">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={scanning}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) void fromPhoto(f);
                }}
              />
              从相册选一张
            </label>
            <p className="px-1 text-[11px] leading-relaxed text-oncanvas/40">
              拍整张纸卡（右上角二维码要清楚）。认出卡面后核对一遍，再写回系统。
            </p>
          </div>
        )}

        {task && fields && (
          <section className="mt-4 border border-seal/30 bg-surface px-4 py-4 text-ink">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-semibold">认出卡面内容，核对一下</p>
              <button type="button" onClick={() => setFields(null)} className="text-[11px] text-ink-soft underline underline-offset-4">
                取消
              </button>
            </div>
            <div className="mt-3 flex flex-col gap-2.5">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] tracking-[0.14em] text-ink-soft">标题</span>
                <input
                  value={fields.title ?? ''}
                  onChange={(e) => setFields({ ...fields, title: e.target.value })}
                  className="border border-ink/15 px-2 py-1.5 text-[13px] focus:border-ink/35"
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] tracking-[0.14em] text-ink-soft">优先级</span>
                  <select
                    value={fields.priority ?? ''}
                    onChange={(e) => setFields({ ...fields, priority: e.target.value })}
                    className="border border-ink/15 bg-surface px-2 py-1.5 text-[13px] focus:border-ink/35"
                  >
                    <option value="">（没写）</option>
                    <option value="重要且紧急">重要且紧急</option>
                    <option value="重要不紧急">重要不紧急</option>
                    <option value="紧急不重要">紧急不重要</option>
                    <option value="其他">其他</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] tracking-[0.14em] text-ink-soft">完成标准</span>
                  <input
                    value={fields.dod ?? ''}
                    onChange={(e) => setFields({ ...fields, dod: e.target.value })}
                    placeholder="做到什么程度算完"
                    className="border border-ink/15 px-2 py-1.5 text-[12px] focus:border-ink/35"
                  />
                </label>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] tracking-[0.14em] text-ink-soft">开始</span>
                  <input
                    value={fields.start ?? ''}
                    onChange={(e) => setFields({ ...fields, start: e.target.value })}
                    placeholder="MM-DD"
                    className="border border-ink/15 px-2 py-1.5 text-[13px] focus:border-ink/35"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] tracking-[0.14em] text-ink-soft">截止</span>
                  <input
                    value={fields.due ?? ''}
                    onChange={(e) => setFields({ ...fields, due: e.target.value })}
                    placeholder="MM-DD"
                    className="border border-ink/15 px-2 py-1.5 text-[13px] focus:border-ink/35"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] tracking-[0.14em] text-ink-soft">用时（分）</span>
                  <input
                    value={fields.estimate_min ?? ''}
                    onChange={(e) => setFields({ ...fields, estimate_min: e.target.value === '' ? null : Number(e.target.value) })}
                    inputMode="numeric"
                    className="border border-ink/15 px-2 py-1.5 text-[13px] focus:border-ink/35"
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] tracking-[0.14em] text-ink-soft">描述</span>
                <textarea
                  value={fields.description ?? ''}
                  onChange={(e) => setFields({ ...fields, description: e.target.value })}
                  rows={2}
                  className="resize-none border border-ink/15 px-2 py-1.5 text-[12px] focus:border-ink/35"
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] tracking-[0.14em] text-ink-soft">材料</span>
                  <input
                    value={fields.materials ?? ''}
                    onChange={(e) => setFields({ ...fields, materials: e.target.value })}
                    className="border border-ink/15 px-2 py-1.5 text-[12px] focus:border-ink/35"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] tracking-[0.14em] text-ink-soft">备注</span>
                  <input
                    value={fields.notes ?? ''}
                    onChange={(e) => setFields({ ...fields, notes: e.target.value })}
                    className="border border-ink/15 px-2 py-1.5 text-[12px] focus:border-ink/35"
                  />
                </label>
              </div>
              {task.kind === 'long' && (
                <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] tracking-[0.14em] text-ink-soft">进度 %</span>
                  <input
                    value={fields.progress ?? ''}
                    onChange={(e) => setFields({ ...fields, progress: e.target.value === '' ? null : Number(e.target.value) })}
                    inputMode="numeric"
                    className="border border-ink/15 px-2 py-1.5 text-[13px] focus:border-ink/35"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] tracking-[0.14em] text-ink-soft">周投入（小时）</span>
                  <input
                    value={fields.weekly_hours ?? ''}
                    onChange={(e) => setFields({ ...fields, weekly_hours: e.target.value === '' ? null : Number(e.target.value) })}
                    inputMode="numeric"
                    className="border border-ink/15 px-2 py-1.5 text-[13px] focus:border-ink/35"
                  />
                </label>
                </div>
              )}
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveFields()}
              className="mt-3 w-full bg-seal px-3 py-2.5 text-[13px] font-medium text-white disabled:opacity-50"
            >
              {saving ? '保存中…' : '写回这张卡'}
            </button>
          </section>
        )}

        {task && !fields && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-1 text-[11px] text-oncanvas/45">
            <span>或手动改状态：</span>
            <button type="button" disabled={pending !== null} onClick={() => act('doing')} className="underline underline-offset-4 hover:text-oncanvas/80">
              进行中
            </button>
            <button type="button" disabled={pending !== null} onClick={() => act('paused')} className="underline underline-offset-4 hover:text-oncanvas/80">
              搁置
            </button>
            <button type="button" disabled={pending !== null} onClick={() => act('done')} className="underline underline-offset-4 hover:text-oncanvas/80">
              完成
            </button>
          </div>
        )}

        {task && reviewing && (
          <div className="mt-3 flex flex-col gap-2 border border-seal/30 bg-surface px-4 py-4 text-ink">
            <p className="text-[13px] font-semibold">收尾时说一句</p>
            <p className="text-[11px] leading-relaxed text-ink-soft">
              这一步卡了多久、为什么、下次怎么改——写一句就够，跳过也行。
            </p>
            <textarea
              value={review}
              onChange={(e) => setReview(e.target.value)}
              rows={2}
              autoFocus
              placeholder="例：比预估多花 20 分钟，二维码尺寸量错重印了一次"
              className="w-full resize-none border border-ink/15 px-2 py-1.5 text-[12px] text-ink placeholder:text-ink-soft/50 focus:border-ink/35"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pending !== null}
                onClick={finish}
                className="flex-1 bg-seal px-3 py-2.5 text-[13px] font-medium text-white disabled:opacity-50"
              >
                {pending === 'done' ? '保存中…' : '保存并完成'}
              </button>
              <button
                type="button"
                disabled={pending !== null}
                onClick={finish}
                className="border border-ink/20 px-3 py-2.5 text-[12px] text-ink-soft hover:border-ink/40"
              >
                跳过
              </button>
            </div>
          </div>
        )}

        {task && (
          <div className="mt-3 flex items-center justify-between gap-3 px-1 text-[11px] text-oncanvas/40">
            <span>{done ? '纸卡和网页已经是同一份数据了' : flash ?? '点一下，网页和纸卡就同步了'}</span>
            <Link
              to={`/tasks/${task.id}`}
              className="shrink-0 underline decoration-oncanvas/25 underline-offset-4"
            >
              详情
            </Link>
          </div>
        )}

        <nav className="mt-6 flex items-center justify-center gap-4 text-[11px] text-oncanvas/45">
          <Link to="/" className="hover:text-oncanvas/80">看板</Link>
          <span aria-hidden className="text-oncanvas/20">/</span>
          <Link to="/tasks" className="hover:text-oncanvas/80">全部任务</Link>
          <span aria-hidden className="text-oncanvas/20">/</span>
          <Link to="/cards" className="hover:text-oncanvas/80">卡片</Link>
        </nav>
      </div>
    </div>
  );
}
