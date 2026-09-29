import type { Matter, TimeEntry } from './data';
import { billedMinutes, type BillingSettings } from './billing';

/** Hourly rate that applies to time on this matter; flat-fee time is tracked but not charged. */
export function hourlyRate(m: Matter): number {
  if (m.billing.kind === 'hourly') return m.billing.rate;
  if (m.billing.kind === 'hybrid') return m.billing.rate;
  return 0;
}

export function entryValue(e: TimeEntry, m: Matter | undefined, s: BillingSettings): number {
  if (!m || !e.billable) return 0;
  return (billedMinutes(e.actualMinutes, s) / 60) * hourlyRate(m);
}
