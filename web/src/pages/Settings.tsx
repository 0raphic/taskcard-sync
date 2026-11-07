import { useEffect, useState } from 'react';

type Status = {
  configured: boolean;
  key_hint: string;
  model: string;
  vision: string;
};

export function Settings() {
  const [status, setStatus] = useState<Status | null>(null);
  const [key, setKey] = useState('');
  const [model, setModel] = useState('deepseek-flash');
  const [vision, setVision] = useState('deepseek-flash');
  const [flash, setFlash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [backups, setBackups] = useState<{ key: string; size: number; modified: string }[]>([]);
  const [dataFlash, setDataFlash] = useState<string | null>(null);
  const [dataBusy, setDataBusy] = useState(false);

  async function loadBackups() {
    try {
      const r = await fetch('/ds-api/backups');
      const j = (await r.json()) as { ok?: boolean; items?: { key: string; size: number; modified: string }[] };
      setBackups(j.items ?? []);
    } catch {
      setBackups([]);
    }
  }

  async function backupNow() {
    setDataBusy(true);
    setDataFlash(null);
    try {
      const r = await fetch('/ds-api/backup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      const j = (await r.json()) as { ok?: boolean; name?: string; error?: string };
      if (!r.ok || !j.ok) throw new Error(j.error || '备份失败');
      setDataFlash(`已备份：${j.name}`);
      await loadBackups();
    } catch (e) {
      setDataFlash(e instanceof Error ? e.message : String(e));
    } finally {
      setDataBusy(false);
    }
  }

  async function load() {
    const r = await fetch('/ds-api/settings');
    const j = (await r.json()) as Status;
    setStatus(j);
    if (j.model) setModel(j.model);
    if (j.vision) setVision(j.vision);
  }

  useEffect(() => {
    void load();
    void loadBackups();
  }, []);

  async function save() {
    setBusy(true);
    setFlash(null);
    try {
      const body: Record<string, string> = { model: model.trim(), vision: vision.trim() };
      if (key.trim()) body.api_key = key.trim();
      const r = await fetch('/ds-api/settings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = (await r.json()) as { ok?: boolean; error?: string };
      if (!r.ok || !j.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setKey('');
      await load();
      setFlash('已保存。现在可以直接用「录入」里的照片识别了。');
    } catch (e) {
      setFlash(`保存失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[720px] py-10">
      <p className="text-[11px] tracking-[0.24em] text-oncanvas/40">设置</p>
      <h1 className="mt-2 text-[26px] font-semibold">模型与 Key</h1>
      <p className="mt-3 max-w-[52ch] text-[13px] leading-relaxed text-oncanvas/60">
        Key 存在本机 PocketBase 里，只给服务端用，网页上只显示前几位。没有 Key 时「解析成任务」走本地规则，
        照片识别会提示未接。
      </p>

      <div className="paper-lift mt-7 rounded-[3px] bg-surface p-6 text-ink">
        <div className="flex items-center justify-between border-b border-ink/10 pb-4">
          <div>
            <p className="text-[11px] tracking-[0.18em] text-ink/45">DEEPSEEK</p>
            <p className="mt-1 text-[15px] font-semibold">
              {status ? (status.configured ? `已配置 ${status.key_hint}` : '还没有配置') : '读取中…'}
            </p>
          </div>
          <span
            className={`border px-2 py-1 font-mono text-[10px] tracking-[0.18em] ${
              status?.configured ? 'border-moss/50 text-moss' : 'border-seal/50 text-seal'
            }`}
          >
            {status?.configured ? 'READY' : 'MISSING'}
          </span>
        </div>

        <label className="mt-5 block text-[12px] text-ink/55">
          API Key（留空＝不改）
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            type="password"
            autoComplete="off"
            placeholder="sk-…"
            className="mt-1.5 w-full border border-ink/20 bg-white/60 px-3 py-2 font-mono text-[13px] outline-none focus:border-ink/50"
          />
        </label>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-[12px] text-ink/55">
            文字解析模型
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="mt-1.5 w-full border border-ink/20 bg-white/60 px-3 py-2 font-mono text-[13px] outline-none focus:border-ink/50"
            />
          </label>
          <label className="block text-[12px] text-ink/55">
            看图模型（照片识别）
            <input
              value={vision}
              onChange={(e) => setVision(e.target.value)}
              className="mt-1.5 w-full border border-ink/20 bg-white/60 px-3 py-2 font-mono text-[13px] outline-none focus:border-ink/50"
            />
          </label>
        </div>

        <div className="mt-6 flex items-center gap-4">
          <button
            onClick={() => void save()}
            disabled={busy}
            className="bg-ink px-5 py-2.5 text-[13px] text-oncanvas disabled:opacity-60"
          >
            {busy ? '保存中…' : '保存'}
          </button>
          {flash && <span className="text-[12px] text-ink/60">{flash}</span>}
        </div>

        <p className="mt-5 border-t border-ink/10 pt-4 text-[11px] leading-relaxed text-ink/45">
          当前可用模型：<code className="font-mono">deepseek-flash</code>（文字 + 看图）、
          <code className="font-mono">deepseek-v4-pro</code>（仅文字）。保存后立刻生效，不用重启。
        </p>
      </div>

      <div className="paper-lift mt-5 rounded-[3px] bg-surface p-6 text-ink">
        <p className="text-[11px] tracking-[0.18em] text-ink/45">DATA</p>
        <p className="mt-1 text-[15px] font-semibold">数据留档</p>
        <p className="mt-2 text-[12px] leading-relaxed text-ink/55">
          导出是一份 JSON（任务 / 短码 / 进展记录），备份是 PocketBase 的整库 zip。
          建议每次大改版、演示前一天各做一次。
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href="/ds-api/export"
            className="border border-ink/25 px-4 py-2 text-[12px] hover:bg-ink/5"
          >
            导出 JSON
          </a>
          <button
            type="button"
            onClick={() => void backupNow()}
            disabled={dataBusy}
            className="bg-ink px-4 py-2 text-[12px] text-oncanvas disabled:opacity-60"
          >
            {dataBusy ? '备份中…' : '立即备份数据库'}
          </button>
        </div>
        {dataFlash && <p className="mt-3 text-[11px] text-ink/55">{dataFlash}</p>}

        {backups.length > 0 && (
          <ul className="mt-4 max-h-[180px] divide-y divide-ink/10 overflow-auto border-y border-ink/10">
            {backups.map((b) => (
              <li key={b.key} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 truncate font-mono text-[11px] text-ink/60">{b.key}</span>
                <span className="shrink-0 text-[10px] text-ink/35">{(b.size / 1024 / 1024).toFixed(1)} MB</span>
                <a
                  href={`/ds-api/backups/${encodeURIComponent(b.key)}`}
                  className="shrink-0 text-[11px] underline underline-offset-4 hover:text-ink"
                >
                  下载
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
