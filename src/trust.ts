// Trust (IOLTA) accounting: the client trust ledger, the M&T bank feed, and reconciliation.
//
// Rules the code enforces:
//   - Money in (deposits) is recorded right away. Money out (draws, disbursements, refunds) is a
//     request until someone with the "payments" permission approves it.
//   - No client's trust balance can go below zero, counting outflows still awaiting approval.
//   - The software never moves money. Approved outflows are made at the bank; the bank feed then
//     shows them and they are matched. Anything unmatched surfaces in the reconciliation.
import { addDays, todayISO } from './practice';

export const TRUST_ACCOUNT = { name: 'M&T Bank IOLTA', last4: '4821' };
export const OPERATING_ACCOUNT = { name: 'M&T Bank Operating', last4: '1177' };

export type TrustKind = 'deposit' | 'draw' | 'disbursement' | 'refund';
export const KIND_LABEL: Record<TrustKind, string> = {
  deposit: 'Deposit',
  draw: 'Earned fee → operating',
  disbursement: 'Paid to third party',
  refund: 'Refund to client',
};

export interface TrustTxn {
  id: string;
  date: string;
  matterId: string;
  kind: TrustKind;
  amount: number; // always positive; kind decides the direction
  memo: string;
  payee?: string; // who the money went to, or came from
  method: 'lawpay' | 'check' | 'transfer' | 'wire' | 'ach';
  ref?: string; // check number, LawPay id
  status: 'pending' | 'approved' | 'rejected';
  requestedBy: string;
  approvedBy?: string;
  bankTxnId?: string; // set when matched to the bank feed
  invoiceId?: string;
  milestoneId?: string;
  expenseId?: string;
}

export interface BankTxn {
  id: string;
  date: string;
  amount: number; // signed: + into the account, − out
  description: string;
  matchedId?: string;
}

export interface Replenishment {
  id: string;
  matterId: string;
  date: string;
  amount: number;
  status: 'sent' | 'paid' | 'cancelled';
  paidAt?: string;
}

export interface Expense {
  id: string;
  matterId: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  paidFrom: 'operating' | 'trust'; // firm advanced it, or paid from the client's trust funds
  billable: boolean;
  markupPct: number;
  receipt?: string;
  invoiced: boolean;
  trustTxnId?: string;
}

export const EXPENSE_CATEGORIES = ['Filing fee', 'Recording fee', 'Certified copies', 'Process server', 'Courier / postage', 'Mileage', 'Publication', 'Appraisal', 'Other'];

export interface Reconciliation {
  id: string;
  kind: 'monthly' | 'quarterly';
  period: string; // "2026-08" or "2026-Q2"
  asOf: string;
  signedBy: string;
  signedAt: string;
  bankBalance: number;
  adjustedBank: number;
  journalBalance: number;
  clientTotal: number;
  notes?: string;
}

export const sign = (t: TrustTxn) => (t.kind === 'deposit' ? t.amount : -t.amount);
const counted = (t: TrustTxn) => t.status === 'approved';

/** A client's trust balance on the books as of a date (approved transactions only). */
export function balanceOf(matterId: string, txns: TrustTxn[], asOf = todayISO()) {
  return round(txns.filter((t) => t.matterId === matterId && counted(t) && t.date <= asOf).reduce((n, t) => n + sign(t), 0));
}

/** What can still be paid out: balance minus outflows awaiting approval. */
export function availableOf(matterId: string, txns: TrustTxn[]) {
  const pendingOut = txns.filter((t) => t.matterId === matterId && t.status === 'pending' && t.kind !== 'deposit').reduce((n, t) => n + t.amount, 0);
  return round(balanceOf(matterId, txns) - pendingOut);
}

export function journalBalance(txns: TrustTxn[], asOf = todayISO()) {
  return round(txns.filter((t) => counted(t) && t.date <= asOf).reduce((n, t) => n + sign(t), 0));
}

export function bankBalance(bank: BankTxn[], asOf = todayISO()) {
  return round(bank.filter((b) => b.date <= asOf).reduce((n, b) => n + b.amount, 0));
}

export function clientBalances(txns: TrustTxn[], asOf = todayISO()) {
  const ids = [...new Set(txns.map((t) => t.matterId))];
  return ids.map((matterId) => ({ matterId, balance: balanceOf(matterId, txns, asOf) })).filter((x) => x.balance !== 0 || txns.some((t) => t.matterId === x.matterId && t.date.slice(0, 7) === asOf.slice(0, 7)));
}

/** The three-way reconciliation as of a date. */
export function reconcile(txns: TrustTxn[], bank: BankTxn[], asOf = todayISO()) {
  const bankBal = bankBalance(bank, asOf);
  const matchedBankIds = new Set(bank.filter((b) => b.date <= asOf && b.matchedId).map((b) => b.id));
  const booked = txns.filter((t) => counted(t) && t.date <= asOf);
  const inTransit = booked.filter((t) => t.kind === 'deposit' && !(t.bankTxnId && matchedBankIds.has(t.bankTxnId)));
  const outstanding = booked.filter((t) => t.kind !== 'deposit' && !(t.bankTxnId && matchedBankIds.has(t.bankTxnId)));
  const unmatchedBank = bank.filter((b) => b.date <= asOf && !b.matchedId);
  const adjusted = round(bankBal + inTransit.reduce((n, t) => n + t.amount, 0) - outstanding.reduce((n, t) => n + t.amount, 0));
  const journal = journalBalance(txns, asOf);
  const clients = clientBalances(txns, asOf);
  const clientTotal = round(clients.reduce((n, c) => n + c.balance, 0));
  const negatives = clients.filter((c) => c.balance < 0);
  // Bank items the books don't know about (e.g. a bank fee charged to IOLTA) explain the gap.
  const unexplained = round(adjusted - journal);
  return { asOf, bankBal, inTransit, outstanding, unmatchedBank, adjusted, journal, clientTotal, clients, negatives, unexplained, ok: Math.abs(unexplained) < 0.005 && Math.abs(journal - clientTotal) < 0.005 && !negatives.length };
}

/** Pair unmatched bank lines with booked transactions of the same amount within a week. */
export function autoMatch(txns: TrustTxn[], bank: BankTxn[]) {
  const pairs: [string, string][] = [];
  const usedT = new Set(txns.filter((t) => t.bankTxnId).map((t) => t.id));
  for (const b of bank.filter((x) => !x.matchedId)) {
    const t = txns.find(
      (x) => counted(x) && !usedT.has(x.id) && Math.abs(sign(x) - b.amount) < 0.005 && Math.abs(new Date(x.date).getTime() - new Date(b.date).getTime()) <= 7 * 86400000,
    );
    if (t) {
      pairs.push([b.id, t.id]);
      usedT.add(t.id);
    }
  }
  return pairs;
}

export const round = (n: number) => Math.round(n * 100) / 100;

export function monthEnd(period: string) {
  const [y, m] = period.split('-').map(Number);
  const d = new Date(y, m, 0);
  const iso = `${y}-${String(m).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return iso > todayISO() ? todayISO() : iso;
}

export function quarterOf(iso: string) {
  return `${iso.slice(0, 4)}-Q${Math.floor((Number(iso.slice(5, 7)) - 1) / 3) + 1}`;
}

export function quarterEnd(q: string) {
  const [y, n] = [q.slice(0, 4), Number(q.slice(-1))];
  return monthEnd(`${y}-${String(n * 3).padStart(2, '0')}`);
}

// ---------- Sample data ----------

const day = (n: number) => addDays(todayISO(), n);
let k = 0;
const tx = (matterId: string, ago: number, kind: TrustKind, amount: number, memo: string, extra: Partial<TrustTxn> = {}): TrustTxn => ({
  id: `tt-${++k}`,
  date: day(-ago),
  matterId,
  kind,
  amount,
  memo,
  method: kind === 'deposit' ? 'lawpay' : kind === 'draw' ? 'transfer' : 'check',
  status: 'approved',
  requestedBy: 'me',
  approvedBy: 'me',
  ...extra,
});

export const trustTxns: TrustTxn[] = [
  // Fixed-price estate plans: paid up front into trust, drawn as milestones are reached.
  tx('m1', 40, 'deposit', 3950, 'Fixed price paid in full', { payee: 'Whitford, Avery', ref: 'LP-88213' }),
  tx('m1', 16, 'draw', 1975, 'Earned 50% on Drafts Sent', { milestoneId: 'drafts-sent' }),
  tx('m2', 1, 'deposit', 2950, 'Fixed price paid in full', { payee: 'Okafor, Jordan', ref: 'LP-88460' }),
  tx('m4', 70, 'deposit', 5450, 'Fixed price paid in full', { payee: 'Brennan, Riley', ref: 'LP-87902' }),
  tx('m4', 42, 'draw', 2725, 'Earned 50% on Drafts Sent', { milestoneId: 'drafts-sent' }),
  tx('m7', 88, 'deposit', 2950, 'Fixed price paid in full', { payee: 'Abernathy, Harper', ref: 'LP-87611' }),
  tx('m7', 61, 'draw', 1475, 'Earned 50% on Drafts Sent', { milestoneId: 'drafts-sent' }),
  tx('m7', 4, 'draw', 1475, 'Earned 50% on Signing', { milestoneId: 'signing' }),
  tx('m12', 50, 'deposit', 3500, 'Fixed price paid in full', { payee: 'Vasquez, Reese', ref: 'LP-88019' }),
  tx('m12', 29, 'draw', 1750, 'Earned 50% on Packet Submitted', { milestoneId: 'packet-submitted' }),
  tx('m19', 25, 'deposit', 688, 'Fixed price $650 + recording costs $38', { payee: 'Engstrom, Logan', ref: 'LP-88377' }),
  tx('m19', 2, 'disbursement', 38, 'Deed recording fee', { payee: 'Clerk of Circuit Court', ref: 'Check 1051', expenseId: 'ex5' }),
  // Hourly matters on evergreen retainers.
  tx('m8', 118, 'deposit', 5000, 'Retainer', { payee: 'Lindqvist, Rowan', method: 'wire', ref: 'Wire 2231' }),
  tx('m8', 89, 'disbursement', 402, 'Probate filing fee', { payee: 'Clerk of Circuit Court', ref: 'Check 1043', expenseId: 'ex1' }),
  tx('m8', 60, 'draw', 2100, 'Payment of INV-1031', { invoiceId: 'inv-old1' }),
  tx('m8', 20, 'draw', 1850, 'Payment of INV-1039', { invoiceId: 'inv-old2' }),
  tx('m14', 80, 'deposit', 4000, 'Retainer', { payee: 'Fairbanks, Kendall', ref: 'LP-87744' }),
  tx('m14', 40, 'draw', 1600, 'Payment of INV-1035', { invoiceId: 'inv-old3' }),
  tx('m14', 1, 'draw', 1540, 'Payment of INV-1044', { invoiceId: 'inv4', status: 'pending', requestedBy: 'marcus', approvedBy: undefined }),
  tx('m10', 45, 'deposit', 7500, 'Retainer', { payee: 'Halvorsen, Hayden', method: 'wire', ref: 'Wire 2290' }),
];

// What M&T reports. Most lines match the books; two things don't, on purpose:
//   - a $15 bank service charge taken from IOLTA (must be moved to operating)
//   - the $38 recording-fee check hasn't cleared yet (an outstanding check)
export const bankTxns: BankTxn[] = [
  ...trustTxns
    .filter((t) => t.status === 'approved' && !(t.matterId === 'm19' && t.kind === 'disbursement') && !(t.matterId === 'm2'))
    .map((t, i) => ({ id: `bk-${i + 1}`, date: addDays(t.date, t.kind === 'deposit' ? 1 : t.method === 'check' ? 3 : 0), amount: sign(t), description: bankDescription(t), matchedId: t.id })),
  { id: 'bk-fee', date: day(-9), amount: -15, description: 'SERVICE CHARGE - ANALYSIS FEE' },
];
for (const b of bankTxns) if (b.matchedId) trustTxns.find((t) => t.id === b.matchedId)!.bankTxnId = b.id;

function bankDescription(t: TrustTxn) {
  if (t.kind === 'deposit') return t.method === 'wire' ? `INCOMING WIRE ${t.ref ?? ''}` : `LAWPAY DEPOSIT ${t.ref ?? ''}`;
  if (t.kind === 'draw') return 'ONLINE TRANSFER TO XXXXXX1177';
  return `CHECK ${(t.ref ?? '').replace(/\D/g, '')}`;
}

export const replenishments: Replenishment[] = [{ id: 'rp1', matterId: 'm8', date: day(-19), amount: 4352, status: 'sent' }];

export const expenses: Expense[] = [
  { id: 'ex1', matterId: 'm8', date: day(-89), category: 'Filing fee', description: 'Petition for probate filing fee', amount: 402, paidFrom: 'trust', billable: true, markupPct: 0, receipt: 'filing-receipt.pdf', invoiced: true, trustTxnId: 'tt-14' },
  { id: 'ex2', matterId: 'm8', date: day(-12), category: 'Certified copies', description: 'Letters of administration, 6 certified copies', amount: 45, paidFrom: 'operating', billable: true, markupPct: 0, receipt: 'clerk-copies.jpg', invoiced: false },
  { id: 'ex3', matterId: 'm14', date: day(-9), category: 'Process server', description: 'Service of notice of hearing on respondent', amount: 85, paidFrom: 'operating', billable: true, markupPct: 0, invoiced: false },
  { id: 'ex4', matterId: 'm14', date: day(-7), category: 'Mileage', description: 'Home visit, 48 miles at IRS rate', amount: 33.6, paidFrom: 'operating', billable: true, markupPct: 0, invoiced: false },
  { id: 'ex5', matterId: 'm19', date: day(-2), category: 'Recording fee', description: 'Deed of gift recording fee', amount: 38, paidFrom: 'trust', billable: true, markupPct: 0, invoiced: false, trustTxnId: 'tt-12' },
  { id: 'ex6', matterId: 'm17', date: day(-1), category: 'Recording fee', description: 'RTODD recording fee (pass-through)', amount: 38, paidFrom: 'operating', billable: true, markupPct: 0, invoiced: false },
];

const lastMonth = todayISO().slice(0, 7) === '2026-09' ? '2026-08' : new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().slice(0, 7);
export const reconciliations: Reconciliation[] = [
  { id: 'rc1', kind: 'monthly', period: lastMonth, asOf: monthEnd(lastMonth), signedBy: 'me', signedAt: addDays(monthEnd(lastMonth), 6), bankBalance: 0, adjustedBank: 0, journalBalance: 0, clientTotal: 0, notes: 'All items matched.' },
];

// Fill the signed-off reconciliation with the figures it would have had.
{
  const r0 = reconciliations[0];
  const r = reconcile(trustTxns, bankTxns, r0.asOf);
  Object.assign(r0, { bankBalance: r.bankBal, adjustedBank: r.adjusted, journalBalance: r.journal, clientTotal: r.clientTotal });
}
