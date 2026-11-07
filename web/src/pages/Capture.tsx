import { useEffect, useRef, useState } from 'react';
import { createTask } from '../lib/data';
import { canUseInPageCamera, fileToJpegDataUrl } from '../lib/image';
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
  const fileRef2 = useRef<HTMLInputElement>(null);
  const [shotOpen, setShotOpen] = useState(false);
  const [scanned, setScanned] = useState<{ code: string; id: string; title: string } | null>(null);
  const [queue, setQueue] = useState<File[]>([]);
  const inPageCam = canUseInPageCamera();

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

  function fromFiles(files: FileList | null) {
    const list = Array.from(files ?? []);
    if (list.length === 0) return;
    setQueue(list.slice(1));
    void fromImage(list[0]);
  }

  function nextOne() {
    const [next, ...rest] = queue;
    if (!next) return;
    setQueue(rest);
    void fromImage(next);
  }

  async function fromImage(file: File | Blob) {
    setBusy(true);
    setFlash('照片处理中…');
    setRaw(null);
    setScanned(null);
    try {
      const dataUrl = await fileToJpegDataUrl(file);

      // 第一步永远是扫二维码：它决定这是「哪一张卡」，而不是一张新卡
      setFlash('先扫右上角的二维码…');
      const scanRes = await fetch('/ds-api/scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ image: dataUrl }),
      });
      const scanBody = (await scanRes.json().catch(() => ({}))) as {
        ok?: boolean;
        code?: string;
        card?: { id: string; title: string; draft?: boolean };
        fields?: Partial<Draft>;
        error?: string;
      };
      if (scanRes.ok && scanBody.ok && scanBody.card && scanBody.code) {
        setDraft({ ...normalize(scanBody.fields), status: 'todo' });
        setScanned({ code: scanBody.code, id: scanBody.card.id, title: scanBody.card.title });
        setFlash(`认出卡片：短码 ${scanBody.code}，核对卡面上的字，保存就写回这张卡`);
        return;
      }

      // 扫不到码（没拍全 / 不是我们的卡）时退回「当新卡识别」，别让用户卡住
      setFlash(`没认出卡片：${scanBody.error || `HTTP ${scanRes.status}`}，按新卡识别…`);
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
      if (fileRef2.current) fileRef2.current.value = '';
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
      const payload = {
        title: draft.title.trim(),
        kind: draft.kind,
        status: draft.status,
        due: draft.due || '',
        estimate_min: draft.estimate_min === '' ? 0 : Number(draft.estimate_min),
        description: draft.description || '',
        materials: draft.materials || '',
        notes: draft.notes || '',
        goal: draft.goal || '',
      };

      if (scanned) {
        // 扫到的卡：把卡面内容写回这条记录，并把它从「空白卡」变成真实任务
        await pb.collection('tasks').update(scanned.id, { ...payload, draft: false });
        setFlash(`已写回短码 ${scanned.code} 的那张卡`);
        if (queue.length > 0) {
          setQueue((q) => q.slice(1));
          void fromImage(queue[0]);
          return;
        }
        navigate(`/tasks/${scanned.id}`);
        return;
      }

      const task = await createTask({
        ...payload,
        due: payload.due || undefined,
        description: payload.description || undefined,
        materials: payload.materials || undefined,
        notes: payload.notes || undefined,
        goal: payload.goal || undefined,
      });

      const code = shortCode();
      await pb.collection('short_links').create({ code, task: task.id, active: true, scans: 0 });
      setFlash(`已创建 · 短码 ${code}`);
      if (queue.length > 0) {
        setQueue((q) => q.slice(1));
        void fromImage(queue[0]);
        return;
      }
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
        <p className="font-mono text-[11px] tracking-[0.18em] text-oncanvas/40">录入</p>
        <h1 className="mt-1 text-[24px] font-semibold tracking-tight">把纸卡上的内容丢进来</h1>
        <p className="mt-1 text-[12px] leading-relaxed text-oncanvas/45">
          粘一段文字，DeepSeek 会拆成结构化字段；没配 Key 就用本地规则拆（标题、截止、用时、材料、备注都认）。
        </p>
      </header>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        placeholder={'例：\n打印 8 张任务卡样张\n截止 11-07 用时 40 分\n材料：打印店、U盘\n先试印一张'}
        className="w-full resize-y border border-line/20 bg-transparent px-3 py-2.5 text-[13px] leading-relaxed text-oncanvas placeholder:text-oncanvas/25 focus:border-line/40"
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

        <label className="cursor-pointer border border-line/20 px-3 py-2.5 text-[12px] text-oncanvas/70 hover:border-line/40">
          拍照识别
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

        <label className="cursor-pointer border border-line/20 px-3 py-2.5 text-[12px] text-oncanvas/70 hover:border-line/40">
          从相册
          <input
            ref={fileRef2}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => fromFiles(e.target.files)}
          />
        </label>

        {queue.length > 0 && (
          <span className="flex items-center gap-2 border border-amber/35 bg-amber/10 px-3 py-2 text-[11px] text-oncanvas/75">
            还有 {queue.length} 张没处理
            <button
              type="button"
              onClick={nextOne}
              disabled={busy}
              className="border border-oncanvas/25 px-2 py-0.5 text-[11px] hover:border-oncanvas/50 disabled:opacity-40"
            >
              处理下一张
            </button>
          </span>
        )}

        {inPageCam && (
          <button
            type="button"
            onClick={() => setShotOpen(true)}
            className="border border-line/20 px-3 py-2.5 text-[12px] text-oncanvas/70 hover:border-line/40"
          >
            页内拍照
          </button>
        )}

        {flash && <span className="text-[12px] text-oncanvas/50">{flash}</span>}
      </div>

      {shotOpen && (
        <CameraShot
          onClose={() => setShotOpen(false)}
          onShot={(blob) => {
            setShotOpen(false);
            void fromImage(blob);
          }}
        />
      )}

      {raw && (
        <details className="border border-line/15 px-3 py-2 text-[12px] text-oncanvas/60">
          <summary className="cursor-pointer select-none text-oncanvas/45">OCR 原文</summary>
          <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] leading-relaxed">{raw}</pre>
        </details>
      )}

      {draft && (
        <section className="flex flex-col gap-3 border-t border-line pt-5">
          {scanned && (
            <div className="flex flex-wrap items-center gap-2 border border-moss/40 bg-moss/10 px-3 py-2 text-[12px] text-oncanvas/80">
              <span className="text-moss">认出卡片</span>
              <span className="font-mono text-oncanvas">{scanned.code}</span>
              <span className="text-oncanvas/45">·</span>
              <span>{scanned.title}</span>
              <span className="ml-auto text-[11px] text-oncanvas/45">保存会把内容写回这张卡</span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <h2 className="text-[11px] tracking-[0.18em] text-oncanvas/45">核对</h2>
            <button
              type="button"
              onClick={() => {
                setDraft(null);
                setScanned(null);
              }}
              className="text-[11px] text-oncanvas/35 hover:text-oncanvas/60"
            >
              清空
            </button>
          </div>

          <Field label="标题">
            <input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              className="w-full border border-line/20 bg-transparent px-3 py-2 text-[14px] text-oncanvas focus:border-line/40"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="类型">
              <select
                value={draft.kind}
                onChange={(e) => setDraft({ ...draft, kind: e.target.value as Kind })}
                className="w-full border border-line/20 bg-canvas px-2 py-2 text-[13px] text-oncanvas"
              >
                <option value="short">短期</option>
                <option value="long">长期</option>
              </select>
            </Field>
            <Field label="状态">
              <select
                value={draft.status}
                onChange={(e) => setDraft({ ...draft, status: e.target.value as Status })}
                className="w-full border border-line/20 bg-canvas px-2 py-2 text-[13px] text-oncanvas"
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
                className="w-full border border-line/20 bg-transparent px-2 py-2 font-mono text-[13px] text-oncanvas"
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
                className="w-full border border-line/20 bg-transparent px-2 py-2 font-mono text-[13px] text-oncanvas"
              />
            </Field>
          </div>

          <Field label="描述">
            <textarea
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              rows={2}
              className="w-full resize-y border border-line/20 bg-transparent px-3 py-2 text-[13px] leading-relaxed text-oncanvas focus:border-line/40"
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="材料">
              <input
                value={draft.materials}
                onChange={(e) => setDraft({ ...draft, materials: e.target.value })}
                className="w-full border border-line/20 bg-transparent px-3 py-2 text-[13px] text-oncanvas"
              />
            </Field>
            <Field label="备注">
              <input
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                className="w-full border border-line/20 bg-transparent px-3 py-2 text-[13px] text-oncanvas"
              />
            </Field>
          </div>

          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="mt-1 self-start bg-seal px-5 py-2.5 text-[13px] font-medium text-white hover:bg-seal/90 disabled:opacity-50"
          >
            {scanned ? '保存并写回这张卡' : '保存并生成短码'}
          </button>
        </section>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] tracking-[0.16em] text-oncanvas/40">{label}</span>
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

/** 只在 https / localhost 下出现：局域网 http 调不了 getUserMedia，所以主路径仍是 input[capture] */
function CameraShot({
  onClose,
  onShot,
}: {
  onClose: () => void;
  onShot: (blob: Blob) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then((stream) => {
        if (!alive) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      })
      .catch(() => setError('这个浏览器不给用摄像头，退回「拍照识别」试试'));
    return () => {
      alive = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function shoot() {
    const v = videoRef.current;
    if (!v) return;
    const scale = Math.min(1, 1600 / Math.max(v.videoWidth || 1, v.videoHeight || 1));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(v.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(v.videoHeight * scale));
    canvas.getContext('2d')?.drawImage(v, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
    if (blob) onShot(blob);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/85 p-4 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-3">
        <div className="flex items-center justify-between text-[12px] text-oncanvas/60">
          <span>对准纸卡</span>
          <button type="button" onClick={onClose} className="border border-line/25 px-3 py-1.5">
            取消
          </button>
        </div>
        {error ? (
          <p className="text-[13px] text-amber">{error}</p>
        ) : (
          <video ref={videoRef} playsInline muted className="min-h-0 flex-1 bg-black object-contain" />
        )}
        {!error && (
          <button
            type="button"
            onClick={shoot}
            className="mx-auto mb-2 h-14 w-14 rounded-full border-4 border-white/70 bg-white/20"
            aria-label="拍下这张卡"
          />
        )}
      </div>
    </div>
  );
}
