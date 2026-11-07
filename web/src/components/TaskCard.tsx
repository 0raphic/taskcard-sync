import { Link } from '../lib/router';
import { checkStats, isOverdue, isToday, parseTags, type Task } from '../lib/types';
import { ProgressBar, StatusPill } from './StatusPill';

export function TaskCard({ task }: { task: Task }) {
  const overdue = isOverdue(task);
  const today = isToday(task);
  const tags = parseTags(task);
  const check = checkStats(task);

  return (
    <article className="group relative flex flex-col gap-2.5 border border-ink/20 bg-surface px-4 pb-3.5 pt-3 text-ink transition-colors hover:border-ink">
      <div className="flex items-start justify-between gap-2">
        <span className="flex items-center gap-1.5 pt-0.5 text-[9px] font-medium tracking-[0.22em] text-ink-soft">
          {task.kind === 'short' ? '短期 / SHORT' : '长期 / LONG'}
          {overdue && <span className="tracking-normal text-seal">· 逾期</span>}
          {today && !overdue && <span className="tracking-normal text-amber">· 今天</span>}
        </span>
        <StatusPill status={task.status} />
      </div>

      <Link
        to={`/tasks/${task.id}`}
        className="text-[15px] font-semibold leading-snug decoration-seal/60 underline-offset-4 group-hover:underline"
      >
        {task.title}
      </Link>

      {task.description && (
        <p className="line-clamp-2 text-[12px] leading-relaxed text-ink-soft">{task.description}</p>
      )}

      {(check.total > 0 || tags.length > 0) && (
        <div className="flex flex-col gap-1.5">
          {check.total > 0 && (
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-ink-soft">
                清单 {check.done}/{check.total}
              </span>
              <span className="h-[3px] flex-1 bg-ink/10">
                <span
                  className="block h-full bg-ink"
                  style={{ width: `${Math.round((check.done / check.total) * 100)}%` }}
                />
              </span>
            </div>
          )}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="border border-ink/20 px-1.5 py-[1px] text-[9px] tracking-[0.08em] text-ink-soft"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-auto flex flex-col gap-2 pt-1">
        {task.kind === 'short' ? (
          <div className="flex items-center gap-3 border-t border-ink/15 pt-2 text-[10px] text-ink-soft">
            <span>
              截止{' '}
              <span className={`font-mono ${overdue ? 'text-seal' : 'text-ink'}`}>
                {task.due || '—'}
              </span>
            </span>
            <span className="text-ink/15">/</span>
            <span>
              用时 <span className="font-mono text-ink">{task.estimate_min ?? '—'}</span> 分
            </span>
            {task.priority && <span className="ml-auto text-[9px]">#{task.priority}</span>}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-[10px] text-ink-soft">
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
