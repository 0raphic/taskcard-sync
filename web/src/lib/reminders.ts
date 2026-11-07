import { isDone, isOverdue, isToday, type Task } from './types';

/** 解析 "MM-DD HH:mm" 或 "YYYY-MM-DD HH:mm"，返回毫秒；无效返回 0 */
export function parseRemind(s?: string): number {
  if (!s) return 0;
  const t = s.trim().replace('T', ' ');
  const m = t.match(/^(?:(\d{4})-)?(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})$/);
  if (!m) return 0;
  const year = m[1] ? Number(m[1]) : new Date().getFullYear();
  return new Date(year, Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])).getTime();
}

export function canNotify(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && window.isSecureContext;
}

export function notifyPermission(): NotificationPermission | 'unsupported' {
  return canNotify() ? Notification.permission : 'unsupported';
}

const SENT = 'taskcard:reminded:';

/** 更新标题角标，并对到点的卡发浏览器通知（同一分钟只发一次） */
export function tickReminders(tasks: Task[]) {
  const open = tasks.filter((t) => !t.draft && !isDone(t));
  const dueCount = open.filter((t) => isToday(t) || isOverdue(t)).length;
  document.title = dueCount > 0 ? `(${dueCount}) 任务卡片` : '任务卡片';

  if (!canNotify() || Notification.permission !== 'granted') return;
  const now = Date.now();
  for (const t of open) {
    const at = parseRemind(t.remind_at);
    if (!at) continue;
    const delta = now - at;
    if (delta < 0 || delta > 90_000) continue;
    const key = `${SENT}${t.id}:${t.remind_at}`;
    if (localStorage.getItem(key)) continue;
    localStorage.setItem(key, '1');
    try {
      new Notification(t.title, { body: '到点了，做完就勾掉它。', tag: t.id });
    } catch {
      /* 某些浏览器只允许 SW 通知，忽略 */
    }
  }
}

export async function askNotify(): Promise<boolean> {
  if (!canNotify()) return false;
  const r = await Notification.requestPermission();
  return r === 'granted';
}
