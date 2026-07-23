/**
 * Local calendar date/time helpers.
 * Prefer these over `new Date("YYYY-MM-DD")` (UTC midnight) and
 * `toISOString().slice(0, 10)` (UTC day) so form values match local days.
 */

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Parse `YYYY-MM-DD` as local midnight. */
export function parseLocalDate(value: string): Date | null {
  const m = DATE_ONLY.exec(value.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const date = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

/** Parse `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm` as local wall time. */
export function parseLocalDateTime(value: string): Date | null {
  const trimmed = value.trim();
  const dt = DATE_TIME.exec(trimmed);
  if (dt) {
    const year = Number(dt[1]);
    const month = Number(dt[2]);
    const day = Number(dt[3]);
    const hour = Number(dt[4]);
    const minute = Number(dt[5]);
    if (hour > 23 || minute > 59) return null;
    const date = new Date(year, month - 1, day, hour, minute, 0, 0);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }
    return date;
  }
  return parseLocalDate(trimmed);
}

/** Format a Date as `YYYY-MM-DD` in local time. */
export function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Format a Date as `YYYY-MM-DDTHH:mm` in local time. */
export function formatLocalDateTime(date: Date): string {
  return `${formatLocalDate(date)}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** Local date at 9:00 AM today (default for new follow-ups). */
export function defaultFollowUpDateTime(from: Date = new Date()): Date {
  const d = new Date(from);
  d.setHours(9, 0, 0, 0);
  return d;
}
