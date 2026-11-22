/* Dates, the way every Administration screen prints them. */

const TIME: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
const DATE: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };

function toDate(input: string | Date | null | undefined): Date | null {
  if (!input) return null;
  const date = typeof input === "string" ? new Date(input) : input;
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Midnights apart, so "yesterday at 11pm" never reads as "an hour ago". */
function daysApart(date: Date, now: Date): number {
  const a = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** "Today, 10:24 AM" for the last two days, then the plain date. */
export function formatWhen(input: string | Date | null | undefined, now = new Date()): string {
  const date = toDate(input);
  if (!date) return "—";
  const days = daysApart(date, now);
  if (days === 0) return `Today, ${date.toLocaleTimeString("en-US", TIME)}`;
  if (days === 1) return `Yesterday, ${date.toLocaleTimeString("en-US", TIME)}`;
  return date.toLocaleDateString("en-US", DATE);
}

/** "12 Sep 2026, 09:12 AM" — the full stamp, for detail panels. */
export function formatStamp(input: string | Date | null | undefined): string {
  const date = toDate(input);
  if (!date) return "—";
  return `${date.toLocaleDateString("en-US", DATE)}, ${date.toLocaleTimeString("en-US", TIME)}`;
}

export function formatDate(input: string | Date | null | undefined): string {
  const date = toDate(input);
  return date ? date.toLocaleDateString("en-US", DATE) : "—";
}

/** "2 days ago" / "3 hours ago" / "just now". */
export function formatAgo(input: string | Date | null | undefined, now = new Date()): string {
  const date = toDate(input);
  if (!date) return "—";
  const seconds = Math.max(0, Math.round((now.getTime() - date.getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = daysApart(date, now);
  if (days < 30) return `${days} ${days === 1 ? "day" : "days"} ago`;
  return formatDate(date);
}

/** The value a date input wants: YYYY-MM-DD in local time, not UTC. */
export function toDateInput(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
