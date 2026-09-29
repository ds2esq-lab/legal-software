import { useState } from 'react';
import { useStore } from '../store';
import { documents, STAGES, teamName } from '../data';
import { billedMinutes, money } from '../billing';
import { hourlyRate } from '../calc';
import { fmtTime, PageHead, relDay } from '../ui';

export default function Portal() {
  const { s, matterId, lookup, actions, go, notify } = useStore();
  const [sel, setSel] = useState(matterId);
  const [text, setText] = useState('');
  const m = lookup.matter(sel) ?? s.matters[0];
  const client = lookup.clientOf(m);
  const stageIdx = STAGES.findIndex((x) => x.id === m.stage);
  const msgs = s.messages.filter((x) => x.channel === m.id && x.clientVisible).sort((a, b) => a.at.localeCompare(b.at));
  const docs = (documents[m.id] ?? []).filter((d) => d.shared);
  const fees = s.flatFees.filter((f) => f.matterId === m.id && f.status !== 'unbilled');
  const hourlyInvoiced = s.timeEntries
    .filter((t) => t.matterId === m.id && t.invoiced && t.billable)
    .reduce((n, t) => n + (billedMinutes(t.actualMinutes, s.billing) / 60) * hourlyRate(m), 0);
  const [hourlyPaid, setHourlyPaid] = useState(false);

  return (
    <>
      <PageHead title="Client portal" sub="Exactly what your client sees when they sign in. Team-only notes and internal documents never show up here.">
        <select className="input" style={{ width: 'auto', maxWidth: 320 }} id="portal-matter" aria-label="Preview as" value={m.id} onChange={(e) => setSel(e.target.value)}>
          {s.matters.map((x) => <option key={x.id} value={x.id}>{lookup.clientOf(x)?.name} — {x.name}</option>)}
        </select>
      </PageHead>

      <div className="portal-frame">
        <div className="portal-top">
          <b>Your Firm Name</b>
          <span className="small muted">Signed in as {client?.name}</span>
        </div>
        <div className="portal-body">
          <section className="panel">
            <div className="panel-body stack">
              <div className="label">{m.name}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600 }}>{STAGES[stageIdx].clientLabel}</div>
              <div className="stages">{STAGES.map((x, i) => <div key={x.id} className={i <= stageIdx ? 'on' : ''} />)}</div>
              <div className="small muted">Step {stageIdx + 1} of {STAGES.length}. Handled by {m.owner === 'me' ? 'your lead attorney' : teamName(m.owner)}.</div>
              {m.stage === 'waiting' && (
                <div className="banner warn">We need something from you to keep moving. See the latest message below.</div>
              )}
            </div>
          </section>

          <div className="grid cols-2">
            <section className="panel">
              <div className="panel-head"><h2>Messages</h2></div>
              <div className="msgs" style={{ maxHeight: 320, overflowY: 'auto' }}>
                {msgs.length === 0 && <p className="muted small">No messages yet.</p>}
                {msgs.map((x) => (
                  <div key={x.id} className="stack" style={{ gap: 2, alignItems: x.author === 'client' ? 'flex-end' : 'flex-start' }}>
                    <div className="small muted">{x.author === 'client' ? 'You' : teamName(x.author) === 'You' ? 'Your attorney' : teamName(x.author)} · {relDay(x.at)} {fmtTime(x.at)}</div>
                    <div style={{ background: x.author === 'client' ? 'var(--accent-soft)' : 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 10, padding: '8px 12px', maxWidth: '90%', overflowWrap: 'anywhere' }}>{x.text}</div>
                  </div>
                ))}
              </div>
              <form
                className="compose"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!text.trim()) return;
                  actions.postMessage(m.id, text.trim(), true, 'client');
                  setText('');
                  notify('Sent. Your legal team is notified, and it appears in the matter thread.');
                }}
              >
                <input className="input" style={{ flex: '1 1 160px' }} id="portal-msg" aria-label="Message your legal team" placeholder="Message your legal team…" value={text} onChange={(e) => setText(e.target.value)} />
                <button className="btn primary" type="submit">Send</button>
              </form>
            </section>

            <div className="stack" style={{ gap: 16 }}>
              <section className="panel">
                <div className="panel-head"><h2>Documents</h2></div>
                <ul className="list">
                  {docs.length === 0 && <li className="muted small">Nothing shared yet.</li>}
                  {docs.map((d) => (
                    <li key={d.name} className="spread">
                      <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{d.name}</span>
                      {d.needsSignature ? <button className="btn sm primary" onClick={() => notify('E-signature opens here (planned integration)')}>Review & sign</button> : <button className="btn sm">View</button>}
                    </li>
                  ))}
                </ul>
              </section>
              <section className="panel">
                <div className="panel-head"><h2>Invoices</h2></div>
                <ul className="list">
                  {fees.length === 0 && hourlyInvoiced === 0 && <li className="muted small">No invoices yet.</li>}
                  {fees.map((f) => (
                    <li key={f.id} className="spread">
                      <span style={{ minWidth: 0 }}>{f.description}<div className="num small muted">{money(f.amount)}</div></span>
                      {f.status === 'paid' ? <span className="pill ok">Paid</span> : <button className="btn sm primary" onClick={() => { actions.payFlatFee(f.id); notify('Payment received. Receipt emailed.'); }}>Pay {money(f.amount)}</button>}
                    </li>
                  ))}
                  {hourlyInvoiced > 0 && (
                    <li className="spread">
                      <span>Legal services (hourly)<div className="num small muted">{money(hourlyInvoiced)}</div></span>
                      {hourlyPaid ? <span className="pill ok">Paid</span> : <button className="btn sm primary" onClick={() => { setHourlyPaid(true); notify('Payment received. Receipt emailed.'); }}>Pay {money(hourlyInvoiced)}</button>}
                    </li>
                  )}
                </ul>
              </section>
              <section className="panel">
                <div className="panel-body spread" style={{ flexWrap: 'wrap' }}>
                  <span>Need to talk?</span>
                  <button className="btn" onClick={() => go('scheduling')}>Book a check-in call</button>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
