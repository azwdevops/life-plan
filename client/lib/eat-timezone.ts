/** East Africa Time (EAT, UTC+3, no DST). IANA zone used for AI schedule generation and display. */
export const EAT_TIMEZONE = "Africa/Nairobi";

export function getEatDayKey(d: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: EAT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${day}`;
}

/** End of calendar day 23:59:59.999 in EAT, as UTC ISO string (for API). */
export function endOfEatDayIso(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: EAT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = Number(parts.find((p) => p.type === "year")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "month")?.value ?? 1);
  const d = Number(parts.find((p) => p.type === "day")?.value ?? 1);
  // EAT is always UTC+3: local 23:59:59.999 = 20:59:59.999 UTC same civil date.
  return new Date(Date.UTC(y, m - 1, d, 20, 59, 59, 999)).toISOString();
}

const timeFmt: Intl.DateTimeFormatOptions = {
  timeZone: EAT_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

export function formatEatTimeRange(startIso: string, endIso: string): string {
  const a = new Date(startIso);
  const b = new Date(endIso);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) {
    return "n/a";
  }
  return `${a.toLocaleTimeString("en-GB", timeFmt)} - ${b.toLocaleTimeString("en-GB", timeFmt)} EAT`;
}
