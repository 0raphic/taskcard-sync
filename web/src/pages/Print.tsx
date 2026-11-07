import { useEffect, useState } from 'react';

type Kind = 'short' | 'long';

const SHORT_FIELDS = [
  ['任务', '一句话说清要交付什么'],
  ['优先级', '重要且紧急 / 重要不紧急 / 紧急不重要 / 其他'],
  ['完成标准', '做到什么程度算完'],
  ['下一步', '下一个具体动作'],
  ['截止 · 时间盒', '____  ·  ____ 分'],
  ['情境', '电脑 / 电话 / 外出 / 家里 / 随时'],
  ['材料', '要不要借、要不要买'],
  ['复盘', '实际 ___ 分 · 一句体会'],
];

const LONG_FIELDS = [
  ['O 目标', '一个季度只写一句'],
  ['KR 关键结果', 'K1 / K2 / K3，写到能打勾'],
  ['周期', '起 ___ 止 ___ · 每周 ___ 小时'],
  ['里程碑', '三个可勾选的小目标'],
  ['进度', '十个格子，做一格涂一格'],
  ['资源', '要谁配合、要什么'],
  ['本周', '推进 / 卡点 / 下一步'],
];

function hintNoLan(url: string) {
  try {
    const host = new URL(url).hostname;
    return host === '127.0.0.1' || host === 'localhost' || host === '::1';
  } catch {
    return true;
  }
}

function CardPreview({ kind }: { kind: Kind }) {
  const fields = kind === 'short' ? SHORT_FIELDS : LONG_FIELDS;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-[11px] text-paper/40">
        <span>卡面预览（1/8 A4 · 105 × 74.25mm）</span>
        <span className="font-mono">{kind === 'short' ? '短期卡' : '长期卡'}</span>
      </div>
      <div
        className="relative w-full border border-dashed border-paper/25 bg-paper px-4 py-3 text-ink"
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
                <span key={i} className={`h-[3px] w-[3px] ${i % 3 ? 'bg-paper' : 'bg-ink'}`} />
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
  const [baseUrl, setBaseUrl] = useState('');
  const [netHint, setNetHint] = useState<{ url: string; lan: boolean } | null>(null);
  const [kind, setKind] = useState<Kind>('short');
  const [count, setCount] = useState(8);
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

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const noLan = baseUrl ? hintNoLan(baseUrl) : false;

  async function generate() {
    setBusy(true);
    setFlash(null);
    try {
      const res = await fetch('/ds-api/cards.blank', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ count, kind, base_url: baseUrl, double_sided: doubleSided }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `生成失败 HTTP ${res.status}`);
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
        <p className="font-mono text-[11px] tracking-[0.18em] text-paper/40">打印</p>
        <h1 className="mt-1 text-[24px] font-semibold tracking-tight">打印一叠空白卡</h1>
        <p className="mt-1 max-w-[640px] text-[12px] leading-relaxed text-paper/45">
          只印空白表：每张带一个唯一二维码，是这张纸的身份证。写完拍照，先扫码认出是哪张卡，
          再读上面的手写内容——任务改名、换数据库，这张纸也不会失效。
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-2 border border-paper/15 p-3">
            <label className="text-[11px] tracking-[0.14em] text-paper/45">二维码指向（手机要能打开）</label>
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

          <section className="flex flex-col gap-3 border border-paper/15 p-3">
            <div className="flex items-center gap-2 text-[12px]">
              <span className="w-[52px] shrink-0 text-paper/45">卡型</span>
              {(['short', 'long'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`border px-3 py-1.5 ${kind === k ? 'border-seal/60 bg-seal/10 text-paper' : 'border-paper/20 text-paper/60 hover:border-paper/45'}`}
                >
                  {k === 'short' ? '短期卡（任务）' : '长期卡（目标）'}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 text-[12px]">
              <span className="w-[52px] shrink-0 text-paper/45">张数</span>
              {[8, 16, 24].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCount(n)}
                  className={`border px-3 py-1.5 font-mono ${count === n ? 'border-seal/60 bg-seal/10 text-paper' : 'border-paper/20 text-paper/60 hover:border-paper/45'}`}
                >
                  {n}
                </button>
              ))}
              <span className="ml-2 text-[11px] text-paper/35">一页 8 张</span>
            </div>

            <label className="flex items-center gap-2 text-[12px] text-paper/70">
              <input
                type="checkbox"
                checked={doubleSided}
                onChange={(e) => setDoubleSided(e.target.checked)}
                className="accent-seal"
              />
              双面打印（正面卡片 + 背面复盘卡）
            </label>

            <p className="text-[11px] leading-relaxed text-paper/35">
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

            {flash && <p className="text-[12px] leading-relaxed text-paper/60">{flash}</p>}
            {preview && (
              <a
                href={preview}
                target="_blank"
                rel="noreferrer"
                className="self-start border border-paper/25 px-3 py-1.5 text-[12px] text-paper/75 hover:border-paper/50"
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
