function toSeconds(hms: string): number {
  const [h, m, s] = hms.split(':').map(n => parseInt(n, 10) || 0);
  return h * 3600 + m * 60 + s;
}

export function formatTimeHHMMSS(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** Next epoch (ms) at which the given HH:MM:SS time of day occurs, rolling to tomorrow if already passed. */
export function nextOccurrenceEpochMillis(hhmmss: string, from: Date = new Date()): number {
  const [h, m, s] = hhmmss.split(':').map(n => parseInt(n, 10) || 0);
  const target = new Date(from);
  target.setHours(h, m, s, 0);
  if (target.getTime() <= from.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return target.getTime();
}

/** Whether `now` falls within [startTime, endTime), handling windows that cross midnight. */
export function isWithinWindow(startTime: string, endTime: string, now: Date = new Date()): boolean {
  const start = toSeconds(startTime);
  const end = toSeconds(endTime);
  if (start === end) return false;
  const current = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  if (start < end) {
    return current >= start && current < end;
  }
  return current >= start || current < end;
}
