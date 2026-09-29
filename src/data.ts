// Domain model + sample data. Everything hangs off the Matter. All names below are fictional.
import { addDays, DEFAULT_AREAS, slug, todayISO, type MilestoneState } from './practice';

export type BillingArrangement =
  | { kind: 'hourly'; rate: number }
  | { kind: 'flat'; amount: number }
  | { kind: 'hybrid'; amount: number; rate: number; covers: string };

/** Who the matter is waiting on: a team member id, or someone outside the firm. */
export type Ball = string;
export const OUTSIDE_BALLS = [
  { id: 'client', name: 'Client' },
  { id: 'third', name: '3rd party' },
  { id: 'court', name: 'Court' },
];

export interface Closeout {
  financials: boolean;
  letterSent?: string;
  review?: 'Definitely' | 'Ask First' | 'Hell No';
  reviewRequested?: string;
}

export interface Matter {
  id: string;
  number: string;
  name: string;
  clientId: string;
  areaId: string;
  stageId: string;
  planType?: string;
  owner: string; // responsible attorney
  ball: Ball; // "Whose Ball"
  billing: BillingArrangement;
  priority: boolean;
  lastContact?: string;
  suspense?: string; // user-set tickler date
  suspenseNote?: string;
  milestones: Record<string, MilestoneState>;
  stalled: boolean;
  opened: string;
  closeout?: Closeout;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export interface TimeEntry {
  id: string;
  matterId: string;
  date: string;
  actualMinutes: number;
  description: string;
  user: string;
  billable: boolean;
  invoiced: boolean;
  source?: 'timer' | 'call' | 'manual' | 'meeting';
}

export interface FlatFee {
  id: string;
  matterId: string;
  description: string;
  amount: number;
  status: 'unbilled' | 'invoiced' | 'paid';
}

export interface Reminder {
  id: string;
  title: string;
  matterId?: string;
  due: string; // ISO datetime
  assignee: string;
  escalateTo?: string;
  kind: 'court' | 'statute' | 'client' | 'internal';
  done: boolean;
  snoozes: number;
  log: string[];
}

export interface CalEvent {
  id: string;
  title: string;
  start: string; // ISO datetime
  minutes: number;
  matterId?: string;
  pncId?: string;
  kind: 'consult' | 'court' | 'meeting' | 'call' | 'block';
}

export interface Message {
  id: string;
  channel: string; // 'general' | 'intake' | matterId
  author: string;
  text: string;
  at: string;
  clientVisible: boolean;
}

export interface CallLog {
  id: string;
  matterId?: string;
  contact: string;
  number: string;
  direction: 'in' | 'out';
  at: string;
  seconds: number;
  logged: boolean;
}

export interface EventType {
  id: string;
  name: string;
  minutes: number;
  bufferBefore: number;
  bufferAfter: number;
  minNoticeHours: number;
  dailyCap: number;
  who: 'prospects' | 'clients';
  creates: string;
  questions: string[];
  active: boolean;
}

// ---------- Intake (PNCs) ----------

export type PncStage = 'inquiry' | 'scheduled' | 'notes' | 'followup' | 'el' | 'hired' | 'future' | 'post' | 'lost';

export const PNC_STAGES: { id: PncStage; label: string; open: boolean }[] = [
  { id: 'inquiry', label: 'New inquiry', open: true },
  { id: 'scheduled', label: 'Consult scheduled', open: true },
  { id: 'notes', label: 'Pending notes', open: true },
  { id: 'followup', label: 'Active follow-up', open: true },
  { id: 'el', label: 'Engagement letter sent', open: true },
  { id: 'hired', label: 'Hired', open: false },
  { id: 'future', label: 'Specific future date', open: false },
  { id: 'post', label: 'Cadence finished', open: false },
  { id: 'lost', label: 'Lost', open: false },
];

export interface Pnc {
  id: string;
  name: string;
  phone: string;
  source: string;
  areaId?: string; // best guess at practice area
  stage: PncStage;
  firstContact: string;
  consultAt?: string; // ISO datetime
  elSent?: string;
  futureDate?: string;
  touches: Record<string, string>; // touch key -> date done
  owner: string;
  matterId?: string; // set once hired
}

export interface Cadences {
  scheduling: number[]; // days after first contact, until a consult is booked
  preConsult: number[]; // days before the consult (negative numbers)
  followUp: number[]; // days after the consult
  el: number[]; // days after the engagement letter goes out
}

export const DEFAULT_CADENCES: Cadences = {
  scheduling: [2, 4, 7, 14],
  preConsult: [-10, -4, -1],
  followUp: [2, 5, 8, 11, 14],
  el: [1, 3, 5, 7],
};

// ---------- Team ----------

export const TEAM = [
  { id: 'me', name: 'You', initials: 'YO', role: 'Managing Attorney', rate: 350 },
  { id: 'dana', name: 'Dana Ruiz', initials: 'DR', role: 'Paralegal', rate: 150 },
  { id: 'marcus', name: 'Marcus Lee', initials: 'ML', role: 'Associate', rate: 250 },
  { id: 'priya', name: 'Priya Shah', initials: 'PS', role: 'Probate Paralegal', rate: 150 },
];

export const teamName = (id: string) => TEAM.find((t) => t.id === id)?.name ?? OUTSIDE_BALLS.find((b) => b.id === id)?.name ?? id;
export const teamInitials = (id: string) =>
  TEAM.find((t) => t.id === id)?.initials ?? (id === 'client' ? 'CL' : id === 'third' ? '3P' : id === 'court' ? 'CT' : '?');
export const isOutside = (ball: string) => OUTSIDE_BALLS.some((b) => b.id === ball);

// ---------- Sample data (relative to today so it always looks current) ----------

const DAYMS = 86400000;
const today = new Date();
today.setHours(0, 0, 0, 0);
const at = (offsetDays: number, hour = 9, minute = 0) => {
  const x = new Date(today.getTime() + offsetDays * DAYMS);
  x.setHours(hour, minute, 0, 0);
  return x.toISOString();
};
const day = (offset: number) => addDays(todayISO(), offset);

const firstNames = ['Avery', 'Jordan', 'Morgan', 'Riley', 'Casey', 'Quinn', 'Harper', 'Rowan', 'Emerson', 'Sawyer', 'Hayden', 'Reese', 'Parker', 'Kendall', 'Blake', 'Drew', 'Elliot', 'Finley', 'Logan', 'Peyton', 'Sage', 'Tatum', 'Arden', 'Marlow'];
const lastNames = ['Whitford', 'Okafor', 'Castellano', 'Brennan', 'Nakamura', 'Delacroix', 'Abernathy', 'Lindqvist', 'Moreau', 'Halvorsen', 'Pemberton', 'Vasquez', 'Oyelaran', 'Fairbanks', 'Kowalczyk', 'Arceneaux', 'Hollingsworth', 'Mancuso', 'Engstrom', 'Calloway', 'Whitcombe', 'Tanaka', 'Ellery', 'Donahue'];

export const clients: Client[] = firstNames.map((f, i) => ({
  id: `c${i + 1}`,
  name: `${lastNames[i]}, ${f}`,
  email: `${f.toLowerCase()}.${lastNames[i].toLowerCase()}@example.com`,
  phone: `(555) ${String(200 + i * 17).padStart(3, '0')}-${String(1000 + i * 373).slice(-4)}`,
}));

type Seed = {
  c: number;
  area: string;
  stage: string;
  plan?: string;
  owner?: string;
  ball: string;
  contactAgo?: number;
  done: [string, number][]; // milestone name, days ago
  billing?: BillingArrangement;
  stalled?: boolean;
  priority?: boolean;
  suspense?: [number, string];
};

const seeds: Seed[] = [
  { c: 1, area: 'ep', stage: 'Client Review', plan: 'Couples Signature (Trust)', ball: 'client', contactAgo: 4, done: [['Engaged', 40], ['Questionnaire Sent', 39], ['Questionnaire Submitted', 25], ['Questionnaire Discussion', 22], ['Drafts Sent', 17]], billing: { kind: 'flat', amount: 3950 } },
  { c: 2, area: 'ep', stage: 'Initial Drafting', plan: 'Solo Signature (Trust)', ball: 'marcus', owner: 'marcus', contactAgo: 2, done: [['Engaged', 16], ['Questionnaire Sent', 15], ['Questionnaire Submitted', 8], ['Questionnaire Discussion', 6]], billing: { kind: 'flat', amount: 2950 }, priority: true },
  { c: 3, area: 'ep', stage: 'Info Gathering', plan: 'Couples Essential (Will)', ball: 'client', contactAgo: 12, done: [['Engaged', 20], ['Questionnaire Sent', 19]], billing: { kind: 'flat', amount: 1850 } },
  { c: 4, area: 'ep', stage: 'Signing', plan: 'Couples Select (Deluxe Trust)', ball: 'me', contactAgo: 1, done: [['Engaged', 70], ['Questionnaire Sent', 69], ['Questionnaire Submitted', 50], ['Questionnaire Discussion', 47], ['Drafts Sent', 43], ['Draft Discussion', 36], ['Final Docs Sent', 30]], billing: { kind: 'flat', amount: 5450 }, suspense: [1, 'Confirm signing witnesses'] },
  { c: 5, area: 'ep', stage: 'Check Please', plan: 'Solo Essential (Will)', ball: 'me', contactAgo: 6, done: [['Engaged', 14], ['Questionnaire Sent', 13], ['Questionnaire Submitted', 6], ['Questionnaire Discussion', 4]], billing: { kind: 'flat', amount: 1250 } },
  { c: 6, area: 'ep', stage: 'Client Review', plan: 'Couples Signature (Trust)', ball: 'client', contactAgo: 19, done: [['Engaged', 95], ['Questionnaire Sent', 94], ['Questionnaire Submitted', 70], ['Questionnaire Discussion', 66], ['Drafts Sent', 58]], billing: { kind: 'flat', amount: 3950 }, stalled: true },
  { c: 7, area: 'ep', stage: 'Ready to Close', plan: 'Solo Signature (Trust)', ball: 'dana', contactAgo: 3, done: [['Engaged', 88], ['Questionnaire Sent', 87], ['Questionnaire Submitted', 70], ['Questionnaire Discussion', 68], ['Drafts Sent', 62], ['Draft Discussion', 55], ['Final Docs Sent', 50], ['Signing', 5], ['Closed', 2]], billing: { kind: 'flat', amount: 2950 } },
  { c: 8, area: 'fpet', stage: 'Qualified', plan: 'Formal Probate', ball: 'priya', contactAgo: 8, done: [['Engaged', 120], ['Onboarding Call', 115], ['Petition Packet Submitted', 90], ['Qualified', 52], ['Notices Sent', 44]], billing: { kind: 'hourly', rate: 350 }, priority: true },
  { c: 9, area: 'fpet', stage: 'Inventory Submitted', plan: 'Formal Probate', ball: 'court', contactAgo: 16, done: [['Engaged', 240], ['Onboarding Call', 236], ['Petition Packet Submitted', 200], ['Qualified', 170], ['Notices Sent', 160], ['Inventory Submitted', 115]], billing: { kind: 'hourly', rate: 350 } },
  { c: 10, area: 'fpet', stage: 'Packet Submitted', plan: 'Formal Probate', ball: 'third', contactAgo: 23, done: [['Engaged', 45], ['Onboarding Call', 41], ['Petition Packet Submitted', 20]], billing: { kind: 'hourly', rate: 350 }, suspense: [0, 'Call clerk re: petition status'] },
  { c: 11, area: 'fpet', stage: 'Accounting Submitted', plan: 'Trust Administration', ball: 'client', contactAgo: 5, done: [['Engaged', 420], ['Onboarding Call', 415], ['Petition Packet Submitted', 400], ['Qualified', 380], ['Notices Sent', 372], ['Inventory Submitted', 320], ['Accounting 1 Submitted', 10]], billing: { kind: 'hourly', rate: 350 } },
  { c: 12, area: 'ipet', stage: 'Docs Recorded', plan: 'Informal Probate', ball: 'priya', contactAgo: 9, done: [['Engaged', 50], ['Onboarding Call', 47], ['Packet Submitted', 30], ['Docs Recorded', 13]], billing: { kind: 'flat', amount: 3500 } },
  { c: 13, area: 'ipet', stage: 'Info Gathering', plan: 'Small Estate', ball: 'client', contactAgo: 15, done: [['Engaged', 18], ['Onboarding Call', 14]], billing: { kind: 'flat', amount: 1800 } },
  { c: 14, area: 'gc', stage: 'Hearing Scheduled', plan: 'Guardianship', ball: 'court', contactAgo: 11, done: [['Engaged', 80], ['Questionnaire Submitted', 70], ['First Filing', 58], ['Second Filing', 30]], billing: { kind: 'hourly', rate: 350 }, suspense: [6, 'Hearing prep call with petitioner'] },
  { c: 15, area: 'gc', stage: 'Info Gathering', plan: 'GAL', ball: 'dana', contactAgo: 22, done: [['Engaged', 9]], billing: { kind: 'hourly', rate: 250 } },
  { c: 16, area: 'gc', stage: 'Draft Stage 1', plan: 'Conservatorship', ball: 'marcus', owner: 'marcus', contactAgo: 4, done: [['Engaged', 30], ['Questionnaire Submitted', 16]], billing: { kind: 'hourly', rate: 350 } },
  { c: 17, area: 'deed', stage: 'Drafting', plan: 'RTODD', ball: 'dana', contactAgo: 2, done: [['Engaged', 8], ['Have Info', 5]], billing: { kind: 'flat', amount: 650 } },
  { c: 18, area: 'deed', stage: 'Ready to Sign', plan: 'QCD', ball: 'client', contactAgo: 6, done: [['Engaged', 21], ['Have Info', 18], ['Drafted', 15], ['Approved', 12]], billing: { kind: 'flat', amount: 650 } },
  { c: 19, area: 'deed', stage: 'Signed', plan: 'Gift', ball: 'dana', contactAgo: 1, done: [['Engaged', 25], ['Have Info', 22], ['Drafted', 19], ['Approved', 16], ['Signed', 3]], billing: { kind: 'flat', amount: 650 } },
  { c: 20, area: 'biz', stage: 'Info Gathering', plan: 'LLC Organization', ball: 'client', owner: 'marcus', contactAgo: 13, done: [['Engaged', 15]], billing: { kind: 'hybrid', amount: 950, rate: 250, covers: 'Articles, operating agreement, EIN' } },
  { c: 21, area: 'biz', stage: 'Client Review', plan: 'LLC Operating Agreement', ball: 'client', owner: 'marcus', contactAgo: 8, done: [['Engaged', 30], ['Questionnaire Submitted', 22], ['Questionnaire Discussion', 20], ['Drafts Sent', 14]], billing: { kind: 'flat', amount: 1500 } },
  { c: 22, area: 'fam', stage: 'Initial Drafting', plan: 'Premarital', ball: 'me', contactAgo: 3, done: [['Engaged', 12], ['Questionnaire Submitted', 3]], billing: { kind: 'flat', amount: 2500 }, priority: true },
];

export const matters: Matter[] = seeds.map((s, i) => {
  const area = DEFAULT_AREAS.find((a) => a.id === s.area)!;
  const milestones: Record<string, MilestoneState> = {};
  for (const [name, ago] of s.done) milestones[slug(name)] = { done: day(-ago) };
  const engaged = s.done.find(([n]) => n === 'Engaged')?.[1] ?? 0;
  const label = area.id === 'ep' ? 'Estate Plan' : area.id === 'gc' ? (s.plan ?? 'Guardianship') : area.id === 'fpet' || area.id === 'ipet' ? 'Estate' : s.plan ?? area.name;
  return {
    id: `m${i + 1}`,
    number: `2026-${String(101 + i).padStart(4, '0')}`,
    name: `${clients[s.c - 1].name.split(',')[0]} ${label}`,
    clientId: `c${s.c}`,
    areaId: s.area,
    stageId: slug(s.stage),
    planType: s.plan,
    owner: s.owner ?? 'me',
    ball: s.ball,
    billing: s.billing ?? { kind: 'hourly', rate: 350 },
    priority: !!s.priority,
    lastContact: s.contactAgo !== undefined ? day(-s.contactAgo) : undefined,
    suspense: s.suspense ? day(s.suspense[0]) : undefined,
    suspenseNote: s.suspense?.[1],
    milestones,
    stalled: !!s.stalled,
    opened: day(-engaged),
  };
});

export const pncs: Pnc[] = [
  { id: 'p1', name: 'Rivera, Logan', phone: '(555) 410-2231', source: 'Website form', areaId: 'ep', stage: 'inquiry', firstContact: day(-4), touches: { 's:2': day(-2) }, owner: 'dana' },
  { id: 'p2', name: 'Osei, Peyton', phone: '(555) 410-8820', source: 'Referral: past client', areaId: 'fpet', stage: 'inquiry', firstContact: day(-1), touches: {}, owner: 'dana' },
  { id: 'p3', name: 'Lindgren, Sage', phone: '(555) 410-1177', source: 'Google', areaId: 'ep', stage: 'scheduled', firstContact: day(-6), consultAt: at(4, 10), touches: { 'c:-10': day(-6) }, owner: 'me' },
  { id: 'p4', name: 'Pacheco, Tatum', phone: '(555) 410-6604', source: 'Seminar', areaId: 'ep', stage: 'scheduled', firstContact: day(-9), consultAt: at(1, 14), touches: { 'c:-10': day(-9), 'c:-4': day(-3) }, owner: 'me' },
  { id: 'p5', name: 'Byrne, Arden', phone: '(555) 410-3390', source: 'Website form', areaId: 'gc', stage: 'notes', firstContact: day(-12), consultAt: at(-1, 11), touches: {}, owner: 'me' },
  { id: 'p6', name: 'Hartmann, Marlow', phone: '(555) 410-5512', source: 'Referral: financial advisor', areaId: 'ep', stage: 'followup', firstContact: day(-20), consultAt: at(-5, 15), touches: { 'f:2': day(-3) }, owner: 'me' },
  { id: 'p7', name: 'Iwu, Blake', phone: '(555) 410-7745', source: 'Google', areaId: 'deed', stage: 'followup', firstContact: day(-15), consultAt: at(-8, 9, 30), touches: { 'f:2': day(-6), 'f:5': day(-3) }, owner: 'dana' },
  { id: 'p8', name: 'Sato, Drew', phone: '(555) 410-9001', source: 'Referral: past client', areaId: 'ep', stage: 'el', firstContact: day(-18), consultAt: at(-9, 13), elSent: day(-3), touches: { 'f:2': day(-7), 'e:1': day(-2) }, owner: 'me' },
  { id: 'p9', name: 'Keane, Finley', phone: '(555) 410-2468', source: 'Website form', areaId: 'biz', stage: 'future', firstContact: day(-40), consultAt: at(-30, 10), futureDate: day(45), touches: {}, owner: 'marcus' },
  { id: 'p10', name: 'Molina, Reese', phone: '(555) 410-1357', source: 'Google', areaId: 'ep', stage: 'lost', firstContact: day(-35), consultAt: at(-28, 10), touches: {}, owner: 'me' },
];

export const timeEntries: TimeEntry[] = [
  { id: 't1', matterId: 'm8', date: day(-2), actualMinutes: 47, description: 'Review creditor claims; calendar objection deadline', user: 'me', billable: true, invoiced: false, source: 'timer' },
  { id: 't2', matterId: 'm8', date: day(-1), actualMinutes: 13, description: 'Call with personal representative re: inventory values', user: 'me', billable: true, invoiced: false, source: 'call' },
  { id: 't3', matterId: 'm14', date: day(-1), actualMinutes: 128, description: 'Draft petition and proposed order; prepare hearing notice', user: 'me', billable: true, invoiced: false, source: 'timer' },
  { id: 't4', matterId: 'm14', date: day(-3), actualMinutes: 54, description: 'Research: least restrictive alternatives', user: 'marcus', billable: true, invoiced: false, source: 'manual' },
  { id: 't5', matterId: 'm9', date: day(-5), actualMinutes: 4, description: 'Email to clerk re: inventory acceptance', user: 'me', billable: true, invoiced: false, source: 'manual' },
  { id: 't6', matterId: 'm20', date: day(-1), actualMinutes: 38, description: 'Buy-sell provisions (outside flat-fee scope)', user: 'marcus', billable: true, invoiced: false, source: 'manual' },
  { id: 't7', matterId: 'm1', date: day(-4), actualMinutes: 62, description: 'Draft revocable trust and pour-over wills', user: 'me', billable: false, invoiced: false, source: 'timer' },
  { id: 't8', matterId: 'm17', date: day(-2), actualMinutes: 22, description: 'Title search review', user: 'dana', billable: false, invoiced: false, source: 'manual' },
];

export const flatFees: FlatFee[] = [
  { id: 'f1', matterId: 'm1', description: 'Couples Signature (Trust) Plan', amount: 3950, status: 'invoiced' },
  { id: 'f2', matterId: 'm17', description: 'RTODD deed: prepare, sign, record', amount: 650, status: 'unbilled' },
  { id: 'f3', matterId: 'm20', description: 'LLC formation package', amount: 950, status: 'paid' },
  { id: 'f4', matterId: 'm12', description: 'Informal probate administration', amount: 3500, status: 'paid' },
  { id: 'f5', matterId: 'm2', description: 'Solo Signature (Trust) Plan', amount: 2950, status: 'unbilled' },
];

export const reminders: Reminder[] = [
  { id: 'r1', title: 'File petition response', matterId: 'm14', due: at(0, 17), assignee: 'me', escalateTo: 'marcus', kind: 'court', done: false, snoozes: 1, log: ['Reminded 7 days out', 'Reminded 3 days out', 'Snoozed 2h yesterday'] },
  { id: 'r2', title: 'Creditor claim period ends', matterId: 'm8', due: at(38, 17), assignee: 'priya', escalateTo: 'me', kind: 'court', done: false, snoozes: 0, log: [] },
  { id: 'r3', title: 'Send recorded deed to client', matterId: 'm19', due: at(2, 12), assignee: 'dana', kind: 'client', done: false, snoozes: 0, log: [] },
  { id: 'r4', title: 'Chase signed beneficiary forms', matterId: 'm6', due: at(-1, 10), assignee: 'dana', escalateTo: 'me', kind: 'internal', done: false, snoozes: 3, log: ['Reminded', 'Snoozed 1d', 'Snoozed 1d', 'Snoozed 1d', 'Escalated to You'] },
];

export const events: CalEvent[] = [
  { id: 'e1', title: 'Consult: Pacheco', start: at(1, 14), minutes: 60, pncId: 'p4', kind: 'consult' },
  { id: 'e1b', title: 'Consult: Lindgren', start: at(4, 10), minutes: 60, pncId: 'p3', kind: 'consult' },
  { id: 'e2', title: 'Guardianship hearing (Zoom)', start: at(7, 11), minutes: 30, matterId: 'm14', kind: 'court' },
  { id: 'e3', title: 'Draft review call', start: at(0, 14), minutes: 45, matterId: 'm1', kind: 'call' },
  { id: 'e4', title: 'Signing ceremony', start: at(1, 15), minutes: 60, matterId: 'm4', kind: 'meeting' },
  { id: 'e5', title: 'Drafting block', start: at(0, 8, 30), minutes: 120, matterId: 'm2', kind: 'block' },
];

export const messages: Message[] = [
  { id: 'g1', channel: 'general', author: 'dana', text: 'Originals for tomorrow’s signing are in the vault drawer.', at: at(0, 8, 12), clientVisible: false },
  { id: 'i1', channel: 'intake', author: 'dana', text: 'New website inquiry, probate. Conflict check clean. Trying to book a consult.', at: at(-1, 9, 40), clientVisible: false },
  { id: 'm1a', channel: 'm1', author: 'client', text: 'We got the drafts. Can we change the successor trustee order?', at: at(-1, 11, 2), clientVisible: true },
  { id: 'm1b', channel: 'm1', author: 'me', text: 'Yes, easy change. We’ll walk through it on the review call.', at: at(-1, 11, 30), clientVisible: true },
  { id: 'm1c', channel: 'm1', author: 'marcus', text: 'Trustee order change noted in the revision list.', at: at(-1, 16, 20), clientVisible: false },
];

export const calls: CallLog[] = [
  { id: 'c1', matterId: 'm8', contact: clients[7].name, number: clients[7].phone, direction: 'in', at: at(-1, 15, 10), seconds: 781, logged: true },
  { id: 'c2', matterId: 'm10', contact: 'Probate clerk', number: '(555) 910-3321', direction: 'out', at: at(-2, 10, 40), seconds: 262, logged: false },
  { id: 'c3', contact: 'Unknown caller', number: '(555) 118-0042', direction: 'in', at: at(-2, 12, 5), seconds: 95, logged: false },
];

export const eventTypes: EventType[] = [
  { id: 'et1', name: 'New client consultation', minutes: 60, bufferBefore: 10, bufferAfter: 15, minNoticeHours: 24, dailyCap: 3, who: 'prospects', creates: 'Prospect in Intake with pre-consult reminders', questions: ['What can we help you with?', 'Names of any other people involved (for conflict check)', 'Any deadline you are aware of?'], active: true },
  { id: 'et2', name: 'Client check-in call', minutes: 20, bufferBefore: 0, bufferAfter: 10, minNoticeHours: 4, dailyCap: 6, who: 'clients', creates: 'Event on the matter, logged as client contact', questions: ['What would you like to cover?'], active: true },
  { id: 'et3', name: 'Signing ceremony', minutes: 60, bufferBefore: 15, bufferAfter: 15, minNoticeHours: 48, dailyCap: 2, who: 'clients', creates: 'Event on the matter + prep task for paralegal', questions: ['Will anyone else be attending?'], active: true },
];

export const documents: Record<string, { name: string; kind: string; shared: boolean; needsSignature?: boolean }[]> = {
  m1: [{ name: 'Trust – DRAFT v2.pdf', kind: 'PDF', shared: true }, { name: 'Pour-over Wills – DRAFT.pdf', kind: 'PDF', shared: true }, { name: 'Revision list.docx', kind: 'DOCX', shared: false }],
  m8: [{ name: 'Letters of Administration.pdf', kind: 'PDF', shared: true }, { name: 'Inventory worksheet.xlsx', kind: 'XLSX', shared: false }],
  m20: [{ name: 'Engagement letter.pdf', kind: 'PDF', shared: true, needsSignature: true }, { name: 'Operating Agreement – DRAFT.docx', kind: 'DOCX', shared: false }],
};
