import { useState } from 'react';
import { useStore } from '../store';
import { documents, STAGES, teamName, type Matter } from '../data';
import { billedMinutes, formatHours, money } from '../billing';
import { entryValue, hourlyRate } from '../calc';
import { billingLabel, DuePill, fmtDate, fmtTime, PageHead, Person, relDay, StagePill } from '../ui';
import Thread from '../Thread';

type Tab = 'overview' | 'time' | 'billing' | 'messages' | 'documents';

export function InvoicePreview({ m }: { m: Matter }) {
  const { s, actions, notify } = useStore();
  const fees = s.flatFees.filter((f) => f.matterId === m.id && f.status === 'unbilled');
  const entries = s.timeEntries.filter((t) => t.matterId === m.id && !t.invoiced && t.billable);
  const hourlyApplies = hourlyRate(m) > 0;
  const hourlyTotal = hourlyApplies ? entries.reduce((n, t) => n + entryValue(t, m, s.billing), 0) : 0;
  const total = fees.reduce((n, f) => n + f.amount, 0) + hourlyTotal;

  return (
    <div className="stack">
      <div className="table-wrap">
        <table className="t">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th className="r">Hours</th>
              <th className="r">Rate</th>
              <th className="r">Amount</th>
            </tr>
          </thead>
          <tbody>
            {fees.map((f) => (
              <tr key={f.id}>
                <td className="muted">Flat fee</td>
                <td>{f.description}</td>
                <td className="r muted">—</td>
                <td className="r muted">—</td>
                <td className="r num">{money(f.amount)}</td>
              </tr>
            ))}
            {hourlyApplies &&
              entries.map((t) => (
                <tr key={t.id}>
                  <td className="num">{fmtDate(t.date)}</td>
                  <td>{t.description}</td>
                  <td className="r num">{formatHours(billedMinutes(t.actualMinutes, s.billing), s.billing)}</td>
                  <td className="r num">{money(hourlyRate(m))}</td>
                  <td className="r num">{money(entryValue(t, m, s.billing))}</td>
                </tr>
              ))}
            {!fees.length && (!hourlyApplies || !entries.length) && (
              <tr>
                <td colSpan={5} className="muted">Nothing unbilled on this matter.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {!hourlyApplies && entries.length > 0 && (
        <p className="small muted">
          {entries.length} time {entries.length === 1 ? 'entry is' : 'entries are'} tracked on this flat-fee matter for profitability only. They won’t appear on the invoice.
        </p>
      )}
      <div className="spread" style={{ flexWrap: 'wrap' }}>
        <span>
          <span className="label">Invoice total</span>{' '}
          <span className="num" style={{ fontSize: 20, marginLeft: 8 }}>{money(total)}</span>
        </span>
        <button
          className="btn primary"
          disabled={total === 0}
          onClick={() => {
            actions.invoiceMatter(m.id);
            notify(`Invoice for ${money(total)} created and posted to the client portal`);
          }}
        >
          Create invoice & send to portal
        </button>
      </div>
    </div>
  );
}

function TimeTab({ m }: { m: Matter }) {
  const { s, actions, notify } = useStore();
  const [mins, setMins] = useState('7');
  const [desc, setDesc] = useState('');
  const entries = s.timeEntries.filter((t) => t.matterId === m.id);
  const n = Math.max(0, parseInt(mins, 10) || 0);
  const billed = billedMinutes(n, s.billing);

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="panel">
        <div className="panel-head">
          <h2>Add time</h2>
          <button className="btn sm" onClick={() => actions.startTimer(m.id, '')}>Start timer on this matter</button>
        </div>
        <div className="panel-body row" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ width: 110 }}>
            <label htmlFor="mins">Minutes worked</label>
            <input className="input num" id="mins" type="number" min={0} value={mins} onChange={(e) => setMins(e.target.value)} />
          </div>
          <div className="field" style={{ flex: '1 1 240px' }}>
            <label htmlFor="desc">Description (appears on invoice)</label>
            <input className="input" id="desc" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. Review and revise operating agreement" />
          </div>
          <button
            className="btn primary"
            disabled={n === 0}
            onClick={() => {
              actions.addTimeEntry({ matterId: m.id, date: new Date().toISOString().slice(0, 10), actualMinutes: n, description: desc || 'Untitled work', user: 'me', billable: true, invoiced: false, source: 'manual' });
              setDesc('');
              notify(`Saved: ${n} min worked → ${formatHours(billed, s.billing)} hr billed`);
            }}
          >
            Save entry
          </button>
        </div>
        <div className="panel-body small" style={{ paddingTop: 0 }}>
          <span className="muted">Rounding rule: </span>
          <span className="num">{n} min</span> → <strong className="num">{formatHours(billed, s.billing)} hr</strong>
          <span className="muted"> ({s.billing.mode === 'up' ? 'round up' : 'round to nearest'} to {s.billing.incrementMinutes}-minute increments, {s.billing.minimumMinutes}-minute minimum)</span>
        </div>
      </div>

      <div className="panel table-wrap">
        <table className="t">
          <thead>
            <tr>
              <th>Date</th>
              <th>Who</th>
              <th>Description</th>
              <th className="r">Actual</th>
              <th className="r">Billed</th>
              <th>Source</th>
              <th>Billable</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((t) => (
              <tr key={t.id}>
                <td className="num">{fmtDate(t.date)}</td>
                <td><Person id={t.user} /></td>
                <td style={{ minWidth: 220 }}>{t.description}</td>
                <td className="r num muted">{t.actualMinutes}m</td>
                <td className="r num">{formatHours(billedMinutes(t.actualMinutes, s.billing), s.billing)}</td>
                <td><span className="pill">{t.source ?? 'manual'}</span></td>
                <td>
                  <input type="checkbox" id={`bill-${t.id}`} aria-label="Billable" checked={t.billable} disabled={t.invoiced} onChange={() => actions.toggleBillable(t.id)} />
                </td>
                <td>{t.invoiced ? <span className="pill ok">Invoiced</span> : <span className="pill">Unbilled</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function MatterDetail() {
  const { s, matterId, lookup, go } = useStore();
  const [tab, setTab] = useState<Tab>('overview');
  const m = lookup.matter(matterId);
  if (!m) return <p>Matter not found.</p>;
  const client = lookup.clientOf(m);
  const stageIdx = STAGES.findIndex((x) => x.id === m.stage);
  const rems = s.reminders.filter((r) => r.matterId === m.id && !r.done).sort((a, b) => a.due.localeCompare(b.due));
  const evs = s.events.filter((e) => e.matterId === m.id).sort((a, b) => a.start.localeCompare(b.start));
  const calls = s.calls.filter((c) => c.matterId === m.id);
  const docs = documents[m.id] ?? [];

  return (
    <>
      <div className="small">
        <button className="link" onClick={() => go('matters')}>← Matters</button>
      </div>
      <PageHead title={m.name} sub={`${client?.name} · ${m.area} · Matter ${m.number}`}>
        <StagePill stage={m.stage} />
        <button className="btn" onClick={() => go('portal', m.id)}>View client portal</button>
      </PageHead>

      <div className="stack" style={{ gap: 6 }}>
        <div className="stages" aria-label={`Stage ${stageIdx + 1} of ${STAGES.length}`}>
          {STAGES.map((x, i) => <div key={x.id} className={i <= stageIdx ? 'on' : ''} />)}
        </div>
        <div className="small muted">{STAGES.map((x) => x.label).join('  ·  ')}</div>
      </div>

      <div className="tabs" role="tablist">
        {(['overview', 'time', 'billing', 'messages', 'documents'] as Tab[]).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid cols-main">
          <div className="stack" style={{ gap: 16 }}>
            <section className="panel">
              <div className="panel-head"><h2>Deadlines & reminders</h2><button className="btn sm ghost" onClick={() => go('reminders')}>Manage →</button></div>
              <ul className="list">
                {rems.length === 0 && <li className="muted">None open.</li>}
                {rems.map((r) => (
                  <li key={r.id} className="spread">
                    <span>{r.title}<div className="small muted">{teamName(r.assignee)}{r.escalateTo ? ` · escalates to ${teamName(r.escalateTo)}` : ''}</div></span>
                    <DuePill iso={r.due} />
                  </li>
                ))}
              </ul>
            </section>
            <section className="panel">
              <div className="panel-head"><h2>Activity</h2></div>
              <ul className="list">
                {evs.map((e) => (
                  <li key={e.id}><span className="pill">{e.kind}</span><span>{e.title}<div className="small muted">{relDay(e.start)} {fmtTime(e.start)} · {e.minutes} min</div></span></li>
                ))}
                {calls.map((c) => (
                  <li key={c.id}><span className="pill info">call</span><span>{c.direction === 'in' ? 'Incoming' : 'Outgoing'} call · {c.contact}<div className="small muted">{relDay(c.at)} {fmtTime(c.at)} · {Math.ceil(c.seconds / 60)} min {c.logged ? '· time logged' : ''}</div></span></li>
                ))}
              </ul>
            </section>
          </div>
          <section className="panel">
            <div className="panel-head"><h2>Matter details</h2></div>
            <div className="panel-body stack">
              <div><div className="label">Client</div>{client?.name}<div className="small muted">{client?.email} · {client?.phone}</div></div>
              <div><div className="label">Responsible attorney</div><Person id={m.owner} showName /></div>
              <div><div className="label">Fee arrangement</div>{billingLabel(m.billing)}{m.billing.kind === 'hybrid' && <div className="small muted">Flat fee covers: {m.billing.covers}. Anything else is hourly.</div>}</div>
              <div><div className="label">Opened</div>{fmtDate(m.opened)}</div>
              <div><div className="label">Next deadline</div><DuePill iso={m.nextDeadline} /></div>
            </div>
          </section>
        </div>
      )}
      {tab === 'time' && <TimeTab m={m} />}
      {tab === 'billing' && (
        <section className="panel">
          <div className="panel-head"><h2>Draft invoice</h2><span className="small muted">{billingLabel(m.billing)}</span></div>
          <div className="panel-body"><InvoicePreview m={m} /></div>
        </section>
      )}
      {tab === 'messages' && (
        <section className="panel"><Thread channel={m.id} allowClient clientName={client?.name} /></section>
      )}
      {tab === 'documents' && (
        <section className="panel">
          <div className="panel-head"><h2>Documents</h2><button className="btn sm">Upload</button></div>
          <ul className="list">
            {docs.length === 0 && <li className="muted">No documents yet.</li>}
            {docs.map((d) => (
              <li key={d.name} className="spread">
                <span className="row"><span className="pill num">{d.kind}</span>{d.name}</span>
                <span className="row">
                  {d.needsSignature && <span className="pill warn">Awaiting signature</span>}
                  {d.shared ? <span className="pill info">Shared with client</span> : <span className="pill">Internal</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
