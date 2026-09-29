import { useState } from 'react';
import { useStore } from '../store';
import { fmtTime, MatterLink, PageHead, relDay } from '../ui';

export default function Phone() {
  const { s, actions, notify } = useStore();
  const [assign, setAssign] = useState<Record<string, string>>({});

  return (
    <>
      <PageHead title="Phone" sub="Connects to your VoIP system. Calls from known numbers match to the client and matter; each call can become a time entry in one click.">
        <button className="btn primary" disabled={!!s.activeCall} onClick={() => actions.simulateIncomingCall()}>Simulate incoming call</button>
      </PageHead>
      <div className="banner">Prototype: calls here are simulated. The real version connects to your phone provider (RingCentral, Zoom Phone, 8x8, Dialpad and others).</div>
      <section className="panel">
        <div className="panel-head"><h2>Recent calls</h2></div>
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>When</th><th>Who</th><th>Number</th><th>Direction</th><th className="r">Length</th><th>Matter</th><th>Time entry</th></tr></thead>
            <tbody>
              {s.calls.map((c) => (
                <tr key={c.id}>
                  <td className="num">{relDay(c.at)} {fmtTime(c.at)}</td>
                  <td>{c.contact}</td>
                  <td className="num">{c.number}</td>
                  <td>{c.direction === 'in' ? 'Incoming' : 'Outgoing'}</td>
                  <td className="r num">{Math.floor(c.seconds / 60)}:{String(c.seconds % 60).padStart(2, '0')}</td>
                  <td>
                    {c.logged ? (
                      <MatterLink id={c.matterId} />
                    ) : (
                      <select className="input small" style={{ padding: '2px 6px', width: 'auto', maxWidth: 220 }} id={`assign-${c.id}`} aria-label="Assign to matter" value={assign[c.id] ?? c.matterId ?? ''} onChange={(e) => setAssign((a) => ({ ...a, [c.id]: e.target.value }))}>
                        <option value="">Choose matter…</option>
                        {s.matters.filter((m) => m.status === 'open').map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    )}
                  </td>
                  <td>
                    {c.logged ? (
                      <span className="pill ok">Logged</span>
                    ) : (
                      <button
                        className="btn sm"
                        disabled={!(assign[c.id] ?? c.matterId)}
                        onClick={() => {
                          actions.logCall(c.id, (assign[c.id] ?? c.matterId)!);
                          notify('Time entry created from call');
                        }}
                      >
                        Log time
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
