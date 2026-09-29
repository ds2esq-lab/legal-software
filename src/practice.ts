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

export interface PracticeArea {
  id: string;
  name: string;
  stages: Stage[]; // last stage is treated as "closed"
  milestones: Milestone[];
  cadence: { soon: number; followUp: number }; // days since last contact
  planTypes: string[];
  planLabel: string; // what this area calls a plan type ("Plan", "Type", "Deed type")
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

// Seeded from how the firm runs today. "Waiting on client / 3rd party / attorney" is NOT a stage here;
// that is what Whose Ball is for.
export const DEFAULT_AREAS: PracticeArea[] = [
  {
    id: 'ep',
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
  },
  {
    id: 'fpet',
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
  },
  {
    id: 'ipet',
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
  },
  {
    id: 'gc',
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
  },
  {
    id: 'deed',
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
  },
  {
    id: 'biz',
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
  },
  {
    id: 'fam',
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

export function addWorkdays(iso: string, n: number) {
  const d = parseDate(iso);
  let left = n;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) left--;
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
