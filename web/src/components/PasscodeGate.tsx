import { useEffect, useState } from 'react';
import { onNeedPasscode, setWriteToken } from '../lib/write';

/** 服务端开了写操作口令时，任意写请求 401 会触发这个弹层。输一次，这台设备记住。 */
export function PasscodeGate() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');

  useEffect(() => onNeedPasscode(() => setOpen(true)), []);

  if (!open) return null;

  function save() {
    const v = value.trim();
    if (!v) return;
    setWriteToken(v);
    setOpen(false);
    setValue('');
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 px-4">
      <div className="w-full max-w-[360px] border border-line/25 bg-canvas p-4">
        <p className="text-[14px] font-semibold text-oncanvas/90">需要口令</p>
        <p className="mt-1 text-[11px] leading-relaxed text-oncanvas/45">
          这台设备还没有写权限。输入设置页里开的 4–12 位数字口令，记住一次就行。
        </p>
        <input
          autoFocus
          type="password"
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/\D/g, '').slice(0, 12))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
          }}
          placeholder="口令"
          className="mt-3 w-full border border-line/25 bg-transparent px-3 py-2 text-[13px] tracking-[0.3em] text-oncanvas/85 outline-none focus:border-seal/60"
        />
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={save}
            className="flex-1 bg-seal px-3 py-2 text-[12px] font-medium text-white hover:opacity-90"
          >
            保存口令
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setValue('');
            }}
            className="border border-line/25 px-3 py-2 text-[12px] text-oncanvas/60"
          >
            取消
          </button>
        </div>
        <p className="mt-2 text-[10px] text-oncanvas/30">保存后，把刚才那一步再点一次即可。</p>
      </div>
    </div>
  );
}
