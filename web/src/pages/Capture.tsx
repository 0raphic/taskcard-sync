import { useRef, useState } from 'react';
import { createTask } from '../lib/data';
import { pb } from '../lib/pb';
import { navigate } from '../lib/router';
import { STATUS_LABEL, type Kind, type Status } from '../lib/types';

type Draft = {
  title: string;
  kind: Kind;
  status: Status;
  due: string;
  estimate_min: number | '';
  description: string;
  materials: string;
  notes: string;
  goal: string;
};

const EMPTY: Draft = {
  title: '',
  kind: 'short',
  status: 'todo',
  due: '',
  estimate_min: '',
  description: '',
  materials: '',
  notes: '',
  goal: '',
};

// 模型返回 estimate_min:number；本地兜底返回 estimate:"40 分"，这里统一成分钟数
function normalize(t: (Partial<Draft> & { estimate?: string }) | undefined): Draft {
  const next: Draft = { ...EMPTY, ...t };
  if (typeof next.estimate_min === 'string') {
    const m = String(next.estimate_min).match(/(\d+(?:\.\d+)?)/);
    next.estimate_min = m ? Math.round(Number(m[1])) : '';
  }
  if (t?.estimate) {
    const m = String(t.estimate).match(/(\d+(?:\.\d+)?)/);
    if (m) next.estimate_min = Math.round(Number(m[1]));
  }
  return next;
}

export function Capture() {
  const [text, setText] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [raw, setRaw] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function structure() {
    if (!text.trim()) return;
    setBusy(true);
    setFlash(null);
    setRaw(null);
    try {
      const res = await fetch('/ds-api/structure', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        task?: Partial<Draft> & { estimate?: string };
        fallback?: boolean;
        error?: string;
      };
      if (!res.ok || !body.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setDraft(normalize(body.task));
      if (body.fallback) setFlash('没配 DeepSeek Key，用本地规则拆的，核对一下即可');
    } catch (e) {
      setFlash(`解析失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function fromImage(file: File) {
    setBusy(true);
    setFlash(null);
    setRaw(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const res = await fetch('/ds-api/ocr', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ image: dataUrl }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        text?: string;
        task?: Partial<Draft>;
        error?: string;
      };
      if (!res.ok || !body.ok) throw new Error(body.error || `HTTP ${res.status}`);
      if (body.text) {
        setText(body.text);
        setRaw(body.text);
      }
      if (body.task) setDraft({ ...EMPTY, ...body.task });
      setFlash('识别完成，核对一下再保存');
    } catch (e) {
      setFlash(`识别失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function save() {
    if (!draft || !draft.title.trim()) {
      setFlash('至少要有标题');
      return;
    }
    setBusy(true);
    setFlash(null);
    try {
      const task = await createTask({
        title: draft.title.trim(),
        kind: draft.kind,
        status: draft.status,
        due: draft.due || undefined,
        estimate_min: draft.estimate_min === '' ? 0 : Number(draft.estimate_min),
        description: draft.description || undefined,
        materials: draft.materials || undefined,
        notes: draft.notes || undefined,
        goal: draft.goal || undefined,
      });

      const code = shortCode();
      await pb.collection('short_links').create({ code, task: task.id, active: true, scans: 0 });
      setFlash(`已创建 · 短码 ${code}`);
      navigate(`/tasks/${task.id}`);
    } catch (e) {
      setFlash(`保存失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5">
      <header>
        <p className="font-mono text-[11px] tracking-[0.18em] text-paper/40">录入</p>
        <h1 className="mt-1 text-[24px] font-semibold tracking-tight">把纸卡上的内容丢进来</h1>
        <p className="mt-1 text-[12px] leading-relaxed text-paper/45">
          粘一段文字，DeepSeek 会拆成结构化字段；没配 Key 就用本地规则拆（标题、截止、用时、材料、备注都认）。
        </p>
      </header>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        placeholder={'例：\n打印 8 张任务卡样张\n截止 11-07 用时 40 分\n材料：打印店、U盘\n先试印一张'}
        className="w-full resize-y border border-paper/20 bg-transparent px-3 py-2.5 text-[13px] leading-relaxed text-paper placeholder:text-paper/25 focus:border-paper/40"
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={structure}
          disabled={busy || !text.trim()}
          className="bg-seal px-4 py-2.5 text-[13px] font-medium text-white transition-colors hover:brightness-110 disabled:opacity-40"
        >
          {busy ? '解析中…' : '解析成任务'}
        </button>

        <label className="cursor-pointer border border-paper/20 px-3 py-2.5 text-[12px] text-paper/70 hover:border-paper/40">
          上传照片识别
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void fromImage(f);
            }}
          />
        </label>

        {flash && <span className="text-[12px] text-paper/50">{flash}</span>}
      </div>

      {raw && (
        <details className="border border-paper/15 px-3 py-2 text-[12px] text-paper/60">
          <summary className="cursor-pointer select-none text-paper/45">OCR 原文</summary>
          <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] leading-relaxed">{raw}</pre>
        </details>
      )}

      {draft && (
        <section className="flex flex-col gap-3 border-t border-white/10 pt-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] tracking-[0.18em] text-paper/45">核对</h2>
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="text-[11px] text-paper/35 hover:text-paper/60"
            >
              清空
            </button>
          </div>

          <Field label="标题">
            <input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              className="w-full border border-paper/20 bg-transparent px-3 py-2 text-[14px] text-paper focus:border-paper/40"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="类型">
              <select
                value={draft.kind}
                onChange={(e) => setDraft({ ...draft, kind: e.target.value as Kind })}
                className="w-full border border-paper/20 bg-mat px-2 py-2 text-[13px] text-paper"
              >
                <option value="short">短期</option>
                <option value="long">长期</option>
              </select>
            </Field>
            <Field label="状态">
              <select
                value={draft.status}
                onChange={(e) => setDraft({ ...draft, status: e.target.value as Status })}
                className="w-full border border-paper/20 bg-mat px-2 py-2 text-[13px] text-paper"
              >
                {Object.entries(STATUS_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="截止 MM-DD">
              <input
                value={draft.due}
                onChange={(e) => setDraft({ ...draft, due: e.target.value })}
                className="w-full border border-paper/20 bg-transparent px-2 py-2 font-mono text-[13px] text-paper"
              />
            </Field>
            <Field label="用时（分）">
              <input
                value={draft.estimate_min}
                inputMode="numeric"
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    estimate_min: e.target.value === '' ? '' : Number(e.target.value.replace(/\D/g, '')),
                  })
                }
                className="w-full border border-paper/20 bg-transparent px-2 py-2 font-mono text-[13px] text-paper"
              />
            </Field>
          </div>

          <Field label="描述">
            <textarea
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              rows={2}
              className="w-full resize-y border border-paper/20 bg-transparent px-3 py-2 text-[13px] leading-relaxed text-paper focus:border-paper/40"
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="材料">
              <input
                value={draft.materials}
                onChange={(e) => setDraft({ ...draft, materials: e.target.value })}
                className="w-full border border-paper/20 bg-transparent px-3 py-2 text-[13px] text-paper"
              />
            </Field>
            <Field label="备注">
              <input
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                className="w-full border border-paper/20 bg-transparent px-3 py-2 text-[13px] text-paper"
              />
            </Field>
          </div>

          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="mt-1 self-start bg-seal px-5 py-2.5 text-[13px] font-medium text-paper hover:bg-seal/90 disabled:opacity-50"
          >
            保存并生成短码
          </button>
        </section>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] tracking-[0.16em] text-paper/40">{label}</span>
      {children}
    </label>
  );
}

/** 6 位 base62，去掉容易看错的 0/O/1/l/I */
const ALPHABET = '23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
function shortCode(): string {
  let out = '';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}
