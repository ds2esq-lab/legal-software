import { isOpenDay } from './officeHours';
// Practice areas are configuration, not code. Everything here is editable in Settings.

export interface Stage {
  id: string;
  name: string;
}

export interface DueRule {
  after: string; // milestone id the clock starts from
  amount: number;
  unit: 'days' | 'workdays';
}

export interface Milestone {
  id: string;
  name: string;
  rule?: DueRule; // when set, the milestone gets an automatic due date
}

/** A task created automatically when a matter enters a stage. */
export interface TaskTemplate {
  id: string;
  stageId: string;
  title: string;
  assignTo: 'owner' | 'ball' | string; // responsible attorney, whoever has the ball, or a team member id
  dueIn: number;
  dueUnit: 'days' | 'workdays';
  kind: 'internal' | 'client' | 'court';
  checklist: string[];
}

export interface PracticeArea {
  id: string;
  name: string;
  code?: string; // short code for matter numbers, e.g. EP
  stages: Stage[]; // last stage is treated as "closed"
  milestones: Milestone[];
  cadence: { soon: number; followUp: number }; // days since last contact
  planTypes: string[];
  planLabel: string; // what this area calls a plan type ("Plan", "Type", "Deed type")
  stageTasks: TaskTemplate[];
  /** Fixed-price matters: share of the fee earned (and drawn from trust) when each milestone is done. */
  feeSchedule: { milestoneId: string; percent: number }[];
}

export const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `x${Date.now()}`;

let uid = 0;
export const newId = (p: string) => `${p}${Date.now().toString(36)}${(uid++).toString(36)}`;

const stages = (...names: string[]): Stage[] => names.map((name) => ({ id: slug(name), name }));
const ms = (name: string, rule?: [string, number, DueRule['unit']]): Milestone => ({
  id: slug(name),
  name,
  rule: rule ? { after: slug(rule[0]), amount: rule[1], unit: rule[2] } : undefined,
});

let tt = 0;
const task = (stage: string, title: string, assignTo: string, dueIn: number, dueUnit: TaskTemplate['dueUnit'] = 'workdays', checklist: string[] = [], kind: TaskTemplate['kind'] = 'internal'): TaskTemplate => ({
  id: `tt${++tt}`, stageId: slug(stage), title, assignTo, dueIn, dueUnit, kind, checklist,
});

// Seeded from how the firm runs today. "Waiting on client / 3rd party / attorney" is NOT a stage here;
// that is what Whose Ball is for.
export const DEFAULT_AREAS: PracticeArea[] = [
  {
    id: 'ep',
    code: 'EP',
    name: 'Estate Planning',
    planLabel: 'Plan',
    planTypes: [
      'Solo Essential (Will)', 'Couples Essential (Will)', 'Solo Signature (Trust)', 'Couples Signature (Trust)',
      'Solo Select (Deluxe Trust)', 'Couples Select (Deluxe Trust)', 'SNT', 'Restatement', 'Trust Upgrade',
      'Will Only', 'DPOA/AMD/HIPAA', 'Docs Update', 'Analysis (HNW)', 'Other',
    ],
    stages: stages('Info Gathering', 'Initial Drafting', 'Check Please', 'Send Drafts', 'Client Review', 'Revision', 'Send Finals', 'Signing', 'Record Deed', 'Ready to Close', 'Closeout'),
    milestones: [
      ms('Engaged'),
      ms('Questionnaire Sent', ['Engaged', 1, 'workdays']),
      ms('Questionnaire Submitted'),
      ms('Questionnaire Discussion', ['Questionnaire Submitted', 3, 'workdays']),
      ms('Drafts Sent', ['Questionnaire Submitted', 5, 'workdays']),
      ms('Draft Discussion'),
      ms('Final Docs Sent', ['Drafts Sent', 10, 'days']),
      ms('Signing'),
      ms('Closed'),
    ],
    cadence: { soon: 10, followUp: 14 },
    feeSchedule: [{ milestoneId: 'drafts-sent', percent: 50 }, { milestoneId: 'signing', percent: 50 }],
    stageTasks: [
      task('Info Gathering', 'Send questionnaire and document checklist', 'dana', 1, 'workdays', ['Questionnaire link sent', 'Document checklist sent', 'Follow-up set']),
      task('Initial Drafting', 'Draft documents', 'owner', 5),
      task('Check Please', 'Attorney review of drafts', 'me', 2),
      task('Send Drafts', 'Send drafts and book draft discussion', 'dana', 1, 'workdays', ['Drafts uploaded to portal', 'Email to client', 'Draft discussion booked']),
      task('Signing', 'Prepare signing binder', 'dana', 2, 'workdays', ['Originals printed', 'Witnesses and notary booked', 'Funding instructions letter', 'Binder assembled']),
      task('Record Deed', 'Record deed with county', 'dana', 3),
      task('Ready to Close', 'Closeout: scan originals, send funding letter', 'dana', 5, 'workdays', ['Originals scanned to file', 'Funding letter sent', 'Final invoice']),
    ],
  },
  {
    id: 'fpet',
    code: 'FP',
    name: 'Formal PET',
    planLabel: 'Type',
    planTypes: ['Formal Probate', 'Trust Administration', 'Conservatorship'],
    stages: stages('Info Gathering', 'Packet Submitted', 'Qualified', 'Pre-Inventory', 'Inventory Submitted', 'Accounting Submitted', 'Post Accounting 1', 'Ready to Close', 'Closeout'),
    milestones: [
      ms('Engaged'),
      ms('Onboarding Call', ['Engaged', 5, 'workdays']),
      ms('Petition Packet Submitted'),
      ms('Qualified'),
      ms('Notices Sent', ['Qualified', 10, 'days']),
      ms('Inventory Submitted', ['Qualified', 60, 'days']),
      ms('Accounting 1 Submitted', ['Qualified', 365, 'days']),
      ms('Accounting 2 Submitted', ['Accounting 1 Submitted', 365, 'days']),
      ms('Final Approved'),
      ms('Closed'),
    ],
    cadence: { soon: 14, followUp: 21 },
    feeSchedule: [],
    stageTasks: [
      task('Info Gathering', 'Collect death certificate, will and asset list', 'priya', 5, 'workdays', ['Certified death certificate', 'Original will', 'Asset list', 'Heir contact info']),
      task('Packet Submitted', 'Follow up with clerk on petition', 'priya', 10),
      task('Qualified', 'Publish notice to creditors', 'priya', 5, 'workdays', [], 'court'),
      task('Qualified', 'Open estate bank account (EIN first)', 'priya', 7),
      task('Pre-Inventory', 'Gather date-of-death values', 'priya', 14),
      task('Accounting Submitted', 'Calendar hearing on accounting', 'priya', 3),
    ],
  },
  {
    id: 'ipet',
    code: 'IP',
    name: 'Informal PET',
    planLabel: 'Type',
    planTypes: ['Informal Probate', 'Small Estate'],
    stages: stages('Info Gathering', 'Packet Submitted', 'Docs Recorded', 'Notices Sent', 'Ready to Close', 'Closeout'),
    milestones: [
      ms('Engaged'),
      ms('Onboarding Call', ['Engaged', 5, 'workdays']),
      ms('Packet Submitted'),
      ms('Docs Recorded'),
      ms('Notices Sent', ['Docs Recorded', 10, 'days']),
      ms('SEA Sent'),
      ms('Closed'),
    ],
    cadence: { soon: 14, followUp: 21 },
    feeSchedule: [{ milestoneId: 'packet-submitted', percent: 50 }, { milestoneId: 'sea-sent', percent: 50 }],
    stageTasks: [
      task('Info Gathering', 'Collect death certificate, will and asset list', 'priya', 5, 'workdays', ['Certified death certificate', 'Original will', 'Asset list']),
      task('Docs Recorded', 'Send notices to heirs and creditors', 'priya', 3, 'workdays', [], 'court'),
    ],
  },
  {
    id: 'gc',
    code: 'GC',
    name: 'Guardianship / Conservatorship',
    planLabel: 'Type',
    planTypes: ['Guardianship', 'Conservatorship', 'Both', 'Guardianship of Minor Estate', 'GAL'],
    stages: stages('Info Gathering', 'Draft Stage 1', 'Check Please', 'Draft Stage 2', 'Hearing Scheduled', 'Post Hearing', 'Ready to Close', 'Closeout'),
    milestones: [
      ms('Engaged'),
      ms('Questionnaire Submitted'),
      ms('First Filing', ['Questionnaire Submitted', 10, 'workdays']),
      ms('Second Filing'),
      ms('Hearing'),
      ms('Qualification'),
      ms('Closed'),
    ],
    cadence: { soon: 14, followUp: 21 },
    feeSchedule: [],
    stageTasks: [
      task('Info Gathering', 'Get physician evaluation', 'dana', 10),
      task('Hearing Scheduled', 'Serve notice of hearing', 'dana', 2, 'workdays', [], 'court'),
      task('Hearing Scheduled', 'Hearing prep call with petitioner', 'owner', 3),
      task('Post Hearing', 'File oath and bond; order letters', 'dana', 5),
    ],
  },
  {
    id: 'deed',
    code: 'DE',
    name: 'Deeds',
    planLabel: 'Deed type',
    planTypes: ['Gift', 'RTODD', 'Distribution', 'QCD'],
    stages: stages('Info Gathering', 'Drafting', 'Check Please', 'Ready to Sign', 'Signed', 'Recorded', 'Ready to Close', 'Closeout'),
    milestones: [
      ms('Engaged'),
      ms('Have Info'),
      ms('Drafted', ['Have Info', 3, 'workdays']),
      ms('Approved'),
      ms('Signed'),
      ms('Recorded', ['Signed', 5, 'workdays']),
      ms('Closed'),
    ],
    cadence: { soon: 3, followUp: 5 },
    feeSchedule: [{ milestoneId: 'drafted', percent: 50 }, { milestoneId: 'recorded', percent: 50 }],
    stageTasks: [
      task('Info Gathering', 'Pull current vesting deed', 'dana', 2),
      task('Ready to Sign', 'Book signing and notary', 'dana', 2),
      task('Signed', 'Record deed', 'dana', 2),
      task('Recorded', 'Mail recorded deed to client', 'dana', 3, 'workdays', [], 'client'),
    ],
  },
  {
    id: 'biz',
    code: 'BZ',
    name: 'Business',
    planLabel: 'Work',
    planTypes: ['LLC Organization', 'LLC Operating Agreement', 'Corporate Docs', 'Other'],
    stages: stages('Info Gathering', 'Initial Drafting', 'Check Please', 'Send Drafts', 'Client Review', 'Ready to Sign', 'Signing', 'Ready to Close', 'Closeout'),
    milestones: [
      ms('Engaged'),
      ms('Questionnaire Submitted'),
      ms('Questionnaire Discussion'),
      ms('Drafts Sent', ['Questionnaire Submitted', 5, 'workdays']),
      ms('Draft Discussion'),
      ms('Signing'),
      ms('Closed'),
    ],
    cadence: { soon: 10, followUp: 14 },
    feeSchedule: [{ milestoneId: 'drafts-sent', percent: 50 }, { milestoneId: 'signing', percent: 50 }],
    stageTasks: [
      task('Info Gathering', 'Name availability search', 'marcus', 1),
      task('Send Drafts', 'Send drafts and book review call', 'dana', 1),
      task('Signing', 'File articles; apply for EIN', 'marcus', 2, 'workdays', ['Articles filed', 'EIN obtained', 'Operating agreement signed']),
    ],
  },
  {
    id: 'fam',
    code: 'FL',
    name: 'Family Law',
    planLabel: 'Work',
    planTypes: ['Premarital', 'Postmarital', 'Divorce by Affidavit'],
    stages: stages('Info Gathering', 'Initial Drafting', 'Check Please', 'Send Drafts', 'Client Review', 'Ready to Sign', 'Signing', 'Remote Signing', 'Ready to Close', 'Closeout'),
    milestones: [
      ms('Engaged'),
      ms('Questionnaire Submitted'),
      ms('Questionnaire Discussion'),
      ms('Drafts Sent', ['Questionnaire Submitted', 5, 'workdays']),
      ms('Draft Discussion'),
      ms('Signing'),
      ms('Closed'),
    ],
    cadence: { soon: 10, followUp: 14 },
    feeSchedule: [{ milestoneId: 'drafts-sent', percent: 50 }, { milestoneId: 'signing', percent: 50 }],
    stageTasks: [
      task('Send Drafts', 'Send drafts to client and opposing counsel', 'dana', 1),
      task('Signing', 'Arrange signing with both parties', 'dana', 3),
    ],
  },
];

// ---------- Date engine ----------

export const DAY = 86400000;

export function todayISO() {
  const t = new Date();
  return new Date(t.getTime() - t.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function parseDate(iso: string) {
  return new Date(iso.slice(0, 10) + 'T12:00:00');
}

export function toISO(d: Date) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number) {
  const d = parseDate(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

/** Adds days the office is open: skips weekends, federal holidays and the firm's other closed days. */
export function addWorkdays(iso: string, n: number) {
  const d = parseDate(iso);
  let left = n;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (isOpenDay(toISO(d))) left--;
  }
  return toISO(d);
}

export function daysBetween(a: string, b: string) {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / DAY);
}

export interface MilestoneState {
  done?: string; // date completed
  due?: string; // manual override of the due date
}

/** Due date for one milestone: manual override wins, otherwise the area's rule, otherwise none. */
export function dueFor(m: Milestone, states: Record<string, MilestoneState>): { date?: string; source: 'manual' | 'rule' | 'none'; waitingOn?: string } {
  const st = states[m.id];
  if (st?.due) return { date: st.due, source: 'manual' };
  if (!m.rule) return { source: 'none' };
  const base = states[m.rule.after]?.done;
  if (!base) return { source: 'rule', waitingOn: m.rule.after };
  const date = m.rule.unit === 'workdays' ? addWorkdays(base, m.rule.amount) : addDays(base, m.rule.amount);
  return { date, source: 'rule' };
}

export function ruleText(rule: DueRule, area: PracticeArea) {
  const after = area.milestones.find((m) => m.id === rule.after)?.name ?? '(deleted milestone)';
  return `${rule.amount} ${rule.unit === 'workdays' ? 'workdays' : 'days'} after ${after}`;
}

export type ContactState = 'recent' | 'soon' | 'followup' | 'none';

export function contactState(lastContact: string | undefined, area: PracticeArea): ContactState {
  if (!lastContact) return 'none';
  const n = daysBetween(lastContact, todayISO());
  if (n >= area.cadence.followUp) return 'followup';
  if (n >= area.cadence.soon) return 'soon';
  return 'recent';
}

export const CONTACT_LABEL: Record<ContactState, string> = {
  recent: 'Recent contact',
  soon: 'Contact soon',
  followup: 'Follow-up needed',
  none: 'Never contacted',
};

// ---------- Matter numbering ----------

export interface Numbering {
  format: string; // tokens: {YYYY} {YY} {AREA} {CLIENT} {SEQ}
  digits: number; // zero-padding for {SEQ}
  scope: 'firm' | 'year' | 'area' | 'area-year'; // what the sequence counts within
  start: number;
  counters: Record<string, number>; // last number used per scope key
}

export const DEFAULT_NUMBERING: Numbering = { format: '{YYYY}-{SEQ}', digits: 4, scope: 'year', start: 101, counters: {} };

function scopeKey(n: Numbering, areaId: string, year: string) {
  return n.scope === 'firm' ? 'firm' : n.scope === 'year' ? year : n.scope === 'area' ? areaId : `${areaId}-${year}`;
}

export function renderNumber(n: Numbering, seq: number, area: PracticeArea | undefined, clientLast: string, date = todayISO()) {
  return n.format
    .replace(/\{YYYY\}/g, date.slice(0, 4))
    .replace(/\{YY\}/g, date.slice(2, 4))
    .replace(/\{AREA\}/g, area?.code || (area?.name ?? 'GEN').slice(0, 3).toUpperCase())
    .replace(/\{CLIENT\}/g, clientLast.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 10))
    .replace(/\{SEQ\}/g, String(seq).padStart(n.digits, '0'));
}

/** Next number for a new matter, and the counters to save. `existingMax` seeds a scope that has no counter yet. */
export function nextNumber(n: Numbering, area: PracticeArea | undefined, clientLast: string, existingMax = 0) {
  const date = todayISO();
  const key = scopeKey(n, area?.id ?? 'x', date.slice(0, 4));
  const seq = Math.max(n.counters[key] ?? 0, existingMax, n.start - 1) + 1;
  return { number: renderNumber(n, seq, area, clientLast, date), counters: { ...n.counters, [key]: seq } };
}
