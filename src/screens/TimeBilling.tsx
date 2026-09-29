import { useState } from 'react';
import { useStore } from '../store';
import { billedMinutes, formatHours, money } from '../billing';
import { entryValue } from '../calc';
import { BillingPill, fmtDate, PageHead, Person } from '../ui';

export default function TimeBilling() {
  const { s, lookup, go } = useStore();
  const [sample, setSample] = useState('13');
  const n = Math.max(0, parseInt(sample, 10) || 0);

  const rows = s.matters
    .map((m) => {
      const entries = s.timeEntries.filter((t) => t.matterId === m.id && !t.invoiced);
      const mins = entries.filter((t) => t.billable).reduce((a, t) => a + billedMinutes(t.actualMinutes, s.billing), 0);
      const hourly = entries.reduce((a, t) => a + entryValue(t, m, s.billing), 0);
      const flat = s.flatFees.filter((f) => f.matterId === m.id && f.status === 'unbilled').reduce((a, f) => a + f.amount, 0);
      return { m, mins, hourly, flat, total: hourly + flat };
    })
    .filter((r) => r.total > 0 || r.mins > 0)
    .sort((a, b) => b.total - a.total);

  const totalUnbilled = rows.reduce((a, r) => a + r.total, 0);
  const outstanding = s.invoices.filter((i) => i.status === 'sent').reduce((a, i) => a + i.total, 0);
  const drafts = s.invoices.filter((i) => i.status === 'draft');
  const recent = [...s.timeEntries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);

  return (
    <>
      <PageHead title="Time & billing" sub="Hourly, fixed-price and hybrid matters in one ledger. Billing rounds to your firm’s increment automatically.">
        <button className="btn" onClick={() => go('settings')}>Rounding: {s.billing.incrementMinutes} min, {s.billing.mode === 'up' ? 'round up' : 'nearest'}</button>
      </PageHead>

      <div className="stats">
        <div className="stat"><span className="label">Ready to bill</span><span className="v">{money(totalUnbilled)}</span></div>
        <div className="stat"><span className="label">Invoiced, unpaid</span><span className="v">{money(outstanding)}</span></div>
        <div className="stat"><span className="label">Draft invoices (not sent)</span><span className="v">{drafts.length}</span></div>
        <div className="stat"><span className="label">Billing increment</span><span className="v">{s.billing.incrementMinutes === 6 ? '0.1 hr' : `${s.billing.incrementMinutes} min`}</span></div>
      </div>

      <div className="grid cols-main">
        <section className="panel">
          <div className="panel-head"><h2>Ready to bill</h2></div>
          <div className="table-wrap">
            <table className="t">
              <thead>
                <tr><th>Matter</th><th>Fee type</th><th className="r">Hours</th><th className="r">Hourly</th><th className="r">Fixed price</th><th className="r">Total</th><th /></tr>
              </thead>
              <tbody>
                {rows.map(({ m, mins, hourly, flat, total }) => (
                  <tr key={m.id}>
                    <td><button className="link" onClick={() => go('matter', m.id)}>{m.name}</button><div className="small muted">{lookup.clientOf(m)?.name}</div></td>
                    <td><BillingPill b={m.billing} /></td>
                    <td className="r num">{formatHours(mins, s.billing)}</td>
                    <td className="r num">{hourly ? money(hourly) : '—'}</td>
                    <td className="r num">{flat ? money(flat) : '—'}</td>
                    <td className="r num"><strong>{money(total)}</strong></td>
                    <td className="r"><button className="btn sm" onClick={() => go('matter', m.id)}>Review</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><h2>How rounding works</h2></div>
          <div className="panel-body stack">
            <div className="row" style={{ alignItems: 'flex-end' }}>
              <div className="field" style={{ width: 120 }}>
                <label htmlFor="sample-mins">Minutes worked</label>
                <input className="input num" id="sample-mins" type="number" min={0} value={sample} onChange={(e) => setSample(e.target.value)} />
              </div>
              <div style={{ fontSize: 18 }} className="num">
                → {formatHours(billedMinutes(n, s.billing), s.billing)} hr
              </div>
            </div>
            <div className="table-wrap">
              <table className="t">
                <thead><tr><th>Worked</th><th className="r">Billed</th></tr></thead>
                <tbody>
                  {[1, 6, 7, 13, 25, 47].map((x) => (
                    <tr key={x}><td className="num">{x} min</td><td className="r num">{formatHours(billedMinutes(x, s.billing), s.billing)} hr</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="small muted">Clients see billed hours. You keep the actual minutes, so you can see which fixed prices are really profitable.</p>
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head"><h2>Recent time</h2></div>
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Date</th><th>Who</th><th>Matter</th><th>Description</th><th className="r">Actual</th><th className="r">Billed</th><th className="r">Value</th></tr></thead>
            <tbody>
              {recent.map((t) => {
                const m = lookup.matter(t.matterId);
                return (
                  <tr key={t.id}>
                    <td className="num">{fmtDate(t.date)}</td>
                    <td><Person id={t.user} /></td>
                    <td>{m && <button className="link" onClick={() => go('matter', m.id)}>{m.name}</button>}</td>
                    <td style={{ minWidth: 220 }}>{t.description}</td>
                    <td className="r num muted">{t.actualMinutes}m</td>
                    <td className="r num">{formatHours(billedMinutes(t.actualMinutes, s.billing), s.billing)}</td>
                    <td className="r num">{t.billable ? (entryValue(t, m, s.billing) ? money(entryValue(t, m, s.billing)) : 'In fixed price') : 'No charge'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
