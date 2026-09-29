// Attorney performance, credited to the originating attorney on each matter.
//
//   Fixed-price work:  Paid (headline) = client money received in the quarter (trust deposits and
//                      direct payments); Signed = fixed prices of matters engaged in the quarter.
//   Hourly work:       Billed = invoices issued in the quarter; Collected = invoices paid in the quarter.
import type { Invoice, Matter } from './data';
import type { TrustTxn } from './trust';
import { todayISO } from './practice';

export interface Quarter {
  id: string; // 2026-Q3
  start: string;
  end: string;
  label: string;
}

export function quarterFor(iso: string): Quarter {
  const y = Number(iso.slice(0, 4));
  const q = Math.floor((Number(iso.slice(5, 7)) - 1) / 3) + 1;
  const sm = (q - 1) * 3 + 1;
  const endDate = new Date(y, sm + 2, 0).getDate();
  return { id: `${y}-Q${q}`, start: `${y}-${String(sm).padStart(2, '0')}-01`, end: `${y}-${String(sm + 2).padStart(2, '0')}-${endDate}`, label: `Q${q} ${y}` };
}

export function recentQuarters(n: number, from = todayISO()): Quarter[] {
  const out: Quarter[] = [];
  let q = quarterFor(from);
  for (let i = 0; i < n; i++) {
    out.push(q);
    const prev = new Date(q.start + 'T12:00:00');
    prev.setDate(0);
    q = quarterFor(prev.toISOString().slice(0, 10));
  }
  return out;
}

const inQ = (d: string | undefined, q: Quarter) => !!d && d >= q.start && d <= q.end;

export interface Stats {
  paid: number;
  signed: number;
  billed: number;
  collected: number;
  matters: { matter: Matter; paid: number; signed: number; billed: number; collected: number }[];
}

export function statsFor(attorney: string, q: Quarter, matters: Matter[], txns: TrustTxn[], invoices: Invoice[]): Stats {
  const mine = matters.filter((m) => m.originator === attorney);
  const rows = mine.map((m) => {
    const fixed = m.billing.kind !== 'hourly';
    const deposits = txns.filter((t) => t.matterId === m.id && t.kind === 'deposit' && t.status === 'approved' && inQ(t.date, q)).reduce((n, t) => n + t.amount, 0);
    const invs = invoices.filter((i) => i.matterId === m.id);
    const directPaid = invs.filter((i) => i.status === 'paid' && inQ(i.paidAt, q) && !txns.some((t) => t.invoiceId === i.id)).reduce((n, i) => n + i.total, 0);
    const engaged = m.milestones.engaged?.done ?? m.opened;
    return {
      matter: m,
      paid: fixed ? deposits + directPaid : 0,
      signed: fixed && inQ(engaged, q) && m.billing.kind !== 'hourly' ? m.billing.amount : 0,
      billed: !fixed || m.billing.kind === 'hybrid' ? invs.filter((i) => i.status !== 'draft' && inQ(i.sentAt ?? i.date, q)).reduce((n, i) => n + i.total, 0) : 0,
      collected: !fixed || m.billing.kind === 'hybrid' ? invs.filter((i) => i.status === 'paid' && inQ(i.paidAt, q)).reduce((n, i) => n + i.total, 0) : 0,
    };
  }).filter((r) => r.paid || r.signed || r.billed || r.collected);
  const sum = (k: 'paid' | 'signed' | 'billed' | 'collected') => rows.reduce((n, r) => n + r[k], 0);
  return { paid: sum('paid'), signed: sum('signed'), billed: sum('billed'), collected: sum('collected'), matters: rows };
}
