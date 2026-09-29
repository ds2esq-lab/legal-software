// Scheduling, Calendly-style, but each meeting type is defined once with many hosts and locations.
// A host's availability comes from their schedules; each schedule applies to specific locations
// (e.g. "Woodbridge consult block" only offers the Woodbridge office).
import { addDays, todayISO } from './practice';

export type LocationKind = 'office' | 'zoom' | 'teams' | 'phone-out' | 'phone-in' | 'ask';
export interface Place {
  id: string;
  name: string;
  kind: LocationKind;
  detail: string;
}

export const PLACES: Place[] = [
  { id: 'woodbridge', name: 'Woodbridge office', kind: 'office', detail: 'In person at the Woodbridge office' },
  { id: 'arlington', name: 'Arlington office', kind: 'office', detail: 'In person at the Arlington office' },
  { id: 'zoom', name: 'Zoom', kind: 'zoom', detail: 'Video link sent with the confirmation' },
  { id: 'teams', name: 'Microsoft Teams', kind: 'teams', detail: 'Video link sent with the confirmation' },
  { id: 'phone-out', name: 'Phone (we call you)', kind: 'phone-out', detail: 'We call the number you give us' },
  { id: 'phone-in', name: 'Phone (you call us)', kind: 'phone-in', detail: 'Call the office number at the time booked' },
];

/** weekday 0 = Sunday … 6 = Saturday; intervals are "HH:MM" pairs. */
export interface Schedule {
  id: string;
  name: string;
  owner: string;
  places: string[];
  meetingTypes?: string[]; // only offer these meeting types (empty/undefined = all)
  week: Record<number, [string, string][]>;
  overrides: { date: string; intervals: [string, string][] }[]; // [] = unavailable that day
}

export interface Question {
  id: string;
  label: string;
  type: 'text' | 'long' | 'phone' | 'choice';
  choices?: string[];
  required: boolean;
}

export interface MeetingType {
  id: string;
  name: string;
  minutes: number;
  audience: 'prospects' | 'clients' | 'internal';
  hosts: string[];
  assignment: 'client-picks' | 'first-available' | 'round-robin' | 'collective';
  places: string[];
  bufferBefore: number;
  bufferAfter: number;
  minNoticeHours: number;
  maxPerDay: number;
  horizonDays: number;
  questions: Question[];
  reminders: { hoursBefore: number; channel: 'email' | 'text' }[];
  completesMilestone?: string; // milestone name: marked done when the meeting is held
  capacity?: number; // group events
  price?: number; // paid consult, collected via LawPay at booking
  secret: boolean;
  active: boolean;
  color: string;
}

export interface Route {
  when: { question: number; answer: string }[];
  to: { meetingTypeId: string } | { message: string };
}

export interface RoutingForm {
  id: string;
  name: string;
  questions: { label: string; choices: string[] }[];
  routes: Route[];
  fallback: string; // meeting type id
}

export interface Booking {
  id: string;
  meetingTypeId: string;
  host: string;
  place: string;
  start: string; // ISO datetime
  minutes: number;
  who: string; // invitee name
  answers: Record<string, string>;
  matterId?: string;
  pncId?: string;
  status: 'booked' | 'held' | 'no-show' | 'cancelled';
  eventId?: string;
}

// ---------- Firm setup (sample: fictional team, modelled on the firm's real Calendly structure) ----------

const blocks = (days: number[], ...iv: [string, string][]) => Object.fromEntries(days.map((d) => [d, iv])) as Record<number, [string, string][]>;
const merge = (...parts: Record<number, [string, string][]>[]) => {
  const out: Record<number, [string, string][]> = {};
  for (const p of parts) for (const [d, iv] of Object.entries(p)) out[Number(d)] = [...(out[Number(d)] ?? []), ...iv];
  return out;
};

export const SCHEDULES: Schedule[] = [
  { id: 'sc1', name: 'Consults · Woodbridge', owner: 'me', places: ['woodbridge'], meetingTypes: ['mt-consult', 'mt-client', 'mt-dd', 'mt-review', 'mt-adv', 'mt-gal', 'mt-seminar'], week: blocks([2, 4], ['10:00', '12:00'], ['13:00', '14:00']), overrides: [] },
  { id: 'sc2', name: 'Consults · Arlington', owner: 'me', places: ['arlington'], meetingTypes: ['mt-consult', 'mt-client', 'mt-dd', 'mt-review', 'mt-adv', 'mt-gal', 'mt-seminar'], week: merge(blocks([1], ['12:00', '14:00']), blocks([3], ['14:00', '15:00'])), overrides: [] },
  { id: 'sc3', name: 'Consults · Online', owner: 'me', places: ['zoom', 'teams'], meetingTypes: ['mt-consult', 'mt-client', 'mt-dd', 'mt-review', 'mt-adv', 'mt-gal', 'mt-seminar'], week: merge(blocks([1], ['12:00', '14:00']), blocks([2, 4], ['10:00', '12:00'], ['13:00', '14:00']), blocks([3], ['14:00', '15:00'])), overrides: [] },
  { id: 'sc4', name: 'Phones', owner: 'me', places: ['phone-out', 'phone-in'], week: blocks([1, 2, 3, 4], ['13:00', '14:00']), overrides: [] },
  { id: 'sc5', name: 'Signings · Woodbridge', owner: 'me', places: ['woodbridge'], meetingTypes: ['mt-sign'], week: blocks([2, 4], ['09:00', '10:00'], ['12:00', '13:00'], ['14:00', '15:00']), overrides: [] },
  { id: 'sc6', name: 'Marcus · office and online', owner: 'marcus', places: ['woodbridge', 'zoom', 'teams', 'phone-out'], week: blocks([1, 2, 3, 4, 5], ['09:30', '12:00'], ['13:00', '16:30']), overrides: [] },
  { id: 'sc7', name: 'Dana · phones', owner: 'dana', places: ['phone-out', 'phone-in', 'woodbridge'], week: blocks([1, 2, 3, 4, 5], ['10:00', '12:00'], ['13:00', '16:00']), overrides: [] },
  { id: 'sc8', name: 'Priya · probate calls', owner: 'priya', places: ['phone-out', 'zoom'], week: blocks([1, 3, 5], ['10:00', '15:00']), overrides: [] },
];

const prep: Question = { id: 'q-prep', label: 'Please share anything that will help us prepare.', type: 'long', required: false };
const R = [{ hoursBefore: 24, channel: 'email' as const }, { hoursBefore: 2, channel: 'text' as const }];
const mt = (m: Partial<MeetingType> & Pick<MeetingType, 'id' | 'name' | 'minutes' | 'audience' | 'hosts' | 'places'>): MeetingType => ({
  assignment: 'client-picks', bufferBefore: 0, bufferAfter: 10, minNoticeHours: 12, maxPerDay: 6, horizonDays: 21, questions: [prep], reminders: R, secret: false, active: true, color: 'accent', ...m,
});

export const MEETING_TYPES: MeetingType[] = [
  mt({ id: 'mt-consult', name: 'Initial Consultation', minutes: 40, audience: 'prospects', hosts: ['me', 'marcus'], assignment: 'first-available', places: ['woodbridge', 'arlington', 'zoom'], bufferBefore: 10, bufferAfter: 15, minNoticeHours: 24, maxPerDay: 3,
    questions: [
      { id: 'q-behalf', label: 'If you’re booking for someone else, their name and yours', type: 'text', required: false },
      { id: 'q-cell', label: 'Cell phone', type: 'phone', required: true },
      { id: 'q-city', label: 'City and state', type: 'text', required: true },
      { id: 'q-others', label: 'Names of anyone else involved (for our conflict check)', type: 'long', required: false },
      prep,
    ] }),
  mt({ id: 'mt-client', name: 'Client Meeting', minutes: 30, audience: 'clients', hosts: ['me', 'marcus', 'dana'], places: ['woodbridge', 'arlington', 'zoom', 'phone-out'] }),
  mt({ id: 'mt-qd', name: 'Questionnaire Discussion', minutes: 15, audience: 'clients', hosts: ['me', 'marcus', 'dana'], assignment: 'first-available', places: ['phone-out'], completesMilestone: 'Questionnaire Discussion' }),
  mt({ id: 'mt-dd', name: 'Draft Discussion', minutes: 30, audience: 'clients', hosts: ['me', 'marcus'], places: ['phone-out', 'zoom', 'woodbridge'], completesMilestone: 'Draft Discussion' }),
  mt({ id: 'mt-sign', name: 'Signing', minutes: 60, audience: 'clients', hosts: ['me'], places: ['woodbridge'], bufferBefore: 15, bufferAfter: 15, minNoticeHours: 48, maxPerDay: 3, completesMilestone: 'Signing' }),
  mt({ id: 'mt-deed', name: 'Deed Signing', minutes: 10, audience: 'clients', hosts: ['dana'], places: ['woodbridge'], completesMilestone: 'Signed' }),
  mt({ id: 'mt-onb', name: 'Probate Onboarding Call', minutes: 15, audience: 'clients', hosts: ['priya', 'dana'], assignment: 'round-robin', places: ['phone-out'], completesMilestone: 'Onboarding Call' }),
  mt({ id: 'mt-review', name: 'Estate Plan Review', minutes: 45, audience: 'clients', hosts: ['me', 'marcus'], places: ['woodbridge', 'arlington', 'zoom'] }),
  mt({ id: 'mt-adv', name: 'Advisory Meeting', minutes: 60, audience: 'prospects', hosts: ['me'], places: ['woodbridge', 'arlington', 'zoom'], price: 350, questions: [{ id: 'q-adv', label: 'To make the best use of your time and money, what should we prepare?', type: 'long', required: true }] }),
  mt({ id: 'mt-call', name: 'Client Phone Call', minutes: 15, audience: 'clients', hosts: ['me', 'dana'], places: ['phone-out', 'phone-in'], questions: [{ id: 'q-topic', label: 'Topic', type: 'text', required: true }] }),
  mt({ id: 'mt-gal', name: 'GAL Discussion', minutes: 60, audience: 'clients', hosts: ['me'], places: ['phone-out', 'zoom', 'woodbridge'], questions: [] }),
  mt({ id: 'mt-seminar', name: 'Trust or Will: Which Is Better for You?', minutes: 90, audience: 'prospects', hosts: ['me'], assignment: 'collective', places: ['woodbridge'], capacity: 20, questions: [{ id: 'q-ph', label: 'Phone number', type: 'phone', required: true }] }),
  mt({ id: 'mt-interview', name: 'Interview', minutes: 30, audience: 'internal', hosts: ['me'], places: ['zoom'], secret: true }),
];

const NEEDS = ['Estate planning (wills, trusts, powers of attorney)', 'Guardianship', 'Probate or trust administration', 'Deed', 'Business law', 'Something else'];
const WHERE = ['Northern Virginia', 'Elsewhere in Virginia', 'Washington, DC', 'Maryland', 'West Virginia', 'Somewhere else'];
export const ROUTING: RoutingForm = {
  id: 'rf1',
  name: 'Consultation',
  questions: [
    { label: 'What do you need help with today?', choices: NEEDS },
    { label: 'Where do you need help?', choices: WHERE },
    { label: 'Where would you like to meet?', choices: ['Woodbridge office', 'Arlington office', 'Online'] },
  ],
  routes: [
    ...WHERE.slice(2).map((w) => ({ when: [{ question: 1, answer: w }], to: { message: 'Thanks. We mainly help clients with Virginia matters. We’ll review your request and call you within one business day to talk about next steps.' } })),
    { when: [{ question: 0, answer: 'Something else' }], to: { message: 'Thanks. Tell us a little more and someone will call you within one business day.' } },
  ],
  fallback: 'mt-consult',
};

// ---------- Slot finding ----------

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

export interface Slot {
  start: Date;
  host: string;
}

/**
 * Open start times for a meeting type, place and date. Honors each host's schedules for that place,
 * date overrides, buffers around existing bookings/events, minimum notice and the daily cap.
 */
export function slotsFor(mt: MeetingType, placeId: string, dayISO: string, schedules: Schedule[], busy: { host: string; start: string; minutes: number }[], hostFilter?: string): Slot[] {
  const day = new Date(dayISO + 'T00:00:00');
  const wd = day.getDay();
  const earliest = Date.now() + mt.minNoticeHours * 3600000;
  const hosts = mt.hosts.filter((h) => !hostFilter || h === hostFilter);
  const found = new Map<number, string[]>();
  for (const h of hosts) {
    const todays = busy.filter((b) => b.host === h && b.start.slice(0, 10) === dayISO);
    if (todays.length >= mt.maxPerDay) continue;
    for (const sc of schedules.filter((x) => x.owner === h && x.places.includes(placeId) && (!x.meetingTypes?.length || x.meetingTypes.includes(mt.id)))) {
      const ov = sc.overrides.find((o) => o.date === dayISO);
      const intervals = ov ? ov.intervals : sc.week[wd] ?? [];
      for (const [a, b] of intervals) {
        for (let t = toMin(a); t + mt.minutes <= toMin(b); t += 15) {
          const start = new Date(day.getTime() + t * 60000);
          if (start.getTime() < earliest) continue;
          const s0 = start.getTime() - mt.bufferBefore * 60000;
          const s1 = start.getTime() + (mt.minutes + mt.bufferAfter) * 60000;
          const clash = todays.some((bk) => {
            const b0 = new Date(bk.start).getTime();
            return s0 < b0 + bk.minutes * 60000 && b0 < s1;
          });
          if (clash) continue;
          const key = start.getTime();
          found.set(key, [...(found.get(key) ?? []), h]);
        }
      }
    }
  }
  // Round robin / first available: when several hosts are free, pick the one with fewer bookings that day.
  return [...found.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([k, hs]) => ({ start: new Date(k), host: [...hs].sort((x, y) => busy.filter((b) => b.host === x && b.start.slice(0, 10) === dayISO).length - busy.filter((b) => b.host === y && b.start.slice(0, 10) === dayISO).length)[0] }));
}

export function nextDays(n: number) {
  return Array.from({ length: n }, (_, i) => addDays(todayISO(), i));
}

/** Where a routing form sends someone, given their answers so far. */
export function route(form: RoutingForm, answers: string[]): Route['to'] | null {
  for (const r of form.routes) if (r.when.every((w) => answers[w.question] === w.answer)) return r.to;
  return answers.length >= form.questions.length ? { meetingTypeId: form.fallback } : null;
}
