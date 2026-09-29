// Billing math. Kept pure so it can move to the server unchanged.

export type RoundingMode = 'up' | 'nearest';

export interface BillingSettings {
  incrementMinutes: number; // 6 = tenth of an hour
  mode: RoundingMode;
  minimumMinutes: number; // smallest billable unit for any entry
}

export const DEFAULT_BILLING: BillingSettings = {
  incrementMinutes: 6,
  mode: 'up',
  minimumMinutes: 6,
};

export const INCREMENT_OPTIONS = [1, 5, 6, 10, 15, 30];

/** Actual minutes worked -> minutes billed under the firm's increment rule. */
export function billedMinutes(actual: number, s: BillingSettings): number {
  if (actual <= 0) return 0;
  const inc = s.incrementMinutes;
  const units = s.mode === 'up' ? Math.ceil(actual / inc) : Math.max(1, Math.round(actual / inc));
  return Math.max(units * inc, s.minimumMinutes);
}

/** Billed hours as a display string: tenths for 6-minute billing, hundredths otherwise. */
export function formatHours(minutes: number, s: BillingSettings): string {
  const h = minutes / 60;
  return s.incrementMinutes === 6 ? h.toFixed(1) : h.toFixed(2);
}

export function formatClock(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const sec = Math.floor(totalSeconds % 60);
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
