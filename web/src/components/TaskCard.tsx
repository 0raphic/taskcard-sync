import { Link } from '../lib/router';
import { isOverdue, isToday, type Task } from '../lib/types';
import { ProgressBar, StatusPill } from './StatusPill';

export function TaskCard({ task }: { task: Task }) {
  const overdue = isOverdue(task);
  const today = isToday(task);

  return (
    <article className="group relative flex flex-col gap-2.5 bg-surface px-4 pb-4 pt-3.5 text-ink trim paper-lift transition-transform duration-200 hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-2">
        <span className="flex items-center gap-1.5 pt-0.5 text-[10px] tracking-[0.22em] text-ink-soft">
          {task.kind === 'short' ? '短期任务' : '长期任务'}
          {overdue && <span className="tracking-normal text-seal">· 逾期</span>}
          {today && !overdue && <span className="tracking-normal text-amber">· 今天</span>}
        </span>
        <StatusPill status={task.status} />
      </div>

      <Link
        to={`/tasks/${task.id}`}
        className="text-[15px] font-semibold leading-snug decoration-seal/50 underline-offset-4 group-hover:underline"
      >
        {task.title}
      </Link>

      {task.description && (
        <p className="line-clamp-2 text-[12px] leading-relaxed text-ink-soft">{task.description}</p>
      )}

      <div className="mt-auto flex flex-col gap-2 pt-1">
        {task.kind === 'short' ? (
          <div className="flex items-center gap-3 border-t border-ink/10 pt-2 text-[11px] text-ink-soft">
            <span>
              截止 <span className="font-mono text-ink">{task.due || '—'}</span>
            </span>
            <span className="text-ink/15">|</span>
            <span>
              用时 <span className="font-mono text-ink">{task.estimate_min ?? '—'}</span> 分
            </span>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-[11px] text-ink-soft">
              <span className="font-mono">
                {task.start || '—'} → {task.due || '—'}
              </span>
              <span className="font-mono text-ink">{task.progress ?? 0}%</span>
            </div>
            <ProgressBar value={task.progress} />
          </>
        )}
      </div>
    </article>
  );
}
