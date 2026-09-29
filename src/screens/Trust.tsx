import { useState } from 'react';
import { useStore } from '../store';
import { money } from '../billing';
import { teamName } from '../data';
import * as T from '../trust';
import { todayISO } from '../practice';
import { fmtDate, PageHead } from '../ui';

type Tab = 'overview' | 'approvals' | 'bank' | 'reconcile' | 'journals';
const signed = (n: number) => (n < 0 ? `(${money(-n)})` : money(n));

export function TxnKindPill({ t }: { t: T.TrustTxn }) {
  const cls = t.kind === 'deposit' ? 'ok' : t.kind === 'draw' ? 'info' : 'warn';
  return <span className={`pill ${cls}`}>{T.KIND_LABEL[t.kind]}</span>;
}

function Approvals() {
  const { s, actions, lookup, access, notify, go } = useStore();
  const pending = s.trustTxns.filter((t) => t.status === 'pending');
  const canApprove = access.can('payments');
  return (
    <section className="panel">
      <div className="panel-head"><h2>Waiting for approval <span className="num small muted">{pending.length}</span></h2><span className="small muted">Nothing leaves trust until someone with “Record payments & trust” approves it.</span></div>
      {pending.length === 0 && <p className="panel-body muted">Nothing waiting.</p>}
      <div className="table-wrap">
        <table className="t">
          {pending.length > 0 && <thead><tr><th>Requested</th><th>Matter</th><th>What</th><th className="r">Amount</th><th className="r">Client balance</th><th>By</th><th /></tr></thead>}
          <tbody>
            {pending.map((t) => {
              const m = lookup.matter(t.matterId);
              const bal = T.balanceOf(t.matterId, s.trustTxns);
              return (
                <tr key={t.id}>
                  <td className="num">{fmtDate(t.date)}</td>
                  <td>{m && <button className="link" onClick={() => go('matter', m.id)}>{m.name}</button>}</td>
                  <td><TxnKindPill t={t} /> <span className="small">{t.memo}{t.payee ? ` · to ${t.payee}` : ''}</span></td>
                  <td className="r num"><strong>{money(t.amount)}</strong></td>
                  <td className="r num">{money(bal)} → {money(bal - t.amount)}</td>
                  <td>{teamName(t.requestedBy)}</td>
                  <td className="r" style={{ whiteSpace: 'nowrap' }}>
                    {canApprove ? (
                      <>
                        <button className="btn sm primary" onClick={() => { actions.approveTrust(t.id); notify(`Approved. Make the ${t.method === 'check' ? 'check' : 'transfer'} at M&T; it will match when it posts.`); }}>Approve</button>{' '}
                        <button className="btn sm ghost danger" onClick={() => { actions.rejectTrust(t.id); notify('Rejected. Nothing was recorded.'); }}>Reject</button>
                      </>
                    ) : <span className="small muted">Needs approval</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Overview({ setTab }: { setTab: (t: Tab) => void }) {
  const { s, lookup, go, access, actions, notify } = useStore();
  const rec = T.reconcile(s.trustTxns, s.bankTxns);
  const clients = rec.clients.filter((c) => { const m = lookup.matter(c.matterId); return m && (access.canSee(m) || access.can('payments')); });
  const low = s.matters.filter((m) => m.retainer && T.balanceOf(m.id, s.trustTxns) < m.retainer.minimum);
  const pending = s.trustTxns.filter((t) => t.status === 'pending');
  const unmatched = rec.unmatchedBank.length;
  return (
    <>
      <div className="stats">
        <div className="stat"><span className="label">Held in trust (books)</span><span className="v">{money(rec.journal)}</span></div>
        <div className="stat"><span className="label">M&T statement balance</span><span className="v">{money(rec.bankBal)}</span></div>
        <button className="stat" onClick={() => setTab('approvals')}><span className="label">Waiting for approval</span><span className="v" style={{ color: pending.length ? 'var(--warn)' : undefined }}>{pending.length}</span></button>
        <button className="stat" onClick={() => setTab('reconcile')}><span className="label">Three-way reconciliation</span><span className="v" style={{ color: rec.ok ? 'var(--ok)' : 'var(--danger)', fontSize: 17 }}>{rec.ok ? '✓ In balance' : `⚠ ${unmatched ? `${unmatched} bank item${unmatched === 1 ? '' : 's'} to fix` : 'Out of balance'}`}</span></button>
      </div>

      {low.length > 0 && (
        <section className="panel">
          <div className="panel-head"><h2>Retainers below minimum</h2></div>
          <ul className="list">
            {low.map((m) => {
              const bal = T.balanceOf(m.id, s.trustTxns);
              const req = s.replenishments.find((r) => r.matterId === m.id && r.status === 'sent');
              return (
                <li key={m.id} className="spread">
                  <span><button className="link" onClick={() => go('matter', m.id)}>{m.name}</button><div className="small muted">Balance {money(bal)} · minimum {money(m.retainer!.minimum)} · target {money(m.retainer!.target)}</div></span>
                  {req ? <span className="pill warn">Request for {money(req.amount)} sent {fmtDate(req.date)}</span> : access.can('invoices') && <button className="btn sm" onClick={() => { actions.requestReplenishment(m.id, m.retainer!.target - bal); notify('Replenishment request sent to the client portal with a LawPay link'); }}>Request {money(m.retainer!.target - bal)}</button>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="panel">
        <div className="panel-head"><h2>Client trust balances</h2><span className="small muted">{TRUST_LABEL}</span></div>
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Matter</th><th>Client</th><th>Fee type</th><th className="r">Balance</th><th className="r">Available</th><th /></tr></thead>
            <tbody>
              {clients.map(({ matterId, balance }) => {
                const m = lookup.matter(matterId)!;
                const avail = T.availableOf(matterId, s.trustTxns);
                const walled = !access.canSee(m);
                return (
                  <tr key={matterId}>
                    <td>{walled ? <span className="muted">🔒 Restricted matter</span> : <button className="link" onClick={() => go('matter', m.id)}>{m.name}</button>}</td>
                    <td>{walled ? '—' : lookup.clientOf(m)?.name}</td>
                    <td>{m.billing.kind === 'hourly' ? (m.retainer ? 'Hourly · evergreen retainer' : 'Hourly') : 'Fixed price'}</td>
                    <td className="r num">{money(balance)}</td>
                    <td className="r num">{avail !== balance ? <span title="Some of this is waiting for approval to go out">{money(avail)}</span> : '—'}</td>
                    <td className="r">{m.retainer && balance < m.retainer.minimum && <span className="pill warn">Below minimum</span>}</td>
                  </tr>
                );
              })}
              <tr><td colSpan={3}><strong>Total of client ledgers</strong></td><td className="r num"><strong>{money(rec.clientTotal)}</strong></td><td colSpan={2} /></tr>
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
const TRUST_LABEL = `${T.TRUST_ACCOUNT.name} ••${T.TRUST_ACCOUNT.last4}`;

function BankFeed() {
  const { s, actions, lookup, access, notify } = useStore();
  const [pick, setPick] = useState<Record<string, string>>({});
  const bank = [...s.bankTxns].sort((a, b) => b.date.localeCompare(a.date));
  const unmatchedBooks = s.trustTxns.filter((t) => t.status === 'approved' && !t.bankTxnId);
  const can = access.can('payments');
  return (
    <>
      <div className="banner row" style={{ justifyContent: 'space-between' }}>
        <span>Read-only feed from <strong>{TRUST_LABEL}</strong> (simulated). The software never moves money: approved items are paid at M&T, then matched here.</span>
        {can && <button className="btn sm" onClick={() => { actions.syncBank(); notify('Synced with M&T. New transactions matched automatically.'); }}>Sync now</button>}
      </div>
      <section className="panel">
        <div className="panel-head"><h2>Bank transactions</h2><span className="small muted">{bank.filter((b) => !b.matchedId).length} unmatched</span></div>
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Date</th><th>Bank description</th><th className="r">Amount</th><th>Matched to</th></tr></thead>
            <tbody>
              {bank.map((b) => {
                const t = b.matchedId ? s.trustTxns.find((x) => x.id === b.matchedId) : undefined;
                const m = t && lookup.matter(t.matterId);
                const candidates = unmatchedBooks.filter((x) => Math.abs(T.sign(x) - b.amount) < 0.005);
                return (
                  <tr key={b.id} className={b.matchedId ? '' : 'unmatched'}>
                    <td className="num">{fmtDate(b.date)}</td>
                    <td className="num small">{b.description}</td>
                    <td className="r num">{signed(b.amount)}</td>
                    <td>
                      {b.matchedId === 'firm' ? (
                        <span className="pill ok">Firm reimbursed from operating</span>
                      ) : t ? (
                        <span className="small">✓ {m && access.canSee(m) ? m.name : '🔒 Restricted matter'} · {t.memo}</span>
                      ) : (
                        <div className="stack" style={{ gap: 4 }}>
                          <span className="pill danger">Not in the books</span>
                          {can && candidates.length > 0 && (
                            <span className="row" style={{ gap: 4 }}>
                              <select className="input small tight" id={`m-${b.id}`} aria-label="Match to" value={pick[b.id] ?? ''} onChange={(e) => setPick((p) => ({ ...p, [b.id]: e.target.value }))}>
                                <option value="">Match to…</option>
                                {candidates.map((c) => <option key={c.id} value={c.id}>{lookup.matter(c.matterId)?.name}: {c.memo}</option>)}
                              </select>
                              <button className="btn sm" disabled={!pick[b.id]} onClick={() => actions.matchBank(b.id, pick[b.id])}>Match</button>
                            </span>
                          )}
                          {can && b.amount < 0 && candidates.length === 0 && (
                            <span className="small">
                              Looks like a bank charge. Bank fees can’t come out of client money.{' '}
                              <button className="btn sm" onClick={() => { actions.reimburseBankFee(b.id); notify('Recorded: operating reimbursed IOLTA. Ask M&T to charge fees to operating going forward.'); }}>Reimburse from operating</button>
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      {unmatchedBooks.length > 0 && (
        <section className="panel">
          <div className="panel-head"><h2>In the books, not yet at the bank</h2><span className="small muted">Outstanding checks, transfers not yet made, deposits in transit</span></div>
          <ul className="list">
            {unmatchedBooks.map((t) => (
              <li key={t.id} className="spread">
                <span><TxnKindPill t={t} /> <span className="small">{lookup.matter(t.matterId)?.name} · {t.memo}{t.ref ? ` · ${t.ref}` : ''}</span></span>
                <span className="num">{signed(T.sign(t))} <span className="small muted">since {fmtDate(t.date)}</span></span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function Reconcile() {
  const { s, actions, lookup, access, notify } = useStore();
  const thisMonth = todayISO().slice(0, 7);
  const months = [...new Set([thisMonth, ...s.trustTxns.map((t) => t.date.slice(0, 7))])].sort().reverse().slice(0, 6);
  const [period, setPeriod] = useState(months[1] ?? thisMonth);
  const [note, setNote] = useState('');
  const asOf = T.monthEnd(period);
  const r = T.reconcile(s.trustTxns, s.bankTxns, asOf);
  const signedRec = s.reconciliations.find((x) => x.kind === 'monthly' && x.period === period);
  const q = T.quarterOf(asOf);
  const qEnd = T.quarterEnd(q);
  const qr = T.reconcile(s.trustTxns, s.bankTxns, qEnd);
  const qSigned = s.reconciliations.find((x) => x.kind === 'quarterly' && x.period === q);
  const monthLabel = (p: string) => new Date(p + '-15').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const Row = ({ label, v, strong, sub }: { label: string; v: number; strong?: boolean; sub?: boolean }) => (
    <tr><td style={{ paddingLeft: sub ? 28 : undefined }}>{strong ? <strong>{label}</strong> : label}</td><td className="r num">{strong ? <strong>{signed(v)}</strong> : signed(v)}</td></tr>
  );

  return (
    <>
      <div className="row">
        <label className="small" htmlFor="rec-period">Month</label>
        <select className="input" style={{ width: 'auto' }} id="rec-period" value={period} onChange={(e) => setPeriod(e.target.value)}>
          {months.map((m) => <option key={m} value={m}>{monthLabel(m)}{m === thisMonth ? ' (to date)' : ''}</option>)}
        </select>
        <span className="small muted">Virginia Rule 1.15(d): monthly reconciliation of the bank statement and trust journal, quarterly of every client’s balance, each reviewed and approved by the lawyer. Confirm the frequency against the current rule text.</span>
      </div>

      <div className="grid cols-main">
        <section className="panel">
          <div className="panel-head">
            <h2>Monthly three-way reconciliation · {monthLabel(period)}</h2>
            {r.ok ? <span className="pill ok">✓ In balance</span> : <span className="pill danger">⚠ Out of balance by {money(Math.abs(r.unexplained))}</span>}
          </div>
          <div className="table-wrap">
            <table className="t">
              <tbody>
                <Row label={`1. M&T statement balance as of ${fmtDate(asOf)}`} v={r.bankBal} />
                <Row label={`+ Deposits in transit (${r.inTransit.length})`} v={r.inTransit.reduce((n, t) => n + t.amount, 0)} sub />
                <Row label={`− Outstanding checks and transfers (${r.outstanding.length})`} v={-r.outstanding.reduce((n, t) => n + t.amount, 0)} sub />
                <Row label="Adjusted bank balance" v={r.adjusted} strong />
                <Row label="2. Trust journal balance (the firm’s books)" v={r.journal} strong />
                <Row label="3. Total of all client ledgers" v={r.clientTotal} strong />
              </tbody>
            </table>
          </div>
          <div className="panel-body stack" style={{ gap: 8 }}>
            {r.ok ? (
              <div className="banner sev-ok">All three numbers agree.</div>
            ) : (
              <div className="banner sev-danger stack" style={{ gap: 4 }}>
                <span>The adjusted bank balance and the books differ by {money(Math.abs(r.unexplained))}.</span>
                {r.unmatchedBank.map((b) => <span key={b.id} className="small">• Bank item not in the books: {b.description} {signed(b.amount)} on {fmtDate(b.date)}. Fix it on the Bank feed tab.</span>)}
                {r.negatives.map((c) => <span key={c.matterId} className="small">• Negative client balance: {lookup.matter(c.matterId)?.name} {signed(c.balance)}</span>)}
              </div>
            )}
            {r.outstanding.length + r.inTransit.length > 0 && (
              <details className="small">
                <summary>Reconciling items</summary>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {[...r.inTransit, ...r.outstanding].map((t) => <li key={t.id}>{fmtDate(t.date)} · {lookup.matter(t.matterId)?.name} · {t.memo} {t.ref ? `(${t.ref})` : ''} · {signed(T.sign(t))}</li>)}
                </ul>
              </details>
            )}
            {signedRec ? (
              <div className="banner">Approved by {teamName(signedRec.signedBy)} on {fmtDate(signedRec.signedAt)}. {signedRec.notes}</div>
            ) : access.can('payments') ? (
              <div className="row">
                <input className="input small" style={{ flex: '1 1 240px' }} id="rec-note" aria-label="Note" placeholder="Note for the record (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
                <button
                  className="btn primary"
                  disabled={!r.ok || period === thisMonth}
                  title={period === thisMonth ? 'Reconcile after the month ends' : !r.ok ? 'Fix the differences first' : ''}
                  onClick={() => { actions.signReconciliation({ kind: 'monthly', period, asOf, bankBalance: r.bankBal, adjustedBank: r.adjusted, journalBalance: r.journal, clientTotal: r.clientTotal, notes: note || undefined }); notify('Reconciliation approved and saved to the trust records'); }}
                >
                  Approve & sign
                </button>
              </div>
            ) : null}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><h2>Quarterly client ledger review · {q}</h2>{qSigned ? <span className="pill ok">Approved</span> : <span className="pill">Not yet approved</span>}</div>
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>Client matter</th><th className="r">Balance {fmtDate(qEnd)}</th></tr></thead>
              <tbody>
                {qr.clients.map((c) => {
                  const m = lookup.matter(c.matterId);
                  return <tr key={c.matterId}><td>{m && access.canSee(m) ? m.name : '🔒 Restricted matter'}</td><td className={`r num ${c.balance < 0 ? 'sev-text' : ''}`}>{signed(c.balance)}</td></tr>;
                })}
                <tr><td><strong>Total</strong></td><td className="r num"><strong>{money(qr.clientTotal)}</strong></td></tr>
              </tbody>
            </table>
          </div>
          <div className="panel-body stack" style={{ gap: 6 }}>
            <span className="small">{qr.negatives.length ? `⚠ ${qr.negatives.length} negative balance(s)` : '✓ No negative balances'} · {Math.abs(qr.clientTotal - qr.journal) < 0.005 ? '✓ Matches the trust journal' : '⚠ Doesn’t match the trust journal'}</span>
            {!qSigned && access.can('payments') && (
              <div><button className="btn sm" disabled={!!qr.negatives.length || qEnd >= todayISO()} title={qEnd >= todayISO() ? 'Available after the quarter ends' : ''} onClick={() => { actions.signReconciliation({ kind: 'quarterly', period: q, asOf: qEnd, bankBalance: qr.bankBal, adjustedBank: qr.adjusted, journalBalance: qr.journal, clientTotal: qr.clientTotal }); notify('Quarterly review approved'); }}>Approve quarter</button></div>
            )}
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head"><h2>Signed reconciliations</h2></div>
        <ul className="list">
          {s.reconciliations.map((x) => (
            <li key={x.id} className="spread">
              <span>{x.kind === 'monthly' ? monthLabel(x.period) : x.period} · {x.kind}</span>
              <span className="small muted num">bank {money(x.adjustedBank)} · books {money(x.journalBalance)} · clients {money(x.clientTotal)} · {teamName(x.signedBy)} {fmtDate(x.signedAt)}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function Journals() {
  const { s, lookup, access } = useStore();
  const [kind, setKind] = useState<'receipts' | 'disbursements'>('receipts');
  const rows = s.trustTxns.filter((t) => t.status === 'approved' && (kind === 'receipts' ? t.kind === 'deposit' : t.kind !== 'deposit')).sort((a, b) => b.date.localeCompare(a.date));
  return (
    <section className="panel">
      <div className="panel-head">
        <div className="seg" role="group" aria-label="Journal">
          <button aria-pressed={kind === 'receipts'} onClick={() => setKind('receipts')}>Cash receipts journal</button>
          <button aria-pressed={kind === 'disbursements'} onClick={() => setKind('disbursements')}>Cash disbursements journal</button>
        </div>
        <span className="small muted">Kept for the bar’s required retention period</span>
      </div>
      <div className="table-wrap">
        <table className="t">
          <thead><tr><th>Date</th><th>Client matter</th><th>{kind === 'receipts' ? 'Received from' : 'Paid to'}</th><th>Purpose</th><th>Method / ref</th><th className="r">Amount</th><th>Approved by</th></tr></thead>
          <tbody>
            {rows.map((t) => {
              const m = lookup.matter(t.matterId);
              return (
                <tr key={t.id}>
                  <td className="num">{fmtDate(t.date)} {t.date.slice(0, 4)}</td>
                  <td>{m && access.canSee(m) ? m.name : '🔒 Restricted matter'}</td>
                  <td>{t.kind === 'draw' ? `${T.OPERATING_ACCOUNT.name} ••${T.OPERATING_ACCOUNT.last4}` : t.payee ?? '—'}</td>
                  <td>{t.memo}</td>
                  <td className="small">{t.method}{t.ref ? ` · ${t.ref}` : ''}</td>
                  <td className="r num">{money(t.amount)}</td>
                  <td>{t.approvedBy ? teamName(t.approvedBy) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function Trust() {
  const { s } = useStore();
  const [tab, setTab] = useState<Tab>('overview');
  const pending = s.trustTxns.filter((t) => t.status === 'pending').length;
  const unmatched = s.bankTxns.filter((b) => !b.matchedId).length;
  return (
    <>
      <PageHead title="Trust accounting" sub={`Client funds in ${TRUST_LABEL}. Every client has their own ledger that can never go negative, money out needs approval, and the bank feed is matched line by line.`} />
      <div className="tabs" role="tablist">
        {([['overview', 'Overview'], ['approvals', `Approvals${pending ? ` (${pending})` : ''}`], ['bank', `Bank feed${unmatched ? ` (${unmatched})` : ''}`], ['reconcile', 'Reconciliation'], ['journals', 'Journals']] as [Tab, string][]).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === 'overview' && <Overview setTab={setTab} />}
      {tab === 'approvals' && <Approvals />}
      {tab === 'bank' && <BankFeed />}
      {tab === 'reconcile' && <Reconcile />}
      {tab === 'journals' && <Journals />}
    </>
  );
}
