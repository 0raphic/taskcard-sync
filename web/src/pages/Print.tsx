import { useEffect, useState } from 'react';

type Kind = 'short' | 'long';

const SHORT_FIELDS = [
  ['任务名称', '一句话说清要交付什么'],
  ['优先级', '重要且紧急 / 重要不紧急 / 紧急不重要 / 其他'],
  ['完成标准', '做到什么程度算完'],
  ['开始 / 截止', '两个时间点'],
  ['材料', '要不要借、要不要买'],
  ['备注', '卡在哪、等谁'],
  ['任务状态', '待办 / 进行中 / 完成 / 搁置'],
];

const LONG_FIELDS = [
  ['任务名称', '一句话说清要交付什么'],
  ['目标', '一个阶段只写一句'],
  ['周期 / 周投入', '起 ___ 止 ___ · 每周 ___ 小时'],
  ['任务状态', '待办 / 进行中 / 完成 / 搁置'],
  ['短期里程碑', '三条能打勾的小目标'],
];

function CardPreview({ kind }: { kind: Kind }) {
  const fields = kind === 'short' ? SHORT_FIELDS : LONG_FIELDS;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-[11px] text-oncanvas/40">
        <span>卡面预览（1/8 A4 · 105 × 74.25mm）</span>
        <span className="font-mono">{kind === 'short' ? '短期卡' : '长期卡'}</span>
      </div>
      <div
        className="relative w-full border border-dashed border-line/25 bg-surface px-4 py-3 text-ink"
        style={{ aspectRatio: '105 / 74.25' }}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.12em] text-seal">
              {kind === 'short' ? '任务卡' : '目标卡'}
            </p>
            <p className="mt-0.5 text-[9px] text-ink-soft">
              {kind === 'short' ? '短期 · 1/8 A4' : '长期 · OKR'}
            </p>
          </div>
          <div className="flex flex-col items-center">
            <div className="grid grid-cols-4 gap-[1px] bg-ink p-[2px]">
              {Array.from({ length: 16 }).map((_, i) => (
                <span key={i} className={`h-[3px] w-[3px] ${i % 3 ? 'bg-surface' : 'bg-ink'}`} />
              ))}
            </div>
            <span className="mt-0.5 font-mono text-[7px] text-ink-soft">A7K2m9</span>
          </div>
        </div>
        <div className="mt-2 flex h-[76%] flex-col justify-between">
          {fields.map(([name]) => (
            <div key={name} className="flex items-baseline gap-1.5">
              <span className="w-[52px] shrink-0 text-[7.5px] text-ink-soft">{name}</span>
              <span className="h-[1px] flex-1 bg-ink/25" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Print() {
  const [netUrl, setNetUrl] = useState('');
  const [kind, setKind] = useState<Kind>('short');
  const [count, setCount] = useState(8);
  const [doubleSided, setDoubleSided] = useState(true);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    fetch('/ds-api/net')
      .then((r) => r.json())
      .then((b: { url?: string }) => {
        if (b?.url) setNetUrl(b.url);
      })
      .catch(() => {});
  }, []);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  async function generate() {
    setBusy(true);
    setFlash(null);
    try {
      const res = await fetch('/ds-api/cards.blank', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ count, kind, double_sided: doubleSided }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `生成失败 HTTP ${res.status}`);
      }
      const codes = (res.headers.get('x-card-codes') || '').split(',').filter(Boolean);
      if (codes.length) {
        try {
          localStorage.setItem('taskcard:lastBatch', JSON.stringify(codes));
        } catch {
          /* 无痕模式忽略 */
        }
      }
      const url = URL.createObjectURL(await res.blob());
      setPreview(url);
      const win = window.open(url, '_blank');
      setFlash(
        win
          ? `已生成 ${count} 张空白卡，每张的二维码都不同`
          : '浏览器拦了弹窗，点下面「打开 PDF」',
      );
    } catch (e) {
      setFlash(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[980px] flex-col gap-5">
      <header>
        <p className="font-mono text-[11px] tracking-[0.18em] text-oncanvas/40">打印</p>
        <h1 className="mt-1 text-[24px] font-semibold tracking-tight">打印一叠空白卡</h1>
        <p className="mt-1 max-w-[640px] text-[12px] leading-relaxed text-oncanvas/45">
          只印空白表：每张带一个唯一二维码，是这张纸的身份证。写完拍照，先扫码认出是哪张卡，
          再读上面的手写内容——任务改名、换数据库，这张纸也不会失效。
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <p className="text-[11px] leading-relaxed text-oncanvas/40">
            二维码会自动指向本机局域网地址{' '}
            <span className="font-mono text-oncanvas/70">{netUrl || '（正在探测…）'}</span>
            ，手机连同一个 Wi-Fi 就能扫开。
          </p>

          <section className="flex flex-col gap-3 border border-line/15 p-3">
            <div className="flex items-center gap-2 text-[12px]">
              <span className="w-[52px] shrink-0 text-oncanvas/45">卡型</span>
              {(['short', 'long'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`border px-3 py-1.5 ${kind === k ? 'border-seal/60 bg-seal/10 text-oncanvas' : 'border-line/20 text-oncanvas/60 hover:border-line/45'}`}
                >
                  {k === 'short' ? '短期卡（任务）' : '长期卡（目标）'}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 text-[12px]">
              <span className="w-[52px] shrink-0 text-oncanvas/45">张数</span>
              {[8, 16, 24].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCount(n)}
                  className={`border px-3 py-1.5 font-mono ${count === n ? 'border-seal/60 bg-seal/10 text-oncanvas' : 'border-line/20 text-oncanvas/60 hover:border-line/45'}`}
                >
                  {n}
                </button>
              ))}
              <span className="ml-2 text-[11px] text-oncanvas/35">一页 8 张</span>
            </div>

            <label className="flex items-center gap-2 text-[12px] text-oncanvas/70">
              <input
                type="checkbox"
                checked={doubleSided}
                onChange={(e) => setDoubleSided(e.target.checked)}
                className="accent-seal"
              />
              双面打印（正面卡片 + 背面复盘卡）
            </label>

            <p className="text-[11px] leading-relaxed text-oncanvas/35">
              每张空白卡先在库里建一条「占位」记录（不在看板显示）。拍到哪张，内容就写回哪条，
              保存后它才出现在看板上。
            </p>

            <button
              type="button"
              onClick={generate}
              disabled={busy}
              className="mt-1 self-start bg-seal px-5 py-2.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy ? '排版中…' : `生成空白卡（${count} 张）`}
            </button>

            {flash && <p className="text-[12px] leading-relaxed text-oncanvas/60">{flash}</p>}
            {preview && (
              <a
                href={preview}
                target="_blank"
                rel="noreferrer"
                className="self-start border border-line/25 px-3 py-1.5 text-[12px] text-oncanvas/75 hover:border-line/50"
              >
                打开 PDF
              </a>
            )}
          </section>
        </div>

        <div className="hidden md:block">
          <CardPreview kind={kind} />
        </div>
      </div>
    </div>
  );
}
