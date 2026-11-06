import { STATUS_LABEL, type Status } from '../lib/types';

const TONE: Record<Status, string> = {
  todo: 'border-ink/25 text-ink-soft',
  doing: 'border-amber/60 text-amber bg-amber/5',
  done: 'border-moss/60 text-moss bg-moss/5',
  paused: 'border-ink/20 text-ink-soft/70 bg-ink/5',
};

export function StatusPill({ status, className = '' }: { status: Status; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 border px-1.5 py-0.5 text-[10px] leading-none tracking-[0.08em] ${TONE[status]} ${className}`}
    >
      <span aria-hidden className="text-[8px]">
        {status === 'done' ? '✓' : status === 'doing' ? '▶' : '·'}
      </span>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function ProgressBar({ value = 0, className = '' }: { value?: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      className={`h-2 w-full border border-ink/25 bg-paper-dim ${className}`}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full bg-seal/85 transition-[width] duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
