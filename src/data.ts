// Domain model + sample data. Everything hangs off the Matter.

export type Stage = 'intake' | 'consult' | 'engaged' | 'active' | 'waiting' | 'wrapup';

export const STAGES: { id: Stage; label: string; clientLabel: string }[] = [
  { id: 'intake', label: 'Intake', clientLabel: 'Getting started' },
  { id: 'consult', label: 'Consult booked', clientLabel: 'Consultation' },
  { id: 'engaged', label: 'Engaged', clientLabel: 'Engagement signed' },
  { id: 'active', label: 'In progress', clientLabel: 'Work in progress' },
  { id: 'waiting', label: 'Waiting on client', clientLabel: 'We need something from you' },
  { id: 'wrapup', label: 'Wrap-up', clientLabel: 'Finishing up' },
];

export type BillingArrangement =
  | { kind: 'hourly'; rate: number }
  | { kind: 'flat'; amount: number }
  | { kind: 'hybrid'; amount: number; rate: number; covers: string };

export interface Matter {
  id: string;
  number: string;
  name: string;
  clientId: string;
  area: string;
  stage: Stage;
  owner: string;
  billing: BillingArrangement;
  priority: 'high' | 'normal' | 'low';
  nextDeadline?: string; // ISO date
  opened: string;
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

export const TEAM = [
  { id: 'me', name: 'You', initials: 'YO', role: 'Attorney', rate: 350 },
  { id: 'dana', name: 'Dana Ruiz', initials: 'DR', role: 'Paralegal', rate: 150 },
  { id: 'marcus', name: 'Marcus Lee', initials: 'ML', role: 'Associate', rate: 250 },
];

export const teamName = (id: string) => TEAM.find((t) => t.id === id)?.name ?? id;
export const teamInitials = (id: string) => TEAM.find((t) => t.id === id)?.initials ?? '?';

// Dates are relative to today so the sample always looks current.
const DAY = 86400000;
const today = new Date();
today.setHours(0, 0, 0, 0);
const d = (offsetDays: number, hour = 9, minute = 0) => {
  const x = new Date(today.getTime() + offsetDays * DAY);
  x.setHours(hour, minute, 0, 0);
  return x.toISOString();
};
const date = (offsetDays: number) => d(offsetDays).slice(0, 10);

export const clients: Client[] = [
  { id: 'c1', name: 'Harper & Vale LLC', email: 'ops@harpervale.example', phone: '(555) 201-4410' },
  { id: 'c2', name: 'Theresa Okafor', email: 'tokafor@example.com', phone: '(555) 318-2290' },
  { id: 'c3', name: 'Ben & Lucy Whitford', email: 'whitfords@example.com', phone: '(555) 440-1187' },
  { id: 'c4', name: 'Coastal Roofing Co.', email: 'admin@coastalroof.example', phone: '(555) 602-7731' },
  { id: 'c5', name: 'Miguel Santos', email: 'msantos@example.com', phone: '(555) 775-0034' },
  { id: 'c6', name: 'Priya Nair', email: 'pnair@example.com', phone: '(555) 889-5120' },
  { id: 'c7', name: 'Greenline Dental PLLC', email: 'office@greenline.example', phone: '(555) 230-9981' },
];

export const matters: Matter[] = [
  { id: 'm1', number: '2026-0131', name: 'Commercial lease review', clientId: 'c1', area: 'Business', stage: 'active', owner: 'me', billing: { kind: 'hourly', rate: 350 }, priority: 'high', nextDeadline: date(2), opened: date(-21) },
  { id: 'm2', number: '2026-0137', name: 'Okafor estate plan', clientId: 'c2', area: 'Estate planning', stage: 'waiting', owner: 'me', billing: { kind: 'flat', amount: 2800 }, priority: 'normal', nextDeadline: date(6), opened: date(-14) },
  { id: 'm3', number: '2026-0139', name: 'Whitford home purchase', clientId: 'c3', area: 'Real estate', stage: 'active', owner: 'marcus', billing: { kind: 'flat', amount: 1450 }, priority: 'high', nextDeadline: date(1), opened: date(-10) },
  { id: 'm4', number: '2026-0142', name: 'Coastal Roofing v. Dunmore', clientId: 'c4', area: 'Litigation', stage: 'active', owner: 'me', billing: { kind: 'hourly', rate: 375 }, priority: 'high', nextDeadline: date(0), opened: date(-40) },
  { id: 'm5', number: '2026-0144', name: 'Santos LLC formation', clientId: 'c5', area: 'Business', stage: 'engaged', owner: 'marcus', billing: { kind: 'hybrid', amount: 950, rate: 250, covers: 'Formation, operating agreement, EIN' }, priority: 'normal', nextDeadline: date(9), opened: date(-3) },
  { id: 'm6', number: '—', name: 'Nair: contract dispute inquiry', clientId: 'c6', area: 'Litigation', stage: 'consult', owner: 'me', billing: { kind: 'hourly', rate: 350 }, priority: 'normal', nextDeadline: date(1), opened: date(-1) },
  { id: 'm7', number: '—', name: 'Greenline Dental: employment policies', clientId: 'c7', area: 'Employment', stage: 'intake', owner: 'dana', billing: { kind: 'flat', amount: 3500 }, priority: 'low', opened: date(0) },
  { id: 'm8', number: '2026-0118', name: 'Harper & Vale trademark filing', clientId: 'c1', area: 'IP', stage: 'wrapup', owner: 'marcus', billing: { kind: 'flat', amount: 1200 }, priority: 'low', nextDeadline: date(12), opened: date(-60) },
];

export const timeEntries: TimeEntry[] = [
  { id: 't1', matterId: 'm1', date: date(-2), actualMinutes: 47, description: 'Review landlord redlines to sections 4–9; flag CAM reconciliation language', user: 'me', billable: true, invoiced: false, source: 'timer' },
  { id: 't2', matterId: 'm1', date: date(-1), actualMinutes: 13, description: 'Call with client re: renewal option and personal guaranty', user: 'me', billable: true, invoiced: false, source: 'call' },
  { id: 't3', matterId: 'm4', date: date(-1), actualMinutes: 128, description: 'Draft opposition to motion to dismiss, argument section II', user: 'me', billable: true, invoiced: false, source: 'timer' },
  { id: 't4', matterId: 'm4', date: date(-3), actualMinutes: 54, description: 'Legal research: economic loss doctrine, construction contracts', user: 'marcus', billable: true, invoiced: false, source: 'manual' },
  { id: 't5', matterId: 'm4', date: date(-5), actualMinutes: 4, description: 'Email opposing counsel re: deposition dates', user: 'me', billable: true, invoiced: false, source: 'manual' },
  { id: 't6', matterId: 'm5', date: date(-1), actualMinutes: 38, description: 'Additional drafting: buy-sell provisions (outside flat-fee scope)', user: 'marcus', billable: true, invoiced: false, source: 'manual' },
  { id: 't7', matterId: 'm2', date: date(-4), actualMinutes: 62, description: 'Draft revocable trust and pour-over will', user: 'me', billable: false, invoiced: false, source: 'timer' },
  { id: 't8', matterId: 'm3', date: date(-2), actualMinutes: 22, description: 'Title commitment review', user: 'dana', billable: false, invoiced: false, source: 'manual' },
];

export const flatFees: FlatFee[] = [
  { id: 'f1', matterId: 'm2', description: 'Estate plan package (trust, will, POAs, healthcare directive)', amount: 2800, status: 'invoiced' },
  { id: 'f2', matterId: 'm3', description: 'Residential purchase: contract through closing', amount: 1450, status: 'unbilled' },
  { id: 'f3', matterId: 'm5', description: 'LLC formation package', amount: 950, status: 'paid' },
  { id: 'f4', matterId: 'm8', description: 'Trademark application (one class)', amount: 1200, status: 'paid' },
];

export const reminders: Reminder[] = [
  { id: 'r1', title: 'File opposition to motion to dismiss', matterId: 'm4', due: d(0, 17), assignee: 'me', escalateTo: 'marcus', kind: 'court', done: false, snoozes: 1, log: ['Reminded 7 days out', 'Reminded 3 days out', 'Snoozed 2h yesterday'] },
  { id: 'r2', title: 'Inspection contingency expires', matterId: 'm3', due: d(1, 17), assignee: 'marcus', escalateTo: 'me', kind: 'client', done: false, snoozes: 0, log: ['Reminded 5 days out'] },
  { id: 'r3', title: 'Send signed LOI back to landlord', matterId: 'm1', due: d(2, 12), assignee: 'me', kind: 'client', done: false, snoozes: 0, log: [] },
  { id: 'r4', title: 'Follow up: Okafor beneficiary designations', matterId: 'm2', due: d(-1, 10), assignee: 'dana', escalateTo: 'me', kind: 'internal', done: false, snoozes: 3, log: ['Reminded', 'Snoozed 1d', 'Snoozed 1d', 'Snoozed 1d', 'Escalated to You'] },
  { id: 'r5', title: 'Statute of limitations: Nair breach claim', matterId: 'm6', due: d(118, 9), assignee: 'me', kind: 'statute', done: false, snoozes: 0, log: [] },
  { id: 'r6', title: 'Annual report reminder to client', matterId: 'm5', due: d(9, 9), assignee: 'dana', kind: 'client', done: false, snoozes: 0, log: [] },
];

export const events: CalEvent[] = [
  { id: 'e1', title: 'Consult: Priya Nair', start: d(1, 10), minutes: 30, matterId: 'm6', kind: 'consult' },
  { id: 'e2', title: 'Status conference (Zoom)', start: d(0, 11), minutes: 30, matterId: 'm4', kind: 'court' },
  { id: 'e3', title: 'Lease walkthrough call', start: d(0, 14), minutes: 45, matterId: 'm1', kind: 'call' },
  { id: 'e4', title: 'Whitford closing prep', start: d(1, 15), minutes: 60, matterId: 'm3', kind: 'meeting' },
  { id: 'e5', title: 'Deep work: opposition brief', start: d(0, 8, 30), minutes: 120, matterId: 'm4', kind: 'block' },
  { id: 'e6', title: 'Okafor signing meeting', start: d(3, 13), minutes: 60, matterId: 'm2', kind: 'meeting' },
  { id: 'e7', title: 'Santos kickoff', start: d(2, 9, 30), minutes: 30, matterId: 'm5', kind: 'call' },
];

export const messages: Message[] = [
  { id: 'g1', channel: 'general', author: 'dana', text: 'Printer on 2 is fixed. Also: the Okafor originals are in the vault drawer.', at: d(0, 8, 12), clientVisible: false },
  { id: 'g2', channel: 'general', author: 'marcus', text: 'Heads up, I’m out Friday afternoon. Whitford closing is covered by Dana.', at: d(0, 9, 3), clientVisible: false },
  { id: 'i1', channel: 'intake', author: 'dana', text: 'Greenline Dental filled out the intake form. Conflict check is clean. Assigning to me for docs collection.', at: d(0, 9, 40), clientVisible: false },
  { id: 'm4a', channel: 'm4', author: 'marcus', text: 'Research memo on economic loss doctrine is in the Documents tab. The Third District case is our best authority.', at: d(-1, 16, 20), clientVisible: false },
  { id: 'm4b', channel: 'm4', author: 'me', text: 'Great, pulling it into section II now.', at: d(-1, 16, 45), clientVisible: false },
  { id: 'm4c', channel: 'm4', author: 'client', text: 'Do you need anything else from us before the filing?', at: d(-1, 11, 2), clientVisible: true },
  { id: 'm4d', channel: 'm4', author: 'me', text: 'We’re in good shape. Please send the change order log from June if you can find it.', at: d(-1, 11, 30), clientVisible: true },
  { id: 'm2a', channel: 'm2', author: 'me', text: 'Your draft documents are ready for review in the portal. The one thing we still need is your beneficiary designations for the 401(k).', at: d(-3, 15, 0), clientVisible: true },
  { id: 'm2b', channel: 'm2', author: 'dana', text: 'Third nudge sent. If nothing by Thursday I’ll call her.', at: d(-1, 10, 5), clientVisible: false },
  { id: 'm1a', channel: 'm1', author: 'client', text: 'Landlord says they can do 3% escalations instead of 4%. Worth taking?', at: d(0, 7, 50), clientVisible: true },
];

export const calls: CallLog[] = [
  { id: 'p1', matterId: 'm1', contact: 'Harper & Vale LLC', number: '(555) 201-4410', direction: 'in', at: d(-1, 15, 10), seconds: 781, logged: true },
  { id: 'p2', matterId: 'm4', contact: 'Opposing counsel (Dunmore)', number: '(555) 910-3321', direction: 'out', at: d(-2, 10, 40), seconds: 262, logged: false },
  { id: 'p3', contact: 'Unknown caller', number: '(555) 118-0042', direction: 'in', at: d(-2, 12, 5), seconds: 95, logged: false },
];

export const eventTypes: EventType[] = [
  { id: 'et1', name: 'New client consultation', minutes: 30, bufferBefore: 10, bufferAfter: 15, minNoticeHours: 24, dailyCap: 3, who: 'prospects', creates: 'Lead in Intake + conflict check', questions: ['What is your legal issue about?', 'Names of any other parties involved (for conflict check)', 'Any deadline you are aware of?'], active: true },
  { id: 'et2', name: 'Client check-in call', minutes: 20, bufferBefore: 0, bufferAfter: 10, minNoticeHours: 4, dailyCap: 6, who: 'clients', creates: 'Event on the matter + time entry draft', questions: ['What would you like to cover?'], active: true },
  { id: 'et3', name: 'Document signing', minutes: 60, bufferBefore: 15, bufferAfter: 15, minNoticeHours: 48, dailyCap: 2, who: 'clients', creates: 'Event on the matter + prep task for paralegal', questions: ['Will anyone else be attending?'], active: true },
];

export const documents: Record<string, { name: string; kind: string; shared: boolean; needsSignature?: boolean }[]> = {
  m1: [{ name: 'Lease – landlord redline v3.pdf', kind: 'PDF', shared: true }, { name: 'Issues list.docx', kind: 'DOCX', shared: false }],
  m2: [{ name: 'Revocable Trust – DRAFT.pdf', kind: 'PDF', shared: true, needsSignature: false }, { name: 'Pour-over Will – DRAFT.pdf', kind: 'PDF', shared: true }, { name: 'Engagement letter.pdf', kind: 'PDF', shared: true, needsSignature: false }],
  m4: [{ name: 'Complaint (filed).pdf', kind: 'PDF', shared: true }, { name: 'Motion to Dismiss (Dunmore).pdf', kind: 'PDF', shared: true }, { name: 'Research memo – economic loss.docx', kind: 'DOCX', shared: false }, { name: 'Opposition – working draft.docx', kind: 'DOCX', shared: false }],
  m5: [{ name: 'Engagement letter.pdf', kind: 'PDF', shared: true, needsSignature: true }, { name: 'Operating Agreement – DRAFT.docx', kind: 'DOCX', shared: false }],
};
