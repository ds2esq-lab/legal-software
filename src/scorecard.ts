// Personal scorecards: every person has a dashboard of metrics picked for their role, with goals.
// Leaders (anyone with people reporting to them, or the "Firm performance" permission) also see
// their organization, and can drill from the firm → a person → a metric → the matters behind it.
//
// Numbers come from two places:
//   - live data in the app (tasks completed, time entries, milestones, trust deposits and invoices)
//   - generated history for earlier quarters, standing in for what an import from Monday and Clio
//     would provide. It is fictional and seeded, so it's the same on every load.
import type { Matter, UserAccess, Task, TimeEntry, Invoice, Pnc } from './data';
import type { TrustTxn } from './trust';
import { statsFor, type Quarter } from './metrics';
import { addDays, todayISO } from './practice';

export type Unit = 'money' | 'count' | 'hours' | 'pct';
type Src = 'fees' | 'firmIn' | 'task' | 'hours' | 'milestone' | 'consult' | 'hire' | 'invoice' | 'closed' | 'reply';

export interface MetricDef {
  id: string;
  label: string;
  unit: Unit;
  src: Src;
  field: 'n' | 'dn' | 'ratio' | 'avg'; // what to add up: n, dn, n ÷ dn as a percentage, or n ÷ dn as an average
  help: string;
  lowerIsBetter?: boolean; // response time: the goal is a ceiling
  needsMeasure?: boolean; // fees: only for people with "Measured on" set
}

export const METRICS: MetricDef[] = [
  { id: 'fees', label: 'Fees brought in', unit: 'money', src: 'fees', field: 'n', needsMeasure: true, help: 'Paid on fixed-price matters plus collected on hourly matters, credited to the originating attorney' },
  { id: 'firmIn', label: 'Firm money in', unit: 'money', src: 'firmIn', field: 'n', help: 'Everything clients paid the firm this quarter' },
  { id: 'hours', label: 'Hours logged', unit: 'hours', src: 'hours', field: 'dn', help: 'All time entered, billable or not' },
  { id: 'billable', label: 'Billable share', unit: 'pct', src: 'hours', field: 'ratio', help: 'Billable hours as a share of all hours logged' },
  { id: 'tasksDone', label: 'Tasks completed', unit: 'count', src: 'task', field: 'dn', help: 'Tasks marked done this quarter' },
  { id: 'onTime', label: 'On time', unit: 'pct', src: 'task', field: 'ratio', help: 'Share of completed tasks finished by their due date' },
  { id: 'milestones', label: 'Milestones reached', unit: 'count', src: 'milestone', field: 'n', help: 'Matter milestones completed' },
  { id: 'consults', label: 'Consults held', unit: 'count', src: 'consult', field: 'n', help: 'Initial consultations with prospects' },
  { id: 'hires', label: 'New clients', unit: 'count', src: 'hire', field: 'n', help: 'PNC matters that hired the firm' },
  { id: 'closed', label: 'Matters closed', unit: 'count', src: 'closed', field: 'n', help: 'Matters completed and closed out, credited to the responsible attorney' },
  { id: 'response', label: 'Response time', unit: 'hours', src: 'reply', field: 'avg', lowerIsBetter: true, help: 'Average hours from a new prospect’s inquiry to the firm’s first reply (self-booked prospects aren’t counted)' },
  { id: 'invoicesSent', label: 'Invoices sent', unit: 'count', src: 'invoice', field: 'n', help: 'Invoices issued to clients' },
];
export const metric = (id: string) => METRICS.find((m) => m.id === id);

export const ROLE_SCORECARD: Record<string, string[]> = {
  managing: ['fees', 'hires', 'hours', 'onTime'],
  attorney: ['fees', 'hours', 'onTime', 'closed'],
  paralegal: ['tasksDone', 'onTime', 'milestones', 'closed'],
  intake: ['response', 'consults', 'hires', 'onTime'],
  bookkeeper: ['firmIn', 'invoicesSent', 'onTime'],
};

export function scorecardOf(u: UserAccess): string[] {
  const list = (u.scorecard ?? ROLE_SCORECARD[u.roleId] ?? ['tasksDone', 'onTime']).filter((id) => metric(id));
  return list.filter((id) => !metric(id)!.needsMeasure || u.measure);
}

export const goalOf = (u: UserAccess, id: string) => (id === 'fees' ? u.goal : u.goals?.[id]);

// ---------- Organization ----------

export const directReports = (users: UserAccess[], id: string) => users.filter((u) => u.manager === id).map((u) => u.userId);

/** Everyone below a person, at any depth. Guards against loops in a hand-edited chart. */
export function orgOf(users: UserAccess[], id: string): string[] {
  const out: string[] = [];
  const walk = (x: string) => {
    for (const r of directReports(users, x)) if (r !== id && !out.includes(r)) { out.push(r); walk(r); }
  };
  walk(id);
  return out;
}

/** People at the top of the chart: nobody they report to (or their manager isn't set up). */
export const roots = (users: UserAccess[]) => users.filter((u) => !u.manager || !users.some((x) => x.userId === u.manager)).map((u) => u.userId);

// ---------- Events ----------

export interface Ev {
  u: string; // person credited
  d: string; // date
  src: Src;
  a?: string; // practice area
  m?: string; // matter
  n: number;
  dn: number;
}

function rng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353), (h = (h << 13) | (h >>> 19));
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

// Typical quarter for each sample person (fictional).
const RATES: Record<string, Partial<Record<'tasks' | 'onTime' | 'hours' | 'billable' | 'milestones' | 'consults' | 'hires' | 'invoices' | 'closed' | 'prospects' | 'replyH', number>>> = {
  me: { tasks: 95, onTime: 0.9, hours: 310, billable: 0.78, milestones: 30, consults: 34, hires: 15, closed: 13, prospects: 30, replyH: 7 },
  marcus: { tasks: 120, onTime: 0.86, hours: 305, billable: 0.84, milestones: 44, consults: 20, hires: 9, closed: 11, prospects: 18, replyH: 14 },
  dana: { tasks: 250, onTime: 0.93, hours: 400, billable: 0.52, milestones: 60, consults: 42, hires: 16, prospects: 75, replyH: 3 },
  priya: { tasks: 170, onTime: 0.82, hours: 360, billable: 0.6, milestones: 36, closed: 9 },
  lena: { tasks: 70, onTime: 0.96, hours: 420, billable: 0.08, invoices: 58 },
};
const ROLE_RATES: Record<string, (typeof RATES)[string]> = {
  managing: RATES.me, attorney: RATES.marcus, paralegal: RATES.priya, intake: { tasks: 120, onTime: 0.9, hours: 420, billable: 0.1, consults: 45, hires: 16, prospects: 80, replyH: 3 }, bookkeeper: RATES.lena,
};

/** Generated history for one person and quarter (up to yesterday). */
function history(u: UserAccess, q: Quarter, matters: Matter[], areaIds: string[]): Ev[] {
  const today = todayISO();
  const last = q.end < today ? q.end : addDays(today, -1);
  if (last < q.start) return [];
  const span = (new Date(q.end).getTime() - new Date(q.start).getTime()) / 864e5 + 1;
  const days = (new Date(last).getTime() - new Date(q.start).getTime()) / 864e5 + 1;
  const r = rng(u.userId + q.id);
  const rate = RATES[u.userId] ?? ROLE_RATES[u.roleId] ?? {};
  const scale = (days / span) * (0.85 + r() * 0.3);
  const areas = u.areas === 'all' ? areaIds : u.areas.length ? u.areas : areaIds;
  const pool = matters.filter((m) => areas.includes(m.areaId));
  const date = () => addDays(q.start, Math.floor(r() * days));
  const pickMatter = (d: string) => {
    const live = pool.filter((m) => m.opened <= d && (m.status === 'open' || (m.closedOn ?? '') >= d));
    const from = live.length ? live : pool;
    return from.length ? from[Math.floor(r() * from.length)] : undefined;
  };
  const out: Ev[] = [];
  const count = (x?: number) => Math.round((x ?? 0) * scale);
  const add = (src: Src, n: number, dn: number, withMatter = true) => {
    const d = date();
    const m = withMatter ? pickMatter(d) : undefined;
    out.push({ u: u.userId, d, src, m: m?.id, a: m?.areaId ?? areas[Math.floor(r() * areas.length)], n, dn });
  };
  for (let i = 0; i < count(rate.tasks); i++) add('task', r() < (rate.onTime ?? 0.9) ? 1 : 0, 1);
  const hrs = count(rate.hours);
  for (let h = 0; h < hrs; ) {
    const x = Math.round((0.3 + r() * 2.7) * 10) / 10;
    h += x;
    add('hours', r() < (rate.billable ?? 0.5) ? x : 0, x);
  }
  for (let i = 0; i < count(rate.milestones); i++) add('milestone', 1, 1);
  for (let i = 0; i < count(rate.consults); i++) add('consult', 1, 1, false);
  for (let i = 0; i < count(rate.hires); i++) add('hire', 1, 1);
  for (let i = 0; i < count(rate.invoices); i++) add('invoice', 1, 1);
  for (let i = 0; i < count(rate.closed); i++) add('closed', 1, 1);
  // Reply times are skewed: most within a few hours, a few after a weekend. Drifts a little each quarter.
  const typical = (rate.replyH ?? 6) * (0.8 + r() * 0.4);
  for (let i = 0; i < count(rate.prospects); i++) add('reply', Math.round(-Math.log(1 - r() * 0.98) * typical * 10) / 10, 1, false);
  return out;
}

export interface Sources {
  users: UserAccess[];
  matters: Matter[];
  tasks: Task[];
  timeEntries: TimeEntry[];
  trustTxns: TrustTxn[];
  invoices: Invoice[];
  pncs: Pnc[];
  areaIds: string[];
}

const inQ = (d: string | undefined, q: Quarter) => !!d && d.slice(0, 10) >= q.start && d.slice(0, 10) <= q.end;

/** Builds a lookup that answers "what was X for these people in this quarter", with the rows behind it. */
export function makeScores(src: Sources) {
  const cache = new Map<string, Ev[]>();
  const matterById = new Map(src.matters.map((m) => [m.id, m]));

  function events(uid: string, q: Quarter): Ev[] {
    const key = uid + q.id;
    const hit = cache.get(key);
    if (hit) return hit;
    const u = src.users.find((x) => x.userId === uid);
    if (!u) return [];
    const out = history(u, q, src.matters, src.areaIds);
    for (const t of src.tasks) if (t.assignee === uid && t.done && inQ(t.doneAt, q)) out.push({ u: uid, d: t.doneAt!.slice(0, 10), src: 'task', m: t.matterId, a: t.matterId ? matterById.get(t.matterId)?.areaId : undefined, n: t.doneAt! <= t.due ? 1 : 0, dn: 1 });
    for (const e of src.timeEntries) if (e.user === uid && inQ(e.date, q)) { const h = e.actualMinutes / 60; out.push({ u: uid, d: e.date, src: 'hours', m: e.matterId, a: matterById.get(e.matterId)?.areaId, n: e.billable ? h : 0, dn: h }); }
    for (const m of src.matters) if (m.owner === uid && m.status === 'closed' && inQ(m.closedOn, q)) out.push({ u: uid, d: m.closedOn!, src: 'closed', m: m.id, a: m.areaId, n: 1, dn: 1 });
    for (const p of src.pncs) if (p.owner === uid && p.receivedAt && p.firstReplyAt && inQ(p.firstReplyAt, q)) out.push({ u: uid, d: p.firstReplyAt.slice(0, 10), src: 'reply', a: p.areaId, n: responseHours(p.receivedAt, p.firstReplyAt), dn: 1 });
    for (const m of src.matters) if (m.owner === uid) for (const ms of Object.values(m.milestones)) if (inQ(ms.done, q)) out.push({ u: uid, d: ms.done!, src: 'milestone', m: m.id, a: m.areaId, n: 1, dn: 1 });
    if (u.measure) {
      const st = statsFor(uid, q, src.matters, src.trustTxns, src.invoices);
      for (const r of st.matters) {
        const n = u.measure === 'hourly' ? r.collected : u.measure === 'fixed' ? r.paid : r.paid + r.collected;
        if (n) out.push({ u: uid, d: q.end, src: 'fees', m: r.matter.id, a: r.matter.areaId, n, dn: 1 });
      }
    }
    if (scorecardOf(u).includes('firmIn')) {
      for (const orig of new Set(src.matters.map((m) => m.originator))) {
        for (const r of statsFor(orig, q, src.matters, src.trustTxns, src.invoices).matters) {
          if (r.paid + r.collected) out.push({ u: uid, d: q.end, src: 'firmIn', m: r.matter.id, a: r.matter.areaId, n: r.paid + r.collected, dn: 1 });
        }
      }
    }
    cache.set(key, out);
    return out;
  }

  const pick = (def: MetricDef, people: string[], q: Quarter) => people.flatMap((p) => events(p, q)).filter((e) => e.src === def.src);

  function total(evs: Ev[], def: MetricDef): number | undefined {
    if (def.field === 'ratio' || def.field === 'avg') {
      const dn = evs.reduce((s, e) => s + e.dn, 0);
      return dn ? (evs.reduce((s, e) => s + e.n, 0) / dn) * (def.field === 'ratio' ? 100 : 1) : undefined;
    }
    return evs.reduce((s, e) => s + e[def.field as 'n' | 'dn'], 0);
  }

  return {
    value(id: string, people: string[], q: Quarter) {
      const def = metric(id);
      return def ? total(pick(def, people, q), def) : undefined;
    },
    /** Rows behind a number, grouped by `by` (matter, practice area or person). */
    breakdown(id: string, people: string[], q: Quarter, by: 'm' | 'a' | 'u') {
      const def = metric(id);
      if (!def) return [];
      const groups = new Map<string, Ev[]>();
      for (const e of pick(def, people, q)) {
        const k = e[by] ?? '';
        groups.set(k, [...(groups.get(k) ?? []), e]);
      }
      return [...groups.entries()]
        .map(([key, evs]) => ({ key, value: total(evs, def) ?? 0, items: evs.reduce((s, e) => s + e.dn, 0) }))
        .sort((a, b) => b.value - a.value);
    },
  };
}
export type Scores = ReturnType<typeof makeScores>;

// ---------- Goals and pace ----------

/** How far through a quarter we are (1 for past quarters). */
export function elapsed(q: Quarter, today = todayISO()) {
  if (today > q.end) return 1;
  if (today < q.start) return 0;
  const a = new Date(q.start).getTime(), b = new Date(q.end).getTime() + 864e5, t = new Date(today).getTime() + 864e5;
  return Math.min(1, (t - a) / (b - a));
}

export type Tone = 'ok' | 'warn' | 'danger' | 'none';

/** Compares a value with its goal. Sums are judged against where they should be by now; rates against the goal itself. */
export function toneFor(def: MetricDef, value: number | undefined, goal: number | undefined, q: Quarter): { tone: Tone; pace?: number; share?: number } {
  if (value === undefined || !goal) return { tone: 'none' };
  if (def.lowerIsBetter) {
    // A ceiling: at or under the goal is on target. The bar fills as the number gets better.
    const share = value <= goal ? 1 : goal / value;
    return { tone: value <= goal ? 'ok' : value <= goal * 1.25 ? 'warn' : 'danger', pace: 1, share };
  }
  const unit = def.unit;
  const pace = isRate(def) ? 1 : elapsed(q);
  const share = value / goal;
  const ratio = pace ? share / pace : 1;
  return { tone: ratio >= 1 ? 'ok' : ratio >= (unit === 'pct' ? 0.95 : 0.85) ? 'warn' : 'danger', pace, share };
}

/** Rates and averages aren't expected to grow through the quarter, so they aren't judged against pace. */
export const isRate = (def: MetricDef) => def.field === 'ratio' || def.field === 'avg';

/** Hours from inquiry to first reply. Counted around the clock; business hours could come later. */
export const responseHours = (from: string, to: string) => Math.max(0, Math.round(((new Date(to).getTime() - new Date(from).getTime()) / 3600000) * 10) / 10);

export function fmt(unit: Unit, v: number | undefined, short = false) {
  if (v === undefined) return '—';
  if (unit === 'money') {
    if (short && v >= 1000) return `$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
    return `$${Math.round(v).toLocaleString('en-US')}`;
  }
  if (unit === 'pct') return `${Math.round(v)}%`;
  if (unit === 'hours') return `${(v < 10 ? Math.round(v * 10) / 10 : Math.round(v)).toLocaleString('en-US')}${short ? 'h' : ' h'}`;
  return Math.round(v).toLocaleString('en-US');
}
