import { useState } from 'react';
import { useStore } from '../store';
import type { Matter } from '../data';
import { money } from '../billing';
import * as T from '../trust';
import { todayISO } from '../practice';
import { fmtDate } from '../ui';
import { TxnKindPill } from './Trust';

export function TrustTab({ m }: { m: Matter }) {
  const { s, actions, access, lookup, notify } = useStore();
  const [mode, setMode] = useState<'' | 'deposit' | 'disbursement' | 'refund' | 'draw'>('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [payee, setPayee] = useState('');
  const [method, setMethod] = useState<T.TrustTxn['method']>('check');
  const txns = s.trustTxns.filter((t) => t.matterId === m.id && t.status !== 'rejected').sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const bal = T.balanceOf(m.id, s.trustTxns);
  const avail = T.availableOf(m.id, s.trustTxns);
  const area = lookup.areaOf(m);
  const canPay = access.can('payments');
  const canBill = access.can('invoices');
  const req = s.replenishments.filter((r) => r.matterId === m.id).sort((a, b) => b.date.localeCompare(a.date));
  const client = lookup.clientOf(m);

  // Running balance, oldest first
  let run = 0;
  const withRun = [...txns].reverse().map((t) => { if (t.status === 'approved') run = T.round(run + T.sign(t)); return { t, run }; }).reverse();

  const submit = () => {
    const n = Number(amount);
    if (!n || n <= 0) return;
    if (mode === 'deposit') {
      actions.recordDeposit(m.id, n, memo || 'Deposit', method === 'check' ? 'check' : method, client?.name);
      notify(`${money(n)} recorded in ${client?.name}’s trust ledger`);
    } else if (mode) {
      const ok = actions.requestTrustOut({ matterId: m.id, kind: mode, amount: n, memo: memo || (mode === 'draw' ? 'Earned fee' : mode === 'refund' ? 'Refund of unused funds' : 'Payment'), payee: mode === 'refund' ? client?.name : payee || undefined, method });
      notify(ok ? 'Request created. It needs approval before any money moves.' : `Refused: only ${money(avail)} is available in this client’s trust ledger.`);
      if (!ok) return;
    }
    setMode(''); setAmount(''); setMemo(''); setPayee('');
  };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="stats" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        <div className="stat"><span className="label">Trust balance</span><span className="v">{money(bal)}</span></div>
        <div className="stat"><span className="label">Available</span><span className="v">{money(avail)}</span></div>
        <div className="stat">
          <span className="label">{m.billing.kind === 'hourly' ? 'Evergreen retainer' : 'Fixed price earning'}</span>
          <span className="small" style={{ marginTop: 4 }}>
            {m.billing.kind === 'hourly'
              ? m.retainer ? `Keep ${money(m.retainer.target)}; ask again below ${money(m.retainer.minimum)}` : 'Not set up'
              : area.feeSchedule.length ? area.feeSchedule.map((f) => `${f.percent}% on ${area.milestones.find((x) => x.id === f.milestoneId)?.name ?? f.milestoneId}`).join(' · ') : 'No schedule (Settings → Practice areas)'}
          </span>
        </div>
      </div>

      {m.billing.kind === 'hourly' && canBill && (
        <section className="panel">
          <div className="panel-head"><h2>Evergreen retainer</h2><span className="small muted">When a payment from trust drops the balance below the minimum, the client automatically gets a request to bring it back to the target.</span></div>
          <div className="panel-body row" style={{ alignItems: 'flex-end' }}>
            <div className="field" style={{ width: 140 }}><label htmlFor="rt-target">Target balance</label><input className="input num" type="number" min={0} step={100} id="rt-target" value={m.retainer?.target ?? ''} placeholder="e.g. 5000" onChange={(e) => actions.setRetainer(m.id, e.target.value ? { target: Number(e.target.value), minimum: m.retainer?.minimum ?? Math.round(Number(e.target.value) * 0.3) } : undefined)} /></div>
            <div className="field" style={{ width: 140 }}><label htmlFor="rt-min">Minimum</label><input className="input num" type="number" min={0} step={100} id="rt-min" value={m.retainer?.minimum ?? ''} disabled={!m.retainer} onChange={(e) => m.retainer && actions.setRetainer(m.id, { ...m.retainer, minimum: Number(e.target.value) || 0 })} /></div>
            {m.retainer && bal < m.retainer.target && (
              <button className="btn" onClick={() => { actions.requestReplenishment(m.id, m.retainer!.target - bal); notify(`Request for ${money(m.retainer!.target - bal)} sent to the client portal`); }}>Request {money(T.round(m.retainer.target - bal))} now</button>
            )}
          </div>
          {req.length > 0 && (
            <ul className="list">
              {req.map((r) => (
                <li key={r.id} className="spread">
                  <span className="small">Replenishment request {fmtDate(r.date)} · <strong className="num">{money(r.amount)}</strong></span>
                  {r.status === 'paid' ? <span className="pill ok">Paid {fmtDate(r.paidAt!)}</span> : <span className="pill warn">Waiting on client</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="panel">
        <div className="panel-head">
          <h2>{client?.name}’s trust ledger</h2>
          {canPay && (
            <div className="row" style={{ gap: 4 }}>
              <button className="btn sm" aria-pressed={mode === 'deposit'} onClick={() => { setMode('deposit'); setMethod('lawpay'); }}>+ Deposit</button>
              <button className="btn sm" aria-pressed={mode === 'draw'} onClick={() => { setMode('draw'); setMethod('transfer'); }}>Earned fee → operating</button>
              <button className="btn sm" aria-pressed={mode === 'disbursement'} onClick={() => { setMode('disbursement'); setMethod('check'); }}>Pay a third party</button>
              <button className="btn sm" aria-pressed={mode === 'refund'} onClick={() => { setMode('refund'); setMethod('check'); }}>Refund client</button>
            </div>
          )}
        </div>
        {mode && (
          <form className="panel-body row" style={{ alignItems: 'flex-end', background: 'var(--surface-2)' }} onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <div className="field" style={{ width: 130 }}><label htmlFor="tr-amt">Amount</label><input className="input num" type="number" min={0.01} step={0.01} id="tr-amt" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div className="field" style={{ flex: '1 1 200px' }}><label htmlFor="tr-memo">Purpose</label><input className="input" id="tr-memo" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder={mode === 'deposit' ? 'e.g. Retainer' : mode === 'disbursement' ? 'e.g. Probate filing fee' : ''} /></div>
            {mode === 'disbursement' && <div className="field" style={{ flex: '1 1 160px' }}><label htmlFor="tr-payee">Paid to</label><input className="input" id="tr-payee" value={payee} onChange={(e) => setPayee(e.target.value)} placeholder="e.g. Clerk of Circuit Court" /></div>}
            <div className="field" style={{ width: 130 }}><label htmlFor="tr-method">Method</label>
              <select className="input" id="tr-method" value={method} onChange={(e) => setMethod(e.target.value as T.TrustTxn['method'])}>
                {(mode === 'deposit' ? ['lawpay', 'check', 'wire', 'ach'] : ['check', 'transfer', 'wire', 'ach']).map((x) => <option key={x} value={x}>{x === 'lawpay' ? 'LawPay' : x.toUpperCase() === 'ACH' ? 'ACH' : x[0].toUpperCase() + x.slice(1)}</option>)}
              </select>
            </div>
            <button className="btn primary" type="submit">{mode === 'deposit' ? 'Record deposit' : 'Request (needs approval)'}</button>
            {mode !== 'deposit' && <span className="small muted" style={{ flexBasis: '100%' }}>Available: {money(avail)}. Requests over the available balance are refused.</span>}
          </form>
        )}
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Date</th><th>Type</th><th>Purpose</th><th className="r">In</th><th className="r">Out</th><th className="r">Balance</th><th>Status</th></tr></thead>
            <tbody>
              {withRun.length === 0 && <tr><td colSpan={7} className="muted">No trust activity on this matter.</td></tr>}
              {withRun.map(({ t, run: r }) => (
                <tr key={t.id}>
                  <td className="num">{fmtDate(t.date)}</td>
                  <td><TxnKindPill t={t} /></td>
                  <td className="small">{t.memo}{t.payee && t.kind !== 'deposit' ? ` · ${t.payee}` : ''}{t.ref ? ` · ${t.ref}` : ''}</td>
                  <td className="r num">{t.kind === 'deposit' ? money(t.amount) : ''}</td>
                  <td className="r num">{t.kind !== 'deposit' ? money(t.amount) : ''}</td>
                  <td className="r num">{t.status === 'approved' ? money(r) : '—'}</td>
                  <td>
                    {t.status === 'pending' ? (
                      canPay ? <button className="btn sm primary" onClick={() => { actions.approveTrust(t.id); notify('Approved. Make the payment at M&T; it will match when it posts.'); }}>Approve</button> : <span className="pill warn">Needs approval</span>
                    ) : t.bankTxnId ? <span className="pill ok" title="Matched to the M&T feed">✓ Cleared</span> : <span className="pill">Not yet at bank</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export function ExpensesTab({ m }: { m: Matter }) {
  const { s, actions, access, notify } = useStore();
  const [cat, setCat] = useState(T.EXPENSE_CATEGORIES[0]);
  const [desc, setDesc] = useState('');
  const [amt, setAmt] = useState('');
  const [from, setFrom] = useState<'operating' | 'trust'>('operating');
  const [markup, setMarkup] = useState('0');
  const [billable, setBillable] = useState(true);
  const [receipt, setReceipt] = useState<string | undefined>();
  const list = s.expenses.filter((e) => e.matterId === m.id).sort((a, b) => b.date.localeCompare(a.date));
  const avail = T.availableOf(m.id, s.trustTxns);
  const canAdd = access.can('time') || access.can('invoices');

  return (
    <section className="panel">
      <div className="panel-head"><h2>Expenses</h2><span className="small muted">Costs the firm advances go on the next invoice. Costs paid from the client’s trust funds are shown on the ledger and not charged again.</span></div>
      {canAdd && (
        <form
          className="panel-body stack"
          style={{ gap: 8, background: 'var(--surface-2)' }}
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number(amt);
            if (!n || !desc.trim()) return;
            const ok = actions.addExpense({ matterId: m.id, date: todayISO(), category: cat, description: desc.trim(), amount: n, paidFrom: from, billable, markupPct: Number(markup) || 0, receipt });
            if (!ok) { notify(`Refused: only ${money(avail)} is available in the client’s trust ledger.`); return; }
            notify(from === 'trust' ? 'Expense saved. The payment from trust is waiting for approval.' : 'Expense saved. It will be on the next invoice.');
            setDesc(''); setAmt(''); setReceipt(undefined);
          }}
        >
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <div className="field" style={{ width: 170 }}><label htmlFor="ex-cat">Category</label>
              <select className="input" id="ex-cat" value={cat} onChange={(e) => setCat(e.target.value)}>{T.EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
            </div>
            <div className="field" style={{ flex: '1 1 220px' }}><label htmlFor="ex-desc">Description</label><input className="input" id="ex-desc" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. Certified copies of letters" /></div>
            <div className="field" style={{ width: 110 }}><label htmlFor="ex-amt">Amount</label><input className="input num" type="number" min={0.01} step={0.01} id="ex-amt" value={amt} onChange={(e) => setAmt(e.target.value)} /></div>
          </div>
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <div className="field"><span className="small muted">Paid from</span>
              <div className="seg" role="group" aria-label="Paid from">
                <button type="button" aria-pressed={from === 'operating'} onClick={() => setFrom('operating')}>Firm advanced (operating)</button>
                <button type="button" aria-pressed={from === 'trust'} onClick={() => setFrom('trust')} disabled={avail <= 0} title={avail <= 0 ? 'No trust funds available' : ''}>Client’s trust ({money(avail)})</button>
              </div>
            </div>
            {from === 'operating' && <div className="field" style={{ width: 110 }}><label htmlFor="ex-mu">Markup %</label><input className="input num" type="number" min={0} id="ex-mu" value={markup} onChange={(e) => setMarkup(e.target.value)} /></div>}
            <label className="row small" style={{ gap: 4 }}><input type="checkbox" id="ex-bill" checked={billable} onChange={(e) => setBillable(e.target.checked)} /> Billable</label>
            <label className="btn sm" style={{ cursor: 'pointer' }}>
              {receipt ? `📎 ${receipt}` : 'Attach receipt'}
              <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} id="ex-receipt" onChange={(e) => setReceipt(e.target.files?.[0]?.name)} />
            </label>
            <button className="btn primary" type="submit">Add expense</button>
          </div>
        </form>
      )}
      <div className="table-wrap">
        <table className="t">
          <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Paid from</th><th className="r">Amount</th><th>Receipt</th><th>Status</th></tr></thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={7} className="muted">No expenses on this matter.</td></tr>}
            {list.map((e) => {
              const t = e.trustTxnId ? s.trustTxns.find((x) => x.id === e.trustTxnId) : undefined;
              return (
                <tr key={e.id}>
                  <td className="num">{fmtDate(e.date)}</td>
                  <td>{e.category}</td>
                  <td>{e.description}</td>
                  <td>{e.paidFrom === 'trust' ? <span className="pill info">Client trust</span> : <span className="pill">Firm advanced</span>}</td>
                  <td className="r num">{money(e.amount)}{e.markupPct ? <span className="small muted"> +{e.markupPct}%</span> : ''}</td>
                  <td className="small">{e.receipt ? `📎 ${e.receipt}` : <span className="muted">—</span>}</td>
                  <td>
                    {e.paidFrom === 'trust'
                      ? t?.status === 'pending' ? <span className="pill warn">Awaiting approval</span> : <span className="pill ok">Paid from trust</span>
                      : !e.billable ? <span className="pill">Not billed</span> : e.invoiced ? <span className="pill ok">Invoiced</span> : <span className="pill">Unbilled</span>}
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
