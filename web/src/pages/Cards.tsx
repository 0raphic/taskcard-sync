import { useEffect, useMemo, useState } from 'react';
import { Link } from '../lib/router';
import { pb } from '../lib/pb';
import type { ShortLink, Task } from '../lib/types';
import { fmtAgo } from '../lib/time';

type Row = ShortLink & { expand?: { task?: Task } };

const BATCH_KEY = 'taskcard:lastBatch';

function readBatch(): string[] {
  try {
    const raw = localStorage.getItem(BATCH_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

type Group = 'all' | 'unused' | 'using' | 'done' | 'revoked';

const GROUPS: { key: Group; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'unused', label: '未使用' },
  { key: 'using', label: '使用中' },
  { key: 'done', label: '已完成' },
  { key: 'revoked', label: '已作废' },
];

function groupOf(row: Row): Group {
  if (row.active === false) return 'revoked';
  const t = row.expand?.task;
  if (!t) return 'using';
  if (t.status === 'done') return 'done';
  if (t.draft) return 'unused';
  return 'using';
}

export function Cards() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [group, setGroup] = useState<Group>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [batch] = useState<string[]>(readBatch);
  const [picked, setPicked] = useState<string[]>([]);
  const [fillSheet, setFillSheet] = useState(false);

  useEffect(() => {
    let alive = true;
    let unsub: (() => void) | undefined;
    pb.collection('short_links')
      .getFullList<Row>({ sort: '-created', expand: 'task' })
      .then((list) => alive && setRows(list))
      .catch(() => alive && setRows([]));
    pb.collection('short_links')
      .subscribe<Row>('*', (e) => {
        setRows((prev) => {
          if (!prev) return prev;
          if (e.action === 'create') return [e.record, ...prev];
          if (e.action === 'delete') return prev.filter((r) => r.id !== e.record.id);
          return prev.map((r) => (r.id === e.record.id ? { ...r, ...e.record } : r));
        });
      })
      .then((fn) => {
        if (alive) unsub = fn;
        else fn();
      })
      .catch(() => {});
    return () => {
      alive = false;
      unsub?.();
    };
  }, []);

  const counts = useMemo(() => {
    const c: Record<Group, number> = { all: 0, unused: 0, using: 0, done: 0, revoked: 0 };
    for (const r of rows ?? []) {
      c.all += 1;
      c[groupOf(r)] += 1;
    }
    return c;
  }, [rows]);

  const shown = useMemo(
    () => (rows ?? []).filter((r) => group === 'all' || groupOf(r) === group),
    [rows, group],
  );

  async function openPdf(res: Response) {
    if (!res.ok) {
      const b = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(b.error || `HTTP ${res.status}`);
    }
    const url = URL.createObjectURL(await res.blob());
    const win = window.open(url, '_blank');
    if (!win) setFlash('浏览器拦了弹窗，允许后重试，或到「打印」页重新生成');
    return url;
  }

  async function revoke(code: string) {
    setBusy(code);
    setFlash(null);
    try {
      const res = await fetch('/ds-api/cards.revoke', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const b = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !b.ok) throw new Error(b.error || `HTTP ${res.status}`);
      setFlash(`${code} 已作废，扫这张纸会提示「已作废」`);
    } catch (e) {
      setFlash(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function revokeMany(codes: string[]) {
    if (!codes.length) return;
    const ok = window.confirm(`作废 ${codes.length} 张卡？作废后扫这些纸只会提示「已作废」，不能再写回。`);
    if (!ok) return;
    setBusy(`revoke:${codes.join(',')}`);
    setFlash(null);
    try {
      const res = await fetch('/ds-api/cards.revoke', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ codes }),
      });
      const b = (await res.json()) as { ok?: boolean; revoked?: number; error?: string; failed?: { code: string }[] };
      if (!res.ok || !b.ok) throw new Error(b.error || `HTTP ${res.status}`);
      setFlash(`作废 ${b.revoked ?? codes.length} 张${b.failed?.length ? `，${b.failed.length} 张没成功` : ''}，纸留着当便签就行`);
      setPicked([]);
    } catch (e) {
      setFlash(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function reprint(codes: string[], fill = false) {
    setBusy(`reprint:${codes.join(',')}`);
    setFlash(null);
    try {
      const res = await fetch('/ds-api/cards.reprint', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ codes, fill }),
      });
      await openPdf(res);
      const filled = Number(res.headers.get('x-fill-count') || 0);
      const total = Number(res.headers.get('x-card-count') || codes.length);
      setFlash(
        filled > 0
          ? `补印 ${codes.length} 张 + 新卡 ${filled} 张，凑满一页（共 ${total} 张），短码不变`
          : `补印 ${codes.length} 张，短码不变`,
      );
      setPicked([]);
    } catch (e) {
      setFlash(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] tracking-[0.18em] text-oncanvas/40">卡片</p>
          <h1 className="mt-1 text-[24px] font-semibold tracking-tight">这一叠纸都去哪了</h1>
          <p className="mt-1 max-w-[560px] text-[12px] leading-relaxed text-oncanvas/45">
            每张空白卡都是一条记录：没用过的、正在写的、做完的、作废的，都在这儿。
            丢了的补印一张（短码不变），不想再用的就作废。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/print"
            className={
              picked.length > 0
                ? 'border border-line/25 px-4 py-2 text-[12px] text-oncanvas/75 hover:border-line/50'
                : 'bg-seal px-4 py-2 text-[12px] font-medium text-white hover:opacity-90'
            }
          >
            打印新空白卡
          </Link>
          {picked.length > 0 && (
            <>
              <label className="flex cursor-pointer items-center gap-1.5 border border-line/20 px-3 py-2 text-[11px] text-oncanvas/60">
                <input
                  type="checkbox"
                  className="accent-seal"
                  checked={fillSheet}
                  onChange={(e) => setFillSheet(e.target.checked)}
                />
                用新卡填满这页
              </label>
              <button
                type="button"
                onClick={() => reprint(picked, fillSheet)}
                disabled={busy !== null}
                className="bg-seal px-4 py-2 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                补印选中的 {picked.length} 张
              </button>
              <button
                type="button"
                onClick={() => revokeMany(picked)}
                disabled={busy !== null}
                className="border border-seal/40 px-3 py-2 text-[12px] text-seal hover:border-seal/70 disabled:opacity-50"
              >
                作废选中的 {picked.length} 张
              </button>
            </>
          )}
          {batch.length > 0 && (
            <button
              type="button"
              onClick={() => reprint(batch)}
              disabled={busy !== null}
              className="border border-line/25 px-3 py-2 text-[12px] text-oncanvas/75 hover:border-line/50 disabled:opacity-50"
            >
              补印上一批（{batch.length} 张）
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {GROUPS.map((g) => (
          <button
            key={g.key}
            type="button"
            onClick={() => setGroup(g.key)}
            className={`border px-2.5 py-1 text-[12px] transition-colors ${
              group === g.key
                ? 'border-seal bg-seal/15 text-oncanvas'
                : 'border-line/15 text-oncanvas/55 hover:border-line/35'
            }`}
          >
            {g.label}
            <span className="ml-1 font-mono text-[10px] text-oncanvas/35">{counts[g.key]}</span>
          </button>
        ))}
        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              const alive = shown.filter((r) => r.active !== false).map((r) => r.code);
              const allPicked = alive.length > 0 && alive.every((c) => picked.includes(c));
              setPicked(allPicked ? picked.filter((c) => !alive.includes(c)) : Array.from(new Set([...picked, ...alive])));
            }}
            className="text-[11px] text-oncanvas/45 hover:text-oncanvas/80"
          >
            {shown.length > 0 && shown.filter((r) => r.active !== false).every((r) => picked.includes(r.code))
              ? '取消选择本组'
              : `选择本组（${shown.filter((r) => r.active !== false).length}）`}
          </button>
          <button
            type="button"
            onClick={() => {
              const all = (rows ?? []).filter((r) => r.active !== false).map((r) => r.code);
              const allPicked = all.length > 0 && all.every((c) => picked.includes(c));
              setPicked(allPicked ? [] : all);
            }}
            className="text-[11px] text-oncanvas/45 hover:text-oncanvas/80"
          >
            {(rows ?? []).filter((r) => r.active !== false).every((r) => picked.includes(r.code)) &&
            (rows ?? []).some((r) => r.active !== false)
              ? '取消全选'
              : `全选（${(rows ?? []).filter((r) => r.active !== false).length}）`}
          </button>
          {picked.length > 0 && (
            <button type="button" onClick={() => setPicked([])} className="text-[11px] text-oncanvas/45 hover:text-oncanvas/80">
              清空
            </button>
          )}
          <span className="text-[11px] text-oncanvas/30">短码是纸卡的身份证，别改它</span>
        </div>
      </div>

      {flash && <p className="text-[12px] text-oncanvas/60">{flash}</p>}

      {!rows && <div className="h-[160px] animate-pulse bg-oncanvas/10" />}

      {rows && shown.length === 0 && (
        <p className="border border-dashed border-line/25 px-4 py-10 text-center text-[12px] text-oncanvas/35">
          这一组还没有卡
        </p>
      )}

      <ul className="flex flex-col divide-y divide-line/40 border-y border-line/25">
        {shown.map((row) => {
          const t = row.expand?.task;
          const g = groupOf(row);
          const dead = row.active === false;
          return (
            <li
              key={row.id}
              className={`flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 ${dead ? 'opacity-45' : ''}`}
            >
              {!dead && (
                <input
                  type="checkbox"
                  checked={picked.includes(row.code)}
                  onChange={(e) =>
                    setPicked((prev) => (e.target.checked ? [...prev, row.code] : prev.filter((c) => c !== row.code)))
                  }
                  aria-label={`选择 ${row.code}`}
                  className="h-3.5 w-3.5 shrink-0 accent-seal"
                />
              )}
              <span className="font-mono text-[12px] tracking-[0.06em] text-oncanvas/75">{row.code}</span>
              <span
                className={`text-[10px] tracking-[0.14em] ${
                  g === 'unused'
                    ? 'text-amber'
                    : g === 'done'
                      ? 'text-moss'
                      : g === 'revoked'
                        ? 'text-oncanvas/30'
                        : 'text-oncanvas/40'
                }`}
              >
                {{ unused: '未使用', using: '使用中', done: '已完成', revoked: '已作废', all: '' }[g]}
              </span>
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-oncanvas/75">
                {t?.title || '（空白卡）'}
              </span>
              <span className="font-mono text-[10px] text-oncanvas/30">
                {row.last_scan_at ? fmtAgo(row.last_scan_at) : row.scans ? `被扫 ${row.scans} 次` : '还没扫过'}
              </span>
              <div className="flex shrink-0 gap-1.5">
                {!dead && (
                  <button
                    type="button"
                    onClick={() => reprint([row.code])}
                    disabled={busy !== null}
                    className="border border-line/25 px-2 py-1 text-[11px] text-oncanvas/70 hover:border-line/50 disabled:opacity-40"
                  >
                    补印
                  </button>
                )}
                {!dead && (
                  <button
                    type="button"
                    onClick={() => revoke(row.code)}
                    disabled={busy !== null}
                    className="border border-seal/30 px-2 py-1 text-[11px] text-seal/85 hover:border-seal/60 disabled:opacity-40"
                  >
                    作废
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <p className="text-[11px] leading-relaxed text-oncanvas/30">
        作废的卡扫码会提示「这张卡已经作废」；补印出来的纸卡二维码和短码与原来一致，
        旧纸还能当便签用。
      </p>
    </div>
  );
}
