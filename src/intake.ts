import type { Cadences, Pnc } from './data';
import { addDays, todayISO } from './practice';

export interface Touch {
  key: string; // stored in pnc.touches when done
  label: string;
  due: string;
  done?: string;
}

/** The follow-up schedule for a prospect, generated from the anchor date of their current stage. */
export function touchesFor(p: Pnc, c: Cadences): Touch[] {
  const mk = (prefix: string, anchor: string, days: number[], label: (d: number) => string) =>
    days.map((d) => ({ key: `${prefix}:${d}`, label: label(d), due: addDays(anchor, d), done: p.touches[`${prefix}:${d}`] }));
  switch (p.stage) {
    case 'inquiry':
      return mk('s', p.firstContact, c.scheduling, (d) => `Scheduling follow-up · day ${d}`);
    case 'scheduled':
      return p.consultAt ? mk('c', p.consultAt.slice(0, 10), c.preConsult, (d) => `Consult reminder · ${-d} day${d === -1 ? '' : 's'} before`) : [];
    case 'followup':
      return p.consultAt ? mk('f', p.consultAt.slice(0, 10), c.followUp, (d) => `Post-consult follow-up · day ${d}`) : [];
    case 'el':
      return p.elSent ? mk('e', p.elSent, c.el, (d) => `Engagement letter follow-up · day ${d}`) : [];
    default:
      return [];
  }
}

/** The next touch still to do (overdue ones first), or undefined when the cadence is finished. */
export function nextTouch(p: Pnc, c: Cadences): Touch | undefined {
  return touchesFor(p, c).find((t) => !t.done);
}

export const isDueNow = (t?: Touch) => !!t && t.due <= todayISO();
