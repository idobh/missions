// All "today" logic is anchored to Israel time so server and browser agree.
export const TZ = "Asia/Jerusalem";

export function todayISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function dayOfWeek(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// Week starts on Sunday (Israeli convention)
export function startOfWeekISO(iso: string = todayISO()): string {
  return addDays(iso, -dayOfWeek(iso));
}

export const HEB_DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
export const HEB_DAYS_SHORT = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
export const HEB_MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

export function formatDateHe(iso: string | null, opts: { relative?: boolean } = { relative: true }): string {
  if (!iso) return "";
  const today = todayISO();
  if (opts.relative) {
    if (iso === today) return "היום";
    if (iso === addDays(today, 1)) return "מחר";
    if (iso === addDays(today, -1)) return "אתמול";
  }
  const [y, m, d] = iso.split("-").map(Number);
  const sameYear = y === Number(today.slice(0, 4));
  return sameYear ? `${d} ב${HEB_MONTHS[m - 1]}` : `${d}.${m}.${y}`;
}

export function isOverdue(due: string | null, status: string, today = todayISO()): boolean {
  return !!due && due < today && status !== "done";
}
