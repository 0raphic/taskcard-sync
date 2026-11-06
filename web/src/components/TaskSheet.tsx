import type { Task } from '../lib/types';
import { ProgressBar, StatusPill } from './StatusPill';

export function TaskSheet({ task, code, scans }: { task: Task; code?: string; scans?: number }) {
  return (
    <article className="relative bg-paper px-6 pb-6 pt-5 text-ink trim paper-lift">
      <div className="flex items-start justify-between gap-3">
        <span className="pt-1 text-[10px] tracking-[0.22em] text-ink-soft">
          {task.kind === 'short' ? '短期任务' : '长期任务'}
        </span>
        {task.status === 'done' ? (
          <span aria-hidden className="stamp shrink-0">
            完成
          </span>
        ) : (
          <StatusPill status={task.status} />
        )}
      </div>

      <h1 className="mt-3 text-[24px] font-semibold leading-snug tracking-tight">{task.title}</h1>

      {task.description && (
        <p className="mt-3 text-[12.5px] leading-relaxed text-ink-soft">{task.description}</p>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-ink/10 pt-3 text-[12px]">
        {task.kind === 'short' ? (
          <>
            <Row label="截止" value={task.due || '—'} mono />
            <Row label="用时" value={`${task.estimate_min ?? '—'} 分`} mono />
          </>
        ) : (
          <>
            <Row label="开始" value={task.start || '—'} mono />
            <Row label="截止" value={task.due || '—'} mono />
          </>
        )}
      </dl>

      {task.kind === 'long' && (
        <div className="mt-4 flex flex-col gap-1.5">
          <div className="flex justify-between text-[11px] text-ink-soft">
            <span>进度</span>
            <span className="font-mono text-ink">{task.progress ?? 0}%</span>
          </div>
          <ProgressBar value={task.progress} />
        </div>
      )}

      {task.milestones && task.milestones.length > 0 && (
        <div className="mt-4 flex flex-col gap-1.5">
          <span className="text-[10px] tracking-[0.16em] text-ink-soft/70">里程碑</span>
          <ul className="flex flex-col gap-1">
            {task.milestones.map((m, i) => (
              <li key={`${m}-${i}`} className="flex items-start gap-2 text-[12px] text-ink-soft">
                <span aria-hidden className="mt-1 h-[7px] w-[7px] shrink-0 border border-ink/45" />
                {m}
              </li>
            ))}
          </ul>
        </div>
      )}

      {task.goal && <Block label="目标" text={task.goal} />}
      {task.materials && <Block label="材料" text={task.materials} />}
      {task.notes && <Block label="备注" text={task.notes} />}

      {code && (
        <div className="mt-4 flex items-center justify-between border-t border-ink/10 pt-2 font-mono text-[10px] text-ink-soft/70">
          <span>{code}</span>
          <span>{scans ? `被扫 ${scans} 次` : ''}</span>
        </div>
      )}
    </article>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[10px] tracking-[0.16em] text-ink-soft/70">{label}</dt>
      <dd className={`text-[13px] ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  );
}

function Block({ label, text }: { label: string; text: string }) {
  return (
    <div className="mt-3 flex flex-col gap-1">
      <span className="text-[10px] tracking-[0.16em] text-ink-soft/70">{label}</span>
      <p className="text-[12px] leading-relaxed text-ink-soft">{text}</p>
    </div>
  );
}
