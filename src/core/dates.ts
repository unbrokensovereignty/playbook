/**
 * Study days. A study day runs from the day-start hour (4 AM by default) to the same hour the next
 * morning, in local time, so a session at 1 AM still counts toward the evening before.
 *
 * Days are identified by a key "YYYY-MM-DD" (the calendar date the study day starts on). All
 * arithmetic on keys goes through calendar dates, never through "+ 24 hours", so it stays right
 * across daylight-saving changes.
 */
import { DAY } from './util.ts';

export type DayKey = string;

const pad = (n: number) => String(n).padStart(2, '0');
/** The calendar date of `d` in local time, as a key (no day-start hour: midnight to midnight). */
export const keyOf = (d: Date): DayKey => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function isDayKey(k: unknown): k is DayKey {
  if (typeof k !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(k)) return false;
  const [y, m, d] = k.split('-').map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d && y >= 2000 && y <= 2200;
}

function parts(k: DayKey): [number, number, number] {
  return k.split('-').map(Number) as [number, number, number];
}

/** The study day that time `ts` belongs to. */
export function dayKey(ts: number, startHour: number): DayKey {
  const d = new Date(ts);
  if (d.getHours() < startHour) {
    // before the day-start hour: still yesterday's study day
    const y = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, 12);
    return keyOf(y);
  }
  return keyOf(d);
}

/** When study day `k` begins (local time). */
export function dayStart(k: DayKey, startHour: number): number {
  const [y, m, d] = parts(k);
  return new Date(y, m - 1, d, startHour, 0, 0, 0).getTime();
}

/** When study day `k` ends (the start of the next one). */
export const dayEnd = (k: DayKey, startHour: number): number => dayStart(addDays(k, 1), startHour);

export function addDays(k: DayKey, n: number): DayKey {
  const [y, m, d] = parts(k);
  return keyOf(new Date(y, m - 1, d + n, 12));
}

/** Whole days from `a` to `b` (positive when b is later). */
export function diffDays(a: DayKey, b: DayKey): number {
  const [y1, m1, d1] = parts(a), [y2, m2, d2] = parts(b);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / DAY);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(k: DayKey): number {
  const [y, m, d] = parts(k);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** The Monday that starts the week containing `k` (weeks run Monday to Sunday). */
export function weekStart(k: DayKey): DayKey {
  return addDays(k, -((weekday(k) + 6) % 7));
}

/** Keys from `from` to `to`, both included. */
export function dayRange(from: DayKey, to: DayKey): DayKey[] {
  const out: DayKey[] = [];
  const n = diffDays(from, to);
  for (let i = 0; i <= n; i++) out.push(addDays(from, i));
  return out;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const weekdayName = (k: DayKey): string => WEEKDAYS[weekday(k)] as string;
export const weekdayShort = (k: DayKey): string => weekdayName(k).slice(0, 3);
export const monthShort = (k: DayKey): string => MONTHS[parts(k)[1] - 1] as string;

/** "Sep 25" or, in another year, "Sep 25, 2027". */
export function fmtDay(k: DayKey, today?: DayKey): string {
  const [y, m, d] = parts(k);
  const s = `${MONTHS[m - 1]} ${d}`;
  return today && parts(today)[0] === y ? s : `${s}, ${y}`;
}

/** "Thu, Sep 25" or, in another year, "Thu, Sep 25, 2027". */
export const dayName = (k: DayKey, today?: DayKey): string => `${weekdayShort(k)}, ${fmtDay(k, today)}`;

/** "September 25, 2026", for a printed page. */
export function fmtLongDay(k: DayKey): string {
  const [y, m, d] = parts(k);
  return `${MONTHS_LONG[m - 1]} ${d}, ${y}`;
}

/** The time of day at `ts`, local time: "9:05 AM". */
export function fmtTime(ts: number): string {
  const d = new Date(ts), h = d.getHours();
  return `${h % 12 || 12}:${pad(d.getMinutes())} ${h < 12 ? 'AM' : 'PM'}`;
}

/** "today", "tomorrow", "yesterday", "in 3 days", "3 days ago", or the date for anything further. */
export function relDay(k: DayKey, today: DayKey): string {
  const n = diffDays(today, k);
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n === -1) return 'yesterday';
  if (n > 1 && n < 7) return `in ${n} days`;
  if (n < -1 && n > -7) return `${-n} days ago`;
  return fmtDay(k, today);
}

/** Parses "HH:MM" (24-hour) into minutes after midnight, or null. */
export function parseClock(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2]);
  return h < 24 && mi < 60 ? h * 60 + mi : null;
}

/**
 * The last `weeks` weeks as columns of seven days, Monday first, ending with the week of `today`.
 * Also where each month starts (the first column holding its 1st), for labels.
 */
export function weekGrid(today: DayKey, weeks: number): { cols: DayKey[][]; months: { col: number; name: string }[] } {
  const first = addDays(weekStart(today), -7 * (Math.max(1, weeks) - 1));
  const cols: DayKey[][] = [];
  const months: { col: number; name: string }[] = [];
  for (let c = 0; c < Math.max(1, weeks); c++) {
    const col = Array.from({ length: 7 }, (_x, r) => addDays(first, c * 7 + r));
    cols.push(col);
    const start = col.find((k) => parts(k)[2] === 1);
    if (start) months.push({ col: c, name: monthShort(start) });
  }
  return { cols, months };
}
