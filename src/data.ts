// Domain model + sample data. All names below are fictional.
//
// Three kinds of records:
//   Contacts       people and organizations, stored once
//   PNC matters    prospects (potential new clients), first call → hired / not hired
//   Client matters engaged work, open or former (closed)
// Contacts attach to PNC matters and Client matters through Parties, each with a role.
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

export interface Note {
  id: string;
  at: string; // ISO datetime
  author: string;
  text: string;
  pinned?: boolean;
}

export interface Contact {
  id: string;
  name: string; // "Last, First" for people; plain name for organizations
  kind: 'person' | 'org';
  phone: string;
  email: string;
  address?: string;
  aka?: string; // maiden names, nicknames: searched by conflict checks
  notes: Note[];
}
/** Kept for older screens: the primary client contact on a matter. */
export type Client = Contact;

/** Which side of a matter a role is on. Drives conflict-check severity. */
export type RoleSide = 'client' | 'adverse' | 'neutral';
export interface Role {
  id: string;
  name: string;
  side: RoleSide;
}

export const DEFAULT_ROLES: Role[] = [
  { id: 'client', name: 'Client', side: 'client' },
  { id: 'spouse', name: 'Spouse / Partner', side: 'client' },
  { id: 'pr', name: 'Personal Representative', side: 'client' },
  { id: 'trustee', name: 'Trustee', side: 'client' },
  { id: 'petitioner', name: 'Petitioner', side: 'client' },
  { id: 'beneficiary', name: 'Beneficiary / Heir', side: 'neutral' },
  { id: 'decedent', name: 'Decedent', side: 'neutral' },
  { id: 'ward', name: 'Ward / Protected Person', side: 'neutral' },
  { id: 'opposing', name: 'Opposing Party', side: 'adverse' },
  { id: 'opp-counsel', name: 'Opposing Counsel', side: 'adverse' },
  { id: 'court', name: 'Court / Clerk', side: 'neutral' },
  { id: 'referral', name: 'Referral Source', side: 'neutral' },
  { id: 'advisor', name: 'Financial Advisor / CPA', side: 'neutral' },
  { id: 'other', name: 'Other', side: 'neutral' },
];

export interface Party {
  contactId: string;
  role: string; // Role id
  primary?: boolean; // the main contact for the matter
}

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
  parties: Party[];
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
  status: 'open' | 'closed';
  closedOn?: string;
  closeout?: Closeout;
  notes: Note[];
  conflicts: ConflictCheck[];
  pncId?: string; // the PNC matter it came from
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

export interface InvoiceLine {
  date?: string;
  description: string;
  hours?: number;
  rate?: number;
  amount: number;
}

/** Draft → sent (portal, email or mail) → paid. Drafts can be deleted, which releases their time and fees. */
export interface Invoice {
  id: string;
  number: string;
  matterId: string;
  date: string;
  lines: InvoiceLine[];
  total: number;
  status: 'draft' | 'sent' | 'paid';
  sentVia?: 'portal' | 'email' | 'mail';
  sentAt?: string;
  paidAt?: string;
  timeEntryIds: string[];
  flatFeeIds: string[];
}

export interface FlatFee {
  id: string;
  matterId: string;
  description: string;
  amount: number;
  status: 'unbilled' | 'invoiced' | 'paid';
}

/**
 * Something someone has to do. Tasks nudge until done: limited snoozes, then the backup person is
 * brought in. Court and statute deadlines are tasks whose due date can never be snoozed or moved.
 */
export type TaskKind = 'internal' | 'client' | 'court' | 'statute';
export type TaskStatus = 'todo' | 'doing' | 'waiting-client' | 'waiting-third' | 'stuck' | 'done';
export const TASK_STATUSES: { id: TaskStatus; label: string; tone: '' | 'info' | 'warn' | 'danger' | 'ok' | 'accent' }[] = [
  { id: 'todo', label: 'Not started', tone: '' },
  { id: 'doing', label: 'Working on it', tone: 'info' },
  { id: 'waiting-client', label: 'Waiting on client', tone: 'warn' },
  { id: 'waiting-third', label: 'Waiting on 3rd party', tone: 'warn' },
  { id: 'stuck', label: 'Stuck', tone: 'danger' },
  { id: 'done', label: 'Done', tone: 'ok' },
];
export interface ChecklistItem {
  text: string;
  done: boolean;
}
export interface Task {
  id: string;
  title: string;
  matterId?: string;
  pncId?: string;
  due: string; // ISO datetime
  assignee: string;
  escalateTo?: string;
  kind: TaskKind;
  status: TaskStatus;
  done: boolean; // same as status === 'done'
  doneAt?: string;
  snoozes: number;
  log: string[];
  checklist: ChecklistItem[];
  source: 'manual' | 'stage';
  createdAt: string;
  comments?: Note[];
}
/** Kept for older code paths. */
export type Reminder = Task;

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

// ---------- PNC matters ----------

export type PncStage = 'inquiry' | 'scheduled' | 'notes' | 'followup' | 'el' | 'hired' | 'future' | 'post' | 'lost' | 'declined';

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
  { id: 'declined', label: 'Declined (conflict)', open: false },
];

/** What one match looked like when the check was run: kept as a record even if data changes later. */
export interface ConflictSnapshotHit {
  name: string;
  strength: 'exact' | 'likely' | 'possible';
  reason: string;
  severity: 0 | 1 | 2;
  on: string[]; // "Client · Brennan Estate Plan · Open matter"
}

/** A conflict check attached to a PNC matter or Client matter. Newest first in the list. */
export interface ConflictCheck {
  id: string;
  date: string;
  by: string;
  terms: string[]; // who was searched
  partyIds?: string[]; // contacts on the matter at the time (to spot people added later)
  hits: number;
  snapshot?: ConflictSnapshotHit[];
  result: 'clear' | 'waived' | 'conflict';
  note?: string;
}

export interface Pnc {
  id: string;
  title: string; // what it's about, e.g. "Estate plan inquiry"
  parties: Party[];
  source: string;
  areaId?: string;
  stage: PncStage;
  firstContact: string;
  consultAt?: string; // ISO datetime
  elSent?: string;
  futureDate?: string;
  touches: Record<string, string>; // touch key -> date done
  owner: string;
  matterId?: string; // set once hired
  conflicts: ConflictCheck[];
  notes: Note[];
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

export const teamName = (id: string) => TEAM.find((t) => t.id === id)?.name ?? OUTSIDE_BALLS.find((b) => b.id === id)?.name ?? (id === 'system' ? 'Docket' : id);
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
const note = (id: string, daysAgo: number, author: string, text: string, pinned = false): Note => ({ id, at: at(-daysAgo, 10 + (daysAgo % 6), 15), author, text, pinned });

const contactsList: Contact[] = [];
const person = (id: string, last: string, first: string, extra: Partial<Contact> = {}): Contact => {
  const c: Contact = {
    id,
    name: `${last}, ${first}`,
    kind: 'person',
    email: `${first.toLowerCase()}.${last.toLowerCase().replace(/[^a-z]/g, '')}@example.com`,
    phone: `(555) ${String(200 + ((id.length * 37 + last.length * 13 + first.length * 7) % 700)).padStart(3, '0')}-${String(1000 + ((last.charCodeAt(0) * 53 + first.charCodeAt(0) * 31 + id.length * 17) % 9000)).slice(-4)}`,
    notes: [],
    ...extra,
  };
  contactsList.push(c);
  return c;
};
const org = (id: string, name: string, phone: string, email: string): Contact => {
  const c: Contact = { id, name, kind: 'org', phone, email, notes: [] };
  contactsList.push(c);
  return c;
};

// Current clients (primary contacts on open matters)
const firstNames = ['Avery', 'Jordan', 'Morgan', 'Riley', 'Casey', 'Quinn', 'Harper', 'Rowan', 'Emerson', 'Sawyer', 'Hayden', 'Reese', 'Parker', 'Kendall', 'Blake', 'Drew', 'Elliot', 'Finley', 'Logan', 'Peyton', 'Sage', 'Tatum'];
const lastNames = ['Whitford', 'Okafor', 'Castellano', 'Brennan', 'Nakamura', 'Delacroix', 'Abernathy', 'Lindqvist', 'Moreau', 'Halvorsen', 'Pemberton', 'Vasquez', 'Oyelaran', 'Fairbanks', 'Kowalczyk', 'Arceneaux', 'Hollingsworth', 'Mancuso', 'Engstrom', 'Calloway', 'Whitcombe', 'Tanaka'];
firstNames.forEach((f, i) => person(`c${i + 1}`, lastNames[i], f));
contactsList.find((c) => c.id === 'c1')!.notes.push(note('n-c1', 30, 'me', 'Prefers text over phone calls. Works nights; best reached after 3pm.'));
contactsList.find((c) => c.id === 'c4')!.notes.push(note('n-c4', 60, 'dana', 'Brennan family: Riley is the oldest of four siblings. Mother’s estate is still open in another county.', true));

// Other people on open matters
person('x1', 'Whitford', 'Jamie', { aka: 'Jamie Sutter (maiden)' });
person('x2', 'Brennan', 'Alex');
person('x3', 'Delacroix', 'Sam');
person('x4', 'Lindqvist', 'Harold');
person('x5', 'Marsh', 'Evelyn');
person('x6', 'Pritchard', 'Owen');
org('x7', 'Pritchard & Cole LLP', '(555) 640-2200', 'intake@pritchardcole.example');
org('x8', 'Probate Division, Clerk of Court', '(555) 910-3321', 'probate@clerk.example');
person('x9', 'Halvorsen', 'Ingrid');
person('x10', 'Greer', 'Nadia');
org('x11', 'Greer Wealth Partners', '(555) 777-1030', 'office@greerwealth.example');

// PNC contacts
person('pc1', 'Rivera', 'Logan');
person('pc2', 'Osei', 'Peyton');
person('pc3', 'Lindgren', 'Sage');
person('pc4', 'Pacheco', 'Tatum');
person('pc5', 'Byrne', 'Arden');
person('pc6', 'Hartmann', 'Marlow');
person('pc7', 'Iwu', 'Blake');
person('pc8', 'Sato', 'Drew');
person('pc9', 'Keane', 'Finley');
person('pc10', 'Molina', 'Reese');
person('pc11', 'Osei', 'Kwame');
person('pc12', 'Byrne', 'Colleen');

// Former clients (closed matters) and their other parties
const formerSeeds: [string, string, string, number, string?][] = [
  // last, first, area, closed days ago, plan
  ['Rivera', 'Logan', 'ep', 820, 'Solo Essential (Will)'],
  ['Ashby', 'Marguerite', 'ep', 40, 'Couples Signature (Trust)'],
  ['Bellamy', 'Theo', 'deed', 55, 'RTODD'],
  ['Carrow', 'Nell', 'ep', 70, 'Solo Signature (Trust)'],
  ['Dunleavy', 'Pat', 'fpet', 95, 'Formal Probate'],
  ['Estrada', 'Luz', 'ep', 120, 'Couples Essential (Will)'],
  ['Fitzgerald', 'Rory', 'biz', 140, 'LLC Organization'],
  ['Goss', 'Wren', 'ep', 160, 'Solo Select (Deluxe Trust)'],
  ['Hadley', 'Corin', 'gc', 200, 'Guardianship'],
  ['Ibarra', 'Tomas', 'ep', 230, 'Couples Signature (Trust)'],
  ['Jansen', 'Mieke', 'deed', 260, 'QCD'],
  ['Kearney', 'Bram', 'ipet', 300, 'Informal Probate'],
  ['Laramie', 'Cole', 'ep', 330, 'Will Only'],
  ['Mbeki', 'Thandi', 'ep', 365, 'Couples Signature (Trust)'],
  ['Nygaard', 'Sol', 'fpet', 410, 'Formal Probate'],
  ['Ostrowski', 'Lena', 'ep', 450, 'Solo Signature (Trust)'],
  ['Pell', 'August', 'fam', 500, 'Premarital'],
  ['Quist', 'Ada', 'ep', 540, 'Couples Essential (Will)'],
  ['Rourke', 'Dev', 'deed', 600, 'Gift'],
  ['Stahl', 'Imogen', 'ep', 640, 'DPOA/AMD/HIPAA'],
  ['Trinh', 'Vy', 'ep', 700, 'Couples Signature (Trust)'],
  ['Ulloa', 'Marco', 'gc', 760, 'Conservatorship'],
  ['Vance', 'Odette', 'ep', 900, 'Solo Essential (Will)'],
  ['Wexler', 'Hal', 'biz', 980, 'Corporate Docs'],
  ['Yarrow', 'June', 'ep', 1100, 'Couples Signature (Trust)'],
  ['Zeller', 'Kip', 'ipet', 1200, 'Small Estate'],
];
const formerContactIds = formerSeeds.map(([last, first], i) => (last === 'Rivera' ? 'pc1' : person(`f${i + 1}`, last, first).id));
person('fx1', 'Dunleavy', 'Margo'); // estranged sibling who objected in the Dunleavy probate

export const contacts: Contact[] = contactsList;

// ---------- Open client matters ----------

type Seed = {
  c: string;
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
  more?: Party[];
  notes?: Note[];
};

const seeds: Seed[] = [
  { c: 'c1', area: 'ep', stage: 'Client Review', plan: 'Couples Signature (Trust)', ball: 'client', contactAgo: 4, done: [['Engaged', 40], ['Questionnaire Sent', 39], ['Questionnaire Submitted', 25], ['Questionnaire Discussion', 22], ['Drafts Sent', 17]], billing: { kind: 'flat', amount: 3950 },
    more: [{ contactId: 'x1', role: 'spouse' }, { contactId: 'x10', role: 'referral' }, { contactId: 'x11', role: 'advisor' }],
    notes: [note('n-m1a', 17, 'me', 'Drafts sent. Clients want to revisit successor trustee order; kids are 19 and 23.'), note('n-m1b', 30, 'dana', 'Funding: 2 brokerage accounts at Greer Wealth, house, rental condo. Deed for condo needed after signing.', true)] },
  { c: 'c2', area: 'ep', stage: 'Initial Drafting', plan: 'Solo Signature (Trust)', ball: 'marcus', owner: 'marcus', contactAgo: 2, done: [['Engaged', 16], ['Questionnaire Sent', 15], ['Questionnaire Submitted', 8], ['Questionnaire Discussion', 6]], billing: { kind: 'flat', amount: 2950 }, priority: true,
    notes: [note('n-m2', 6, 'marcus', 'Questionnaire call done. Wants a pet trust provision for two horses.')] },
  { c: 'c3', area: 'ep', stage: 'Info Gathering', plan: 'Couples Essential (Will)', ball: 'client', contactAgo: 12, done: [['Engaged', 20], ['Questionnaire Sent', 19]], billing: { kind: 'flat', amount: 1850 } },
  { c: 'c4', area: 'ep', stage: 'Signing', plan: 'Couples Select (Deluxe Trust)', ball: 'me', contactAgo: 1, done: [['Engaged', 70], ['Questionnaire Sent', 69], ['Questionnaire Submitted', 50], ['Questionnaire Discussion', 47], ['Drafts Sent', 43], ['Draft Discussion', 36], ['Final Docs Sent', 30]], billing: { kind: 'flat', amount: 5450 }, suspense: [1, 'Confirm signing witnesses'],
    more: [{ contactId: 'x2', role: 'spouse' }] },
  { c: 'c5', area: 'ep', stage: 'Check Please', plan: 'Solo Essential (Will)', ball: 'me', contactAgo: 6, done: [['Engaged', 14], ['Questionnaire Sent', 13], ['Questionnaire Submitted', 6], ['Questionnaire Discussion', 4]], billing: { kind: 'flat', amount: 1250 } },
  { c: 'c6', area: 'ep', stage: 'Client Review', plan: 'Couples Signature (Trust)', ball: 'client', contactAgo: 19, done: [['Engaged', 95], ['Questionnaire Sent', 94], ['Questionnaire Submitted', 70], ['Questionnaire Discussion', 66], ['Drafts Sent', 58]], billing: { kind: 'flat', amount: 3950 }, stalled: true,
    more: [{ contactId: 'x3', role: 'spouse' }], notes: [note('n-m6', 19, 'dana', 'Left voicemail and emailed. Third attempt. Spouse had surgery in August; may explain the delay.')] },
  { c: 'c7', area: 'ep', stage: 'Ready to Close', plan: 'Solo Signature (Trust)', ball: 'dana', contactAgo: 3, done: [['Engaged', 88], ['Questionnaire Sent', 87], ['Questionnaire Submitted', 70], ['Questionnaire Discussion', 68], ['Drafts Sent', 62], ['Draft Discussion', 55], ['Final Docs Sent', 50], ['Signing', 5], ['Closed', 2]], billing: { kind: 'flat', amount: 2950 } },
  { c: 'c8', area: 'fpet', stage: 'Qualified', plan: 'Formal Probate', ball: 'priya', contactAgo: 8, done: [['Engaged', 120], ['Onboarding Call', 115], ['Petition Packet Submitted', 90], ['Qualified', 52], ['Notices Sent', 44]], billing: { kind: 'hourly', rate: 350 }, priority: true,
    more: [{ contactId: 'x4', role: 'decedent' }, { contactId: 'x8', role: 'court' }], notes: [note('n-m8', 44, 'priya', 'Notice to creditors published. Claims period running.')] },
  { c: 'c9', area: 'fpet', stage: 'Inventory Submitted', plan: 'Formal Probate', ball: 'court', contactAgo: 16, done: [['Engaged', 240], ['Onboarding Call', 236], ['Petition Packet Submitted', 200], ['Qualified', 170], ['Notices Sent', 160], ['Inventory Submitted', 115]], billing: { kind: 'hourly', rate: 350 } },
  { c: 'c10', area: 'fpet', stage: 'Packet Submitted', plan: 'Formal Probate', ball: 'third', contactAgo: 23, done: [['Engaged', 45], ['Onboarding Call', 41], ['Petition Packet Submitted', 20]], billing: { kind: 'hourly', rate: 350 }, suspense: [0, 'Call clerk re: petition status'],
    more: [{ contactId: 'x9', role: 'decedent' }, { contactId: 'x6', role: 'opp-counsel' }, { contactId: 'x7', role: 'opp-counsel' }, { contactId: 'x5', role: 'opposing' }],
    notes: [note('n-m10', 20, 'me', 'Decedent’s partner (Evelyn Marsh) has objected through counsel, claims an interest in the lake house.', true)] },
  { c: 'c11', area: 'fpet', stage: 'Accounting Submitted', plan: 'Trust Administration', ball: 'client', contactAgo: 5, done: [['Engaged', 420], ['Onboarding Call', 415], ['Petition Packet Submitted', 400], ['Qualified', 380], ['Notices Sent', 372], ['Inventory Submitted', 320], ['Accounting 1 Submitted', 10]], billing: { kind: 'hourly', rate: 350 } },
  { c: 'c12', area: 'ipet', stage: 'Docs Recorded', plan: 'Informal Probate', ball: 'priya', contactAgo: 9, done: [['Engaged', 50], ['Onboarding Call', 47], ['Packet Submitted', 30], ['Docs Recorded', 13]], billing: { kind: 'flat', amount: 3500 } },
  { c: 'c13', area: 'ipet', stage: 'Info Gathering', plan: 'Small Estate', ball: 'client', contactAgo: 15, done: [['Engaged', 18], ['Onboarding Call', 14]], billing: { kind: 'flat', amount: 1800 } },
  { c: 'c14', area: 'gc', stage: 'Hearing Scheduled', plan: 'Guardianship', ball: 'court', contactAgo: 11, done: [['Engaged', 80], ['Questionnaire Submitted', 70], ['First Filing', 58], ['Second Filing', 30]], billing: { kind: 'hourly', rate: 350 }, suspense: [6, 'Hearing prep call with petitioner'] },
  { c: 'c15', area: 'gc', stage: 'Info Gathering', plan: 'GAL', ball: 'dana', contactAgo: 22, done: [['Engaged', 9]], billing: { kind: 'hourly', rate: 250 } },
  { c: 'c16', area: 'gc', stage: 'Draft Stage 1', plan: 'Conservatorship', ball: 'marcus', owner: 'marcus', contactAgo: 4, done: [['Engaged', 30], ['Questionnaire Submitted', 16]], billing: { kind: 'hourly', rate: 350 } },
  { c: 'c17', area: 'deed', stage: 'Drafting', plan: 'RTODD', ball: 'dana', contactAgo: 2, done: [['Engaged', 8], ['Have Info', 5]], billing: { kind: 'flat', amount: 650 } },
  { c: 'c18', area: 'deed', stage: 'Ready to Sign', plan: 'QCD', ball: 'client', contactAgo: 6, done: [['Engaged', 21], ['Have Info', 18], ['Drafted', 15], ['Approved', 12]], billing: { kind: 'flat', amount: 650 } },
  { c: 'c19', area: 'deed', stage: 'Signed', plan: 'Gift', ball: 'dana', contactAgo: 1, done: [['Engaged', 25], ['Have Info', 22], ['Drafted', 19], ['Approved', 16], ['Signed', 3]], billing: { kind: 'flat', amount: 650 } },
  { c: 'c20', area: 'biz', stage: 'Info Gathering', plan: 'LLC Organization', ball: 'client', owner: 'marcus', contactAgo: 13, done: [['Engaged', 15]], billing: { kind: 'hybrid', amount: 950, rate: 250, covers: 'Articles, operating agreement, EIN' } },
  { c: 'c21', area: 'biz', stage: 'Client Review', plan: 'LLC Operating Agreement', ball: 'client', owner: 'marcus', contactAgo: 8, done: [['Engaged', 30], ['Questionnaire Submitted', 22], ['Questionnaire Discussion', 20], ['Drafts Sent', 14]], billing: { kind: 'flat', amount: 1500 } },
  { c: 'c22', area: 'fam', stage: 'Initial Drafting', plan: 'Premarital', ball: 'me', contactAgo: 3, done: [['Engaged', 12], ['Questionnaire Submitted', 3]], billing: { kind: 'flat', amount: 2500 }, priority: true },
];

const label = (areaId: string, plan: string | undefined, fallback: string) =>
  areaId === 'ep' ? 'Estate Plan' : areaId === 'gc' ? (plan ?? 'Guardianship') : areaId === 'fpet' || areaId === 'ipet' ? 'Estate' : plan ?? fallback;

const openMatters: Matter[] = seeds.map((s, i) => {
  const area = DEFAULT_AREAS.find((a) => a.id === s.area)!;
  const milestones: Record<string, MilestoneState> = {};
  for (const [name, ago] of s.done) milestones[slug(name)] = { done: day(-ago) };
  const engaged = s.done.find(([n]) => n === 'Engaged')?.[1] ?? 0;
  const primary = contactsList.find((c) => c.id === s.c)!;
  const role = s.area === 'fpet' || s.area === 'ipet' ? 'pr' : s.area === 'gc' ? 'petitioner' : 'client';
  return {
    id: `m${i + 1}`,
    number: `2026-${String(101 + i).padStart(4, '0')}`,
    name: `${primary.name.split(',')[0]} ${label(s.area, s.plan, area.name)}`,
    parties: [{ contactId: s.c, role, primary: true }, ...(s.more ?? [])],
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
    status: 'open',
    notes: s.notes ?? [],
    conflicts: [],
  };
});

// ---------- Former client matters ----------

const formerMatters: Matter[] = formerSeeds.map(([last, , areaId, closedAgo, plan], i) => {
  const area = DEFAULT_AREAS.find((a) => a.id === areaId)!;
  const span = areaId === 'fpet' ? 220 : areaId === 'gc' ? 180 : areaId === 'deed' ? 35 : 85;
  const openedAgo = closedAgo + span;
  const year = new Date(day(-openedAgo)).getFullYear();
  const parties: Party[] = [{ contactId: formerContactIds[i], role: areaId === 'fpet' || areaId === 'ipet' ? 'pr' : areaId === 'gc' ? 'petitioner' : 'client', primary: true }];
  if (last === 'Dunleavy') parties.push({ contactId: 'fx1', role: 'opposing' });
  const lastStage = area.stages[area.stages.length - 1];
  return {
    id: `fm${i + 1}`,
    number: `${year}-${String(300 + i * 7).padStart(4, '0')}`,
    name: `${last} ${label(areaId, plan, area.name)}`,
    parties,
    areaId,
    stageId: lastStage.id,
    planType: plan,
    owner: i % 5 === 0 ? 'marcus' : 'me',
    ball: 'me',
    billing: { kind: 'flat', amount: 0 },
    priority: false,
    lastContact: day(-closedAgo),
    milestones: { engaged: { done: day(-openedAgo) }, closed: { done: day(-closedAgo) } },
    stalled: false,
    opened: day(-openedAgo),
    status: 'closed',
    closedOn: day(-closedAgo),
    closeout: { financials: true, letterSent: day(-closedAgo + 3), review: i % 4 === 0 ? 'Ask First' : 'Definitely', reviewRequested: i % 3 === 0 ? day(-closedAgo + 5) : undefined },
    conflicts: [],
    notes: last === 'Dunleavy' ? [note('n-fm-d', closedAgo + 30, 'me', 'Sister (Margo Dunleavy) contested the will; settled at mediation. Do not represent Margo in anything related.', true)] : [],
  };
});

export const matters: Matter[] = [...openMatters, ...formerMatters];

// ---------- PNC matters ----------

const pp = (id: string, role = 'client', primary = true): Party => ({ contactId: id, role, primary });

const pncSeeds: (Omit<Pnc, 'conflicts'> & { conflicts?: ConflictCheck[] })[] = [
  { id: 'p1', title: 'Update estate plan after divorce', parties: [pp('pc1')], source: 'Returning client', areaId: 'ep', stage: 'inquiry', firstContact: day(-4), touches: { 's:2': day(-2) }, owner: 'dana', notes: [note('n-p1', 4, 'dana', 'Former client (2024 will). Divorced last year, wants a trust now.')] },
  { id: 'p2', title: 'Probate of mother’s estate; sibling dispute', parties: [pp('pc2', 'pr'), pp('pc11', 'beneficiary', false), { contactId: 'c4', role: 'opposing' }], source: 'Referral: past client', areaId: 'fpet', stage: 'inquiry', firstContact: day(-1), touches: {}, owner: 'dana',
    notes: [note('n-p2', 1, 'dana', 'Caller says her cousin Riley Brennan is contesting the will. Ran conflict check. Needs attorney review before booking.')] },
  { id: 'p3', title: 'Trust for blended family', parties: [pp('pc3')], source: 'Google', areaId: 'ep', stage: 'scheduled', firstContact: day(-6), consultAt: at(4, 10), touches: { 'c:-10': day(-6) }, owner: 'me', notes: [], conflicts: [{ id: 'cc-seed-1', date: day(-6), by: 'dana', terms: ['Lindgren, Sage'], hits: 0, result: 'clear' }] },
  { id: 'p4', title: 'Wills and powers of attorney', parties: [pp('pc4')], source: 'Seminar', areaId: 'ep', stage: 'scheduled', firstContact: day(-9), consultAt: at(1, 14), touches: { 'c:-10': day(-9), 'c:-4': day(-3) }, owner: 'me', notes: [], conflicts: [{ id: 'cc-seed-2', date: day(-9), by: 'dana', terms: ['Pacheco, Tatum'], hits: 0, result: 'clear' }] },
  { id: 'p5', title: 'Guardianship of adult son', parties: [pp('pc5', 'petitioner'), pp('pc12', 'ward', false)], source: 'Website form', areaId: 'gc', stage: 'notes', firstContact: day(-12), consultAt: at(-1, 11), touches: {}, owner: 'me', notes: [], conflicts: [{ id: 'cc-seed-3', date: day(-12), by: 'dana', terms: ['Byrne, Arden', 'Byrne, Colleen'], hits: 0, result: 'clear' }] },
  { id: 'p6', title: 'Trust; rental properties', parties: [pp('pc6')], source: 'Referral: financial advisor', areaId: 'ep', stage: 'followup', firstContact: day(-20), consultAt: at(-5, 15), touches: { 'f:2': day(-3) }, owner: 'me', notes: [note('n-p6', 5, 'me', 'Good fit for Signature Trust. Quoted couples price. Wants to talk to spouse first.')], conflicts: [{ id: 'cc-seed-4', date: day(-20), by: 'dana', terms: ['Hartmann, Marlow'], hits: 0, result: 'clear' }] },
  { id: 'p7', title: 'Deed to add daughter', parties: [pp('pc7')], source: 'Google', areaId: 'deed', stage: 'followup', firstContact: day(-15), consultAt: at(-8, 9, 30), touches: { 'f:2': day(-6), 'f:5': day(-3) }, owner: 'dana', notes: [], conflicts: [{ id: 'cc-seed-5', date: day(-15), by: 'dana', terms: ['Iwu, Blake'], hits: 0, result: 'clear' }] },
  { id: 'p8', title: 'Estate plan, first home', parties: [pp('pc8')], source: 'Referral: past client', areaId: 'ep', stage: 'el', firstContact: day(-18), consultAt: at(-9, 13), elSent: day(-3), touches: { 'f:2': day(-7), 'e:1': day(-2) }, owner: 'me', notes: [], conflicts: [{ id: 'cc-seed-6', date: day(-18), by: 'dana', terms: ['Sato, Drew'], hits: 0, result: 'clear' }] },
  { id: 'p9', title: 'LLC for consulting business', parties: [pp('pc9')], source: 'Website form', areaId: 'biz', stage: 'future', firstContact: day(-40), consultAt: at(-30, 10), futureDate: day(45), touches: {}, owner: 'marcus', notes: [note('n-p9', 30, 'marcus', 'Launching in January. Call back mid-November.')], conflicts: [{ id: 'cc-seed-7', date: day(-40), by: 'dana', terms: ['Keane, Finley'], hits: 0, result: 'clear' }] },
  { id: 'p10', title: 'Will review', parties: [pp('pc10')], source: 'Google', areaId: 'ep', stage: 'lost', firstContact: day(-35), consultAt: at(-28, 10), touches: {}, owner: 'me', notes: [note('n-p10', 20, 'me', 'Went with an online service on price.')], conflicts: [{ id: 'cc-seed-8', date: day(-35), by: 'dana', terms: ['Molina, Reese'], hits: 0, result: 'clear' }] },
];

export const pncs: Pnc[] = pncSeeds.map((p) => ({
  ...p,
  conflicts: (p.conflicts ?? []).map((c) => ({ ...c, partyIds: p.parties.map((x) => x.contactId) })),
}));

// Every open and former matter carries the check from when it was opened.
// Two are left without one on purpose, and m1 has people added after its check, to show the warnings.
let ccN = 0;
for (const m of [...openMatters, ...formerMatters]) {
  if (m.id === 'm15' || m.id === 'm20') continue;
  const checked = m.id === 'm1' ? m.parties.slice(0, 2) : m.parties;
  m.conflicts.push({
    id: `cc-m-${++ccN}`,
    date: addDays(m.opened, -3),
    by: 'dana',
    terms: checked.map((x) => contactsList.find((c) => c.id === x.contactId)?.name ?? ''),
    partyIds: checked.map((x) => x.contactId),
    hits: m.id === 'm10' ? 1 : 0,
    snapshot: m.id === 'm10' ? [{ name: 'Marsh, Evelyn', strength: 'exact', reason: 'Appears on a firm matter', severity: 0, on: ['Opposing Party · (this matter, pre-engagement)'] }] : [],
    result: 'clear',
    note: m.id === 'm10' ? 'Opposing party is new to the firm. Clear.' : undefined,
  });
}

// ---------- Everything else (unchanged from v1, pointed at the new matters) ----------

export const timeEntries: TimeEntry[] = [
  { id: 't1', matterId: 'm8', date: day(-2), actualMinutes: 47, description: 'Review creditor claims; calendar objection deadline', user: 'me', billable: true, invoiced: false, source: 'timer' },
  { id: 't2', matterId: 'm8', date: day(-1), actualMinutes: 13, description: 'Call with personal representative re: inventory values', user: 'me', billable: true, invoiced: false, source: 'call' },
  { id: 't3', matterId: 'm14', date: day(-1), actualMinutes: 128, description: 'Draft petition and proposed order; prepare hearing notice', user: 'me', billable: true, invoiced: false, source: 'timer' },
  { id: 't4', matterId: 'm14', date: day(-3), actualMinutes: 54, description: 'Research: least restrictive alternatives', user: 'marcus', billable: true, invoiced: false, source: 'manual' },
  { id: 't5', matterId: 'm9', date: day(-5), actualMinutes: 4, description: 'Email to clerk re: inventory acceptance', user: 'me', billable: true, invoiced: false, source: 'manual' },
  { id: 't6', matterId: 'm20', date: day(-1), actualMinutes: 38, description: 'Buy-sell provisions (outside fixed-price scope)', user: 'marcus', billable: true, invoiced: false, source: 'manual' },
  { id: 't7', matterId: 'm1', date: day(-4), actualMinutes: 62, description: 'Draft revocable trust and pour-over wills', user: 'me', billable: false, invoiced: false, source: 'timer' },
  { id: 't8', matterId: 'm17', date: day(-2), actualMinutes: 22, description: 'Title search review', user: 'dana', billable: false, invoiced: false, source: 'manual' },
];

export const invoices: Invoice[] = [
  { id: 'inv1', number: 'INV-1042', matterId: 'm1', date: day(-12), lines: [{ description: 'Couples Signature (Trust) Plan', amount: 3950 }], total: 3950, status: 'sent', sentVia: 'portal', sentAt: day(-12), timeEntryIds: [], flatFeeIds: ['f1'] },
  { id: 'inv2', number: 'INV-1038', matterId: 'm12', date: day(-45), lines: [{ description: 'Informal probate administration', amount: 3500 }], total: 3500, status: 'paid', sentVia: 'email', sentAt: day(-45), paidAt: day(-40), timeEntryIds: [], flatFeeIds: ['f4'] },
  { id: 'inv3', number: 'INV-1040', matterId: 'm20', date: day(-15), lines: [{ description: 'LLC formation package', amount: 950 }], total: 950, status: 'paid', sentVia: 'portal', sentAt: day(-15), paidAt: day(-14), timeEntryIds: [], flatFeeIds: ['f3'] },
];

export const flatFees: FlatFee[] = [
  { id: 'f1', matterId: 'm1', description: 'Couples Signature (Trust) Plan', amount: 3950, status: 'invoiced' },
  { id: 'f2', matterId: 'm17', description: 'RTODD deed: prepare, sign, record', amount: 650, status: 'unbilled' },
  { id: 'f3', matterId: 'm20', description: 'LLC formation package', amount: 950, status: 'paid' },
  { id: 'f4', matterId: 'm12', description: 'Informal probate administration', amount: 3500, status: 'paid' },
  { id: 'f5', matterId: 'm2', description: 'Solo Signature (Trust) Plan', amount: 2950, status: 'unbilled' },
];

const tk = (t: Omit<Task, 'snoozes' | 'log' | 'checklist' | 'source' | 'createdAt' | 'done' | 'status'> & Partial<Task>): Task => ({
  done: false, snoozes: 0, log: [], checklist: [], source: 'manual', createdAt: at(-3), ...t, status: t.status ?? (t.done ? 'done' : 'todo'),
});
const cl = (...items: [string, boolean][]) => items.map(([text, done]) => ({ text, done }));

export const tasks: Task[] = [
  tk({ id: 'r1', title: 'File petition response', matterId: 'm14', due: at(0, 17), assignee: 'me', escalateTo: 'marcus', kind: 'court', status: 'doing', snoozes: 1, log: ['Nudged 7 days out', 'Nudged 3 days out', 'Snoozed 2h yesterday'] }),
  tk({ id: 'r2', title: 'Creditor claim period ends', matterId: 'm8', due: at(38, 17), assignee: 'priya', escalateTo: 'me', kind: 'court' }),
  tk({ id: 'r3', title: 'Mail recorded deed to client', matterId: 'm19', due: at(2, 12), assignee: 'dana', kind: 'client', source: 'stage' }),
  tk({ id: 'r4', title: 'Chase signed beneficiary forms', matterId: 'm6', due: at(-1, 10), assignee: 'dana', escalateTo: 'me', kind: 'client', status: 'waiting-client', snoozes: 3, log: ['Nudged', 'Snoozed 1d', 'Snoozed 1d', 'Snoozed 1d', 'Escalated to You'] }),
  tk({ id: 'r5', title: 'Prepare signing binder', matterId: 'm4', due: at(0, 12), assignee: 'dana', escalateTo: 'me', kind: 'internal', status: 'doing', source: 'stage',
    checklist: cl(['Originals printed', true], ['Witnesses and notary booked', true], ['Funding instructions letter', false], ['Binder assembled', false]) }),
  tk({ id: 'r6', title: 'Draft documents', matterId: 'm2', due: at(2, 17), assignee: 'marcus', escalateTo: 'me', kind: 'internal', status: 'doing', source: 'stage' }),
  tk({ id: 'r7', title: 'Attorney review of drafts', matterId: 'm5', due: at(-1, 17), assignee: 'me', escalateTo: 'marcus', kind: 'internal', source: 'stage' }),
  tk({ id: 'r8', title: 'Open estate bank account (EIN first)', matterId: 'm8', due: at(-12, 17), assignee: 'priya', kind: 'internal', source: 'stage', done: true, doneAt: at(-14, 15), log: ['Marked done'] }),
  tk({ id: 'r9', title: 'Serve notice of hearing', matterId: 'm14', due: at(3, 17), assignee: 'dana', escalateTo: 'me', kind: 'court', source: 'stage' }),
  tk({ id: 'r10', title: 'Statute of limitations: breach claim', matterId: 'm10', due: at(118, 9), assignee: 'me', kind: 'statute' }),
  tk({ id: 'r11', title: 'Call Nadia Greer re: funding the trust', matterId: 'm1', due: at(5, 10), assignee: 'me', kind: 'client', status: 'stuck', comments: [{ id: 'tc1', at: at(-1, 15), author: 'me', text: 'Advisor won’t discuss accounts until the client signs an authorization. Sent it; no reply yet.' }] }),
  tk({ id: 'r12', title: 'Send engagement letter', pncId: 'p6', due: at(1, 12), assignee: 'dana', kind: 'client' }),
];
/** Kept for older code paths. */
export const reminders = tasks;

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
  { id: 'i1', channel: 'intake', author: 'dana', text: 'New probate inquiry flagged a possible conflict (adverse party is a current client). Needs your review.', at: at(-1, 9, 40), clientVisible: false },
  { id: 'm1a', channel: 'm1', author: 'client', text: 'We got the drafts. Can we change the successor trustee order?', at: at(-1, 11, 2), clientVisible: true },
  { id: 'm1b', channel: 'm1', author: 'me', text: 'Yes, easy change. We’ll walk through it on the review call.', at: at(-1, 11, 30), clientVisible: true },
  { id: 'm1c', channel: 'm1', author: 'marcus', text: 'Trustee order change noted in the revision list.', at: at(-1, 16, 20), clientVisible: false },
];

const c8 = contactsList.find((c) => c.id === 'c8')!;
export const calls: CallLog[] = [
  { id: 'cl1', matterId: 'm8', contact: c8.name, number: c8.phone, direction: 'in', at: at(-1, 15, 10), seconds: 781, logged: true },
  { id: 'cl2', matterId: 'm10', contact: 'Probate clerk', number: '(555) 910-3321', direction: 'out', at: at(-2, 10, 40), seconds: 262, logged: false },
  { id: 'cl3', contact: 'Unknown caller', number: '(555) 118-0042', direction: 'in', at: at(-2, 12, 5), seconds: 95, logged: false },
];

export const eventTypes: EventType[] = [
  { id: 'et1', name: 'New client consultation', minutes: 60, bufferBefore: 10, bufferAfter: 15, minNoticeHours: 24, dailyCap: 3, who: 'prospects', creates: 'PNC matter with conflict check + pre-consult reminders', questions: ['What can we help you with?', 'Names of any other people involved (for conflict check)', 'Any deadline you are aware of?'], active: true },
  { id: 'et2', name: 'Client check-in call', minutes: 20, bufferBefore: 0, bufferAfter: 10, minNoticeHours: 4, dailyCap: 6, who: 'clients', creates: 'Event on the matter, logged as client contact', questions: ['What would you like to cover?'], active: true },
  { id: 'et3', name: 'Signing ceremony', minutes: 60, bufferBefore: 15, bufferAfter: 15, minNoticeHours: 48, dailyCap: 2, who: 'clients', creates: 'Event on the matter + prep task for paralegal', questions: ['Will anyone else be attending?'], active: true },
];

export const documents: Record<string, { name: string; kind: string; shared: boolean; needsSignature?: boolean }[]> = {
  m1: [{ name: 'Trust – DRAFT v2.pdf', kind: 'PDF', shared: true }, { name: 'Pour-over Wills – DRAFT.pdf', kind: 'PDF', shared: true }, { name: 'Revision list.docx', kind: 'DOCX', shared: false }],
  m8: [{ name: 'Letters of Administration.pdf', kind: 'PDF', shared: true }, { name: 'Inventory worksheet.xlsx', kind: 'XLSX', shared: false }],
  m20: [{ name: 'Engagement letter.pdf', kind: 'PDF', shared: true, needsSignature: true }, { name: 'Operating Agreement – DRAFT.docx', kind: 'DOCX', shared: false }],
};
