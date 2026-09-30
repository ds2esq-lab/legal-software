// The firm's calendar: open hours, open weekdays and closed days. Used for response time to new
// prospects (counted in business hours) and for milestone rules measured in workdays.
// Times are the browser's local time, which for the firm is Eastern.

export interface Closure {
  date: string; // YYYY-MM-DD
  name: string;
}

export interface OfficeHours {
  open: string; // "09:00"
  close: string; // "17:00"
  days: number[]; // open weekdays, 0 = Sunday
  federal: boolean; // closed on federal holidays (observed dates)
  dayAfterThanksgiving: boolean;
  extra: Closure[]; // one-off closures, e.g. an office move or Christmas Eve
}

export const DEFAULT_OFFICE_HOURS: OfficeHours = { open: '09:00', close: '17:00', days: [1, 2, 3, 4, 5], federal: true, dayAfterThanksgiving: true, extra: [] };

const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const localISO = (d: Date) => iso(d.getFullYear(), d.getMonth() + 1, d.getDate());
const dow = (y: number, m: number, d: number) => new Date(y, m - 1, d).getDay();

/** The nth weekday of a month (n = -1 for the last one). */
function nth(y: number, m: number, weekday: number, n: number) {
  if (n > 0) {
    const first = dow(y, m, 1);
    return iso(y, m, 1 + ((weekday - first + 7) % 7) + (n - 1) * 7);
  }
  const lastDay = new Date(y, m, 0).getDate();
  const last = dow(y, m, lastDay);
  return iso(y, m, lastDay - ((last - weekday + 7) % 7));
}

/** Fixed-date holidays that land on a weekend are observed on the Friday before or the Monday after. */
function observed(y: number, m: number, d: number) {
  const w = dow(y, m, d);
  const x = new Date(y, m - 1, d + (w === 6 ? -1 : w === 0 ? 1 : 0));
  return localISO(x);
}

/** Federal holidays as observed, for one calendar year. */
export function federalHolidays(y: number): Closure[] {
  const list: Closure[] = [
    { date: observed(y, 1, 1), name: 'New Year’s Day' },
    { date: nth(y, 1, 1, 3), name: 'Martin Luther King Jr. Day' },
    { date: nth(y, 2, 1, 3), name: 'Washington’s Birthday' },
    { date: nth(y, 5, 1, -1), name: 'Memorial Day' },
    { date: observed(y, 6, 19), name: 'Juneteenth' },
    { date: observed(y, 7, 4), name: 'Independence Day' },
    { date: nth(y, 9, 1, 1), name: 'Labor Day' },
    { date: nth(y, 10, 1, 2), name: 'Columbus Day' },
    { date: observed(y, 11, 11), name: 'Veterans Day' },
    { date: nth(y, 11, 4, 4), name: 'Thanksgiving Day' },
    { date: observed(y, 12, 25), name: 'Christmas Day' },
  ];
  // When January 1 of next year is a Saturday, it's observed on December 31 of this one.
  const nextNewYear = observed(y + 1, 1, 1);
  if (nextNewYear.startsWith(String(y))) list.push({ date: nextNewYear, name: 'New Year’s Day (observed)' });
  return list.filter((h) => h.date.startsWith(String(y)));
}

/** Every day the office is closed in a year, other than regular closed weekdays. */
export function closedDays(h: OfficeHours, y: number): Closure[] {
  const out: Closure[] = h.federal ? federalHolidays(y) : [];
  if (h.dayAfterThanksgiving) {
    const tg = nth(y, 11, 4, 4);
    out.push({ date: iso(y, 11, Number(tg.slice(8)) + 1), name: 'Day after Thanksgiving' });
  }
  for (const c of h.extra) if (c.date.startsWith(String(y))) out.push(c);
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// ---------- The firm's current calendar ----------

let current = DEFAULT_OFFICE_HOURS;
const cache = new Map<number, Set<string>>();

/** Called by the store when the settings load or change. */
export function setFirmCalendar(h: OfficeHours) {
  if (h === current) return;
  current = h;
  cache.clear();
}

function closedSet(h: OfficeHours, y: number) {
  if (h !== current) return new Set(closedDays(h, y).map((c) => c.date));
  let s = cache.get(y);
  if (!s) cache.set(y, (s = new Set(closedDays(h, y).map((c) => c.date))));
  return s;
}

/** Is the office open on this date (YYYY-MM-DD)? */
export function isOpenDay(date: string, h: OfficeHours = current) {
  const [y, m, d] = date.split('-').map(Number);
  return h.days.includes(dow(y, m, d)) && !closedSet(h, y).has(date);
}

export const closureName = (date: string, h: OfficeHours = current) => closedDays(h, Number(date.slice(0, 4))).find((c) => c.date === date)?.name;

const minutes = (hhmm: string) => {
  const [a, b] = hhmm.split(':').map(Number);
  return a * 60 + (b || 0);
};

/** Open hours between two moments (ISO datetimes), counting only open days and office hours. */
export function businessHours(from: string, to: string, h: OfficeHours = current) {
  const a = new Date(from), b = new Date(to);
  if (!(b > a)) return 0;
  let total = 0;
  const day = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  for (let guard = 0; day <= b && guard < 3660; guard++) {
    if (isOpenDay(localISO(day), h)) {
      const open = new Date(day.getTime() + minutes(h.open) * 60000);
      const close = new Date(day.getTime() + minutes(h.close) * 60000);
      const s = Math.max(a.getTime(), open.getTime()), e = Math.min(b.getTime(), close.getTime());
      if (e > s) total += (e - s) / 3600000;
    }
    day.setDate(day.getDate() + 1);
  }
  return total;
}

/** Length of one open day, in hours. */
export const dayLength = (h: OfficeHours = current) => Math.max(0, (minutes(h.close) - minutes(h.open)) / 60);

/** The moment that's `hours` of open time after `from` (e.g. a reply due "within 4 business hours"). */
export function addBusinessHours(from: string, hours: number, h: OfficeHours = current) {
  let left = hours * 60; // minutes
  const t = new Date(from);
  for (let guard = 0; guard < 3660; guard++) {
    const day = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    const open = new Date(day.getTime() + minutes(h.open) * 60000);
    const close = new Date(day.getTime() + minutes(h.close) * 60000);
    if (isOpenDay(localISO(day), h) && t < close) {
      const start = t < open ? open : t;
      const avail = (close.getTime() - start.getTime()) / 60000;
      if (avail >= left) return new Date(start.getTime() + left * 60000).toISOString();
      left -= avail;
    }
    t.setTime(new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime());
  }
  return t.toISOString();
}
