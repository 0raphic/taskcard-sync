import { useEffect, useMemo, useState } from 'react';
import { useTasks } from '../lib/data';
import { STATUS_LABEL, type Task } from '../lib/types';

function hintNoLan(url: string) {
  try {
    const host = new URL(url).hostname;
    return host === '127.0.0.1' || host === 'localhost' || host === '::1';
  } catch {
    return true;
  }
}

export function Print() {
  const { tasks, error } = useTasks();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [baseUrl, setBaseUrl] = useState('');
  const [netHint, setNetHint] = useState<{ url: string; lan: boolean } | null>(null);
  const [doubleSided, setDoubleSided] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    fetch('/ds-api/net')
      .then((r) => r.json())
      .then((b: { url?: string; lan?: boolean }) => {
        if (b?.url) {
          setNetHint({ url: b.url, lan: Boolean(b.lan) });
          setBaseUrl((prev) => prev || b.url!);
        }
      })
      .catch(() => {});
  }, []);

  const all = useMemo(() => tasks ?? [], [tasks]);

  // 首次进来：?ids=… 用带进来的；否则默认勾「未完成」
  useEffect(() => {
    if (!all.length) return;
    setSelected((prev) => {
      if (prev.size) return prev;
      const q = new URLSearchParams(window.location.search).get('ids');
      if (q) {
        const valid = new Set(q.split(',').filter((id) => all.some((t) => t.id === id)));
        if (valid.size) return valid;
      }
      return new Set(all.filter((t) => t.status !== 'done').map((t) => t.id));
    });
  }, [all]);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const chosen = all.filter((t) => selected.has(t.id));
  const noLan = baseUrl ? hintNoLan(baseUrl) : false;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectWhere(fn: (t: Task) => boolean) {
    setSelected(new Set(all.filter(fn).map((t) => t.id)));
  }

  async function generate() {
    if (!chosen.length) {
      setFlash('先选至少一张卡');
      return;
    }
    setBusy(true);
    setFlash(null);
    try {
      const res = await fetch('/ds-api/cards.pdf', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids: chosen.map((t) => t.id), base_url: baseUrl, double_sided: doubleSided }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `生成失败 HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPreview(url);
      const win = window.open(url, '_blank');
      if (!win) setFlash('浏览器拦了弹窗，点下面「打开 PDF」');
      else setFlash(`已生成 ${chosen.length} 张卡`);
    } catch (e) {
      setFlash(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-5">
      <header>
        <p className="font-mono text-[11px] tracking-[0.18em] text-paper/40">打印</p>
        <h1 className="mt-1 text-[24px] font-semibold tracking-tight">把选中的卡排成 A4</h1>
        <p className="mt-1 text-[12px] leading-relaxed text-paper/45">
          一页 8 张（2×4，1/8 A4），二维码自动指向下面的地址。双面时每页正面后跟一页「复盘」背面。
        </p>
      </header>

      <section className="flex flex-col gap-2 border border-paper/15 p-3">
        <label className="text-[11px] tracking-[0.14em] text-paper/45">二维码指向（手机要能打开这个地址）</label>
        <input
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="http://192.168.0.108:8088"
          className="w-full border border-paper/20 bg-transparent px-3 py-2 font-mono text-[12px] text-paper placeholder:text-paper/25 focus:border-paper/40"
        />
        {noLan && (
          <p className="text-[11px] leading-relaxed text-amber">
            这是本机地址，手机扫不开。换成电脑的局域网 IP（{netHint?.url || 'http://192.168.x.x:8088'}）。
          </p>
        )}
      </section>

      <section className="flex flex-wrap items-center gap-2 text-[12px]">
        <button type="button" onClick={() => selectWhere(() => true)} className="border border-paper/20 px-3 py-1.5 text-paper/70 hover:border-paper/45">
          全选
        </button>
        <button type="button" onClick={() => setSelected(new Set())} className="border border-paper/20 px-3 py-1.5 text-paper/70 hover:border-paper/45">
          清空
        </button>
        <button type="button" onClick={() => selectWhere((t) => t.status !== 'done')} className="border border-paper/20 px-3 py-1.5 text-paper/70 hover:border-paper/45">
          只选未完成
        </button>
        <span className="ml-auto font-mono text-paper/50">
          已选 {chosen.length} / {all.length} 张
        </span>
      </section>

      {error && <p className="text-[13px] text-seal">{error}</p>}
      {!all.length && !error && <div className="h-[240px] animate-pulse bg-paper/10" />}

      <div className="max-h-[46vh] divide-y divide-white/5 overflow-auto border border-paper/15">
        {all.map((t) => {
          const on = selected.has(t.id);
          return (
            <label
              key={t.id}
              className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-paper/[0.04]"
            >
              <input type="checkbox" checked={on} onChange={() => toggle(t.id)} className="accent-seal" />
              <span className={`min-w-0 flex-1 truncate text-[13px] ${on ? 'text-paper' : 'text-paper/55'}`}>
                {t.title}
              </span>
              <span className="shrink-0 font-mono text-[10px] text-paper/30">
                {t.kind === 'long' ? '长期' : '短期'} · {STATUS_LABEL[t.status ?? 'todo']}
                {t.due ? ` · ${t.due}` : ''}
              </span>
            </label>
          );
        })}
      </div>

      <label className="flex items-center gap-2 text-[12px] text-paper/70">
        <input type="checkbox" checked={doubleSided} onChange={(e) => setDoubleSided(e.target.checked)} className="accent-seal" />
        双面打印（正面卡 + 背面复盘，沿长边翻页）
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={generate}
          disabled={busy || !chosen.length}
          className="bg-seal px-5 py-2.5 text-[13px] font-medium text-white transition-colors hover:brightness-110 disabled:opacity-40"
        >
          {busy ? '排版中…' : `生成 PDF（${chosen.length} 张）`}
        </button>
        {preview && (
          <a href={preview} target="_blank" rel="noreferrer" className="border border-paper/25 px-3 py-2 text-[12px] text-paper/75 hover:border-paper/50">
            打开 PDF
          </a>
        )}
        {flash && <span className="text-[12px] text-paper/50">{flash}</span>}
      </div>
    </div>
  );
}
