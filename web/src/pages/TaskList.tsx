import { useMemo, useState } from 'react';
import { TaskCard } from '../components/TaskCard';
import { useTasks } from '../lib/data';
import { Link } from '../lib/router';
import { STATUSES, STATUS_LABEL, type Status } from '../lib/types';

type Filter = 'all' | Status | 'long';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: '全部' },
  ...STATUSES.map((s) => ({ key: s as Filter, label: STATUS_LABEL[s] })),
  { key: 'long', label: '长期' },
];

export function TaskList() {
  const { tasks, error } = useTasks();
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');

  const shown = useMemo(() => {
    const list = (tasks ?? []).filter((t) => !t.draft);
    const needle = q.trim().toLowerCase();
    return list
      .filter((t) => {
        if (filter === 'long') return t.kind === 'long';
        if (filter === 'all') return true;
        return t.status === filter;
      })
      .filter((t) =>
        needle
          ? [t.title, t.description, t.notes, t.materials]
              .filter(Boolean)
              .some((v) => String(v).toLowerCase().includes(needle))
          : true,
      )
      .sort((a, b) => (a.created ?? '').localeCompare(b.created ?? ''));
  }, [tasks, filter, q]);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] tracking-[0.18em] text-paper/40">全部任务</p>
          <h1 className="mt-1 text-[24px] font-semibold tracking-tight">
            {tasks ? `${shown.length} / ${(tasks ?? []).filter((t) => !t.draft).length} 张` : '读取中…'}
          </h1>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜标题、描述、备注"
          className="w-full max-w-[260px] border border-paper/20 bg-transparent px-3 py-2 text-[13px] text-paper placeholder:text-paper/25 focus:border-paper/40"
        />
      </header>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`border px-2.5 py-1 text-[12px] transition-colors ${
              filter === f.key
                ? 'border-seal bg-seal/15 text-paper'
                : 'border-paper/15 text-paper/55 hover:border-paper/35'
            }`}
          >
            {f.label}
          </button>
        ))}
        </div>
        <Link
          to="/print"
          className="shrink-0 border border-paper/20 px-3 py-1.5 text-[12px] text-paper/65 hover:border-paper/45"
        >
          打印空白卡 →
        </Link>
      </div>

      {error && <p className="text-[12px] text-seal">连不上后端：{error}</p>}

      {!tasks && !error && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-[132px] animate-pulse bg-paper/10" />
          ))}
        </div>
      )}

      {shown.length === 0 && tasks && (
        <p className="py-16 text-center text-[13px] text-paper/35">这个筛选下没有卡。</p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {shown.map((t) => (
          <TaskCard key={t.id} task={t} />
        ))}
      </div>
    </div>
  );
}
