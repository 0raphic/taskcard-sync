/** 时间统一按 UTC+8（Asia/Shanghai）显示，避免看板/进展记录里出现 UTC 时间。 */
const TZ = 'Asia/Shanghai';

const dt = new Intl.DateTimeFormat('zh-CN', {
  timeZone: TZ,
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const dOnly = new Intl.DateTimeFormat('zh-CN', {
  timeZone: TZ,
  month: '2-digit',
  day: '2-digit',
});

/** ISO → "11-07 14:32"（UTC+8） */
export function fmtDateTime(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return dt.format(d).replace(/\//g, '-');
}

/** ISO → "11-07"（UTC+8） */
export function fmtDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return dOnly.format(d).replace(/\//g, '-');
}

/** ISO → "3 分钟前 / 2 小时前 / 11-06 18:20"（UTC+8） */
export function fmtAgo(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return fmtDateTime(iso);
}

/** 今天（UTC+8）的 MM-DD，用来和卡片上手写的截止日比较 */
export function todayMD(): string {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: TZ,
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return parts.replace(/\//g, '-');
}
