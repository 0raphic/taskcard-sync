export const STATUSES = ['todo', 'doing', 'done', 'paused'] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<Status, string> = {
  todo: '待办',
  doing: '进行中',
  done: '完成',
  paused: '搁置',
};

export type Kind = 'short' | 'long';

export type ChecklistItem = { t: string; d: boolean };

export type Task = {
  id: string;
  title: string;
  kind: Kind;
  status: Status;
  due?: string;
  estimate_min?: number;
  description?: string;
  materials?: string;
  notes?: string;
  parent?: string;
  goal?: string;
  start?: string;
  milestones?: string[];
  progress?: number;
  priority?: string;
  dod?: string;
  weekly_hours?: number;
  tags?: string;
  checklist?: ChecklistItem[];
  draft?: boolean;
  client_updated_at?: string;
  created?: string;
  updated?: string;
};

export type ShortLink = {
  id: string;
  code: string;
  task: string;
  active: boolean;
  scans: number;
  last_scan_at?: string;
  expand?: { task?: Task };
};

export type ProgressLog = {
  id: string;
  task: string;
  note: string;
  at: string;
  delta: number;
};

export const isDone = (t: Task) => t.status === 'done';

/** 标签是逗号/空格分隔的一行文本，读的时候拆开 */
export function parseTags(t: Task): string[] {
  return (t.tags || '')
    .split(/[,，\s]+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 8);
}

export function checkStats(t: Task): { done: number; total: number } {
  const list = t.checklist || [];
  return { done: list.filter((x) => x.d).length, total: list.length };
}

/** 逾期判断：只认 MM-DD 这种手写日期，不做时区推算 */
export function isOverdue(t: Task, today = new Date()): boolean {
  if (t.kind !== 'short' || !t.due || t.status === 'done') return false;
  const m = /^(\d{1,2})-(\d{1,2})$/.exec(t.due.trim());
  if (!m) return false;
  const due = new Date(today.getFullYear(), Number(m[1]) - 1, Number(m[2]));
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return due.getTime() < start.getTime();
}

export function isToday(t: Task, today = new Date()): boolean {
  if (t.kind !== 'short' || !t.due) return false;
  const m = /^(\d{1,2})-(\d{1,2})$/.exec(t.due.trim());
  if (!m) return false;
  return Number(m[1]) === today.getMonth() + 1 && Number(m[2]) === today.getDate();
}
