import type { Matter, TimeEntry } from './data';
import { billedMinutes, type BillingSettings } from './billing';
import { contactState, addDays, dueFor, todayISO, type PracticeArea } from './practice';

/** Hourly rate that applies to time on this matter; fixed-price time is tracked but not charged. */
export function hourlyRate(m: Matter): number {
  if (m.billing.kind === 'hourly') return m.billing.rate;
  if (m.billing.kind === 'hybrid') return m.billing.rate;
  return 0;
}

export function entryValue(e: TimeEntry, m: Matter | undefined, s: BillingSettings): number {
  if (!m || !e.billable) return 0;
  return (billedMinutes(e.actualMinutes, s) / 60) * hourlyRate(m);
}

export interface DueItem {
  milestoneId: string;
  name: string;
  date: string;
  late: boolean;
  manual: boolean;
}

/** Open milestones that have a due date, soonest first. */
export function dueMilestones(m: Matter, area: PracticeArea): DueItem[] {
  const today = todayISO();
  return area.milestones
    .filter((ms) => !m.milestones[ms.id]?.done)
    .map((ms) => ({ ms, due: dueFor(ms, m.milestones) }))
    .filter((x) => x.due.date)
    .map(({ ms, due }) => ({ milestoneId: ms.id, name: ms.name, date: due.date!, late: due.date! < today, manual: due.source === 'manual' }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface NextAction {
  date: string;
  what: string;
  kind: 'suspense' | 'milestone' | 'contact';
}

/** Everything that puts a date on this matter; the earliest one is its "next action". */
export function nextActions(m: Matter, area: PracticeArea): NextAction[] {
  const out: NextAction[] = [];
  if (m.suspense) out.push({ date: m.suspense, what: m.suspenseNote || 'Suspense date', kind: 'suspense' });
  for (const d of dueMilestones(m, area)) out.push({ date: d.date, what: `${d.name} due`, kind: 'milestone' });
  if (m.lastContact) out.push({ date: addDays(m.lastContact, area.cadence.soon), what: 'Client contact due', kind: 'contact' });
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export const isClosedStage = (m: Matter, area: PracticeArea) => area.stages[area.stages.length - 1]?.id === m.stageId;

export { contactState };
