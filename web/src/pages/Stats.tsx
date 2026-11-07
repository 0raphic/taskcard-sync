import { useMemo } from 'react';
import { useTasks } from '../lib/data';
import { fmtDateTime } from '../lib/time';
import { parseTags, isOverdue, isDone } from '../lib/types';

const DAY = 86400000;

function ymd(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
}

function todayYmd() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
}

export function Stats() {
  const { tasks } = useTasks();
  const list = useMemo(() => (tasks ?? []).filter((t) => !t.draft), [tasks]);

  const now = Date.now();
  const doneList = list.filter((t) => isDone(t));
  const doneWeek = doneList.filter((t) => t.completed_at && now - Date.parse(t.completed_at) <= 7 * DAY);
  const createdWeek = list.filter((t) => t.created && now - Date.parse(t.created) <= 7 * DAY);
  const overdue = list.filter((t) => isOverdue(t));

  const doneDays = useMemo(() => {
    const s = new Set<string>();
    for (const t of doneList) {
      const d = ymd(t.completed_at);
      if (d) s.add(d);
    }
    return s;
  }, [doneList]);

  let streak = 0;
  const cursor = new Date();
  for (;;) {
    const key = cursor.toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
    if (doneDays.has(key)) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else if (streak === 0 && key === todayYmd()) {
      // 今天还没收卡，不算断
      cursor.setDate(cursor.getDate() - 1);
    } else break;
  }

  const tagCount = new Map<string, number>();
  for (const t of doneList) {
    for (const tag of parseTags(t)) tagCount.set(tag, (tagCount.get(tag) ?? 0) + 1);
  }
  const tags = [...tagCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const recent = doneList
    .slice()
    .sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''))
    .slice(0, 6);

  return (
    <div className="mx-auto w-full max-w-[1100px] px-5 py-8 md:px-8">
      <p className="micro text-oncanvas/40">统计 / STATS</p>
      <h1 className="mt-2 text-[26px] font-semibold leading-tight tracking-tight md:text-[32px]">
        收卡这件小事，攒起来看
      </h1>

      <div className="mt-6 grid grid-cols-2 gap-px border border-line/20 bg-line/20 md:grid-cols-4">
        {[
          { label: '本周收卡', value: doneWeek.length, unit: '张' },
          { label: '本周新建', value: createdWeek.length, unit: '张' },
          { label: '连续完成', value: streak, unit: '天' },
          { label: '现在逾期', value: overdue.length, unit: '张' },
        ].map((n) => (
          <div key={n.label} className="bg-canvas px-4 py-5">
            <p className="text-[10px] tracking-[0.2em] text-oncanvas/40">{n.label}</p>
            <p className="mt-2 font-mono text-[30px] leading-none text-oncanvas">
              {n.value}
              <span className="ml-1 text-[12px] text-oncanvas/40">{n.unit}</span>
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <section className="border border-line/20 p-4">
          <h2 className="flex items-baseline gap-2 text-[11px] tracking-[0.18em] text-oncanvas/45">
            最近收的卡
            <span className="font-mono text-[10px] tracking-normal text-oncanvas/25">{doneList.length} 张已完成</span>
          </h2>
          {recent.length === 0 && <p className="mt-4 text-[12px] text-oncanvas/35">还没有完成记录。</p>}
          <ul className="mt-3 divide-y divide-line/10">
            {recent.map((t) => (
              <li key={t.id} className="flex items-baseline justify-between gap-3 py-2.5">
                <span className="truncate text-[13px]">{t.title}</span>
                <span className="shrink-0 font-mono text-[10px] text-oncanvas/35">
                  {t.completed_at ? fmtDateTime(t.completed_at) : '—'}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="border border-line/20 p-4">
          <h2 className="text-[11px] tracking-[0.18em] text-oncanvas/45">标签分布（按已完成）</h2>
          {tags.length === 0 && <p className="mt-4 text-[12px] text-oncanvas/35">给任务加标签后，这里会按标签统计。</p>}
          <ul className="mt-3 flex flex-col gap-3">
            {tags.map(([tag, n]) => {
              const max = tags[0][1] || 1;
              return (
                <li key={tag}>
                  <div className="flex items-baseline justify-between text-[12px]">
                    <span>#{tag}</span>
                    <span className="font-mono text-[10px] text-oncanvas/35">{n}</span>
                  </div>
                  <div className="mt-1 h-[6px] w-full bg-line/15">
                    <div className="h-full bg-seal" style={{ width: `${Math.max(6, (n / max) * 100)}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <p className="mt-6 text-[11px] text-oncanvas/30">
        统计只算「已完成」的卡；重复任务生成的下一张只有在真正完成时才算收卡。
      </p>
    </div>
  );
}

