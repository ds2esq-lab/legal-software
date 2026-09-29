import { useState } from 'react';
import { useStore } from '../store';
import type { RoleSide } from '../data';
import { reason, searchConflicts, severity, summarize, type Hit, type Term } from '../conflicts';
import { fmtDate, PageHead } from '../ui';
import { snapshotOf } from '../conflictPanel';
import { todayISO } from '../practice';

export function HitList({ hits }: { hits: Hit[] }) {
  const { go } = useStore();
  if (!hits.length) return <p className="panel-body muted">No one in the firm’s records matches these names, phones or emails.</p>;
  return (
    <ul className="list">
      {hits.map((h) => {
        const sev = severity(h);
        return (
          <li key={h.contact.id} className={`hit sev-${sev}`}>
            <span className="stripe" />
            <div style={{ minWidth: 0, flex: 1 }} className="stack">
              <div className="row" style={{ gap: 6 }}>
                <button className="link" onClick={() => go('contact', h.contact.id)}><strong>{h.contact.name}</strong></button>
                <span className={`pill ${h.strength === 'exact' ? 'danger' : h.strength === 'likely' ? 'warn' : ''}`}>{h.strength === 'exact' ? 'Exact match' : h.strength === 'likely' ? 'Likely match' : 'Possible match'}</span>
                <span className="small muted">{h.why} · searched “{h.term}”</span>
              </div>
              <div className={`small ${sev === 2 ? 'sev-text' : ''}`}>{reason(h)}</div>
              {h.links.length === 0 ? (
                <div className="small muted">Contact exists but isn’t on any matter.</div>
              ) : (
                <div className="row" style={{ gap: 6 }}>
                  {h.links.map((l) => (
                    <button
                      disabled={l.restricted}
                      key={l.kind + l.id}
                      className={`pill link-pill ${l.role.side === 'adverse' ? 'danger' : l.role.side === 'client' ? 'info' : ''}`}
                      onClick={() => go(l.kind === 'pnc' ? 'pnc' : 'matter', l.id)}
                      title={l.restricted ? 'Behind an ethical wall. Ask the responsible attorney.' : `Open ${l.title}`}
                    >
                      {l.restricted ? '🔒 ' : ''}{l.role.name} · {l.title} · {l.kind === 'pnc' ? 'PNC' : l.kind === 'open' ? 'Open matter' : `Former, closed ${l.date ? fmtDate(l.date) + ' ' + l.date.slice(0, 4) : ''}`}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function SummaryBanner({ hits }: { hits: Hit[] }) {
  const sum = summarize(hits);
  return <div className={`banner sev-${sum.level}`}>{sum.text}</div>;
}

type Row = { text: string; side: RoleSide | '' };

export default function Conflicts() {
  const { s, actions, lookup, notify } = useStore();
  const [attachTo, setAttachTo] = useState('');
  const [rows, setRows] = useState<Row[]>([
    { text: 'Riley Brennan', side: 'adverse' },
    { text: 'Margo Dunleavy', side: 'client' },
    { text: '', side: '' },
  ]);
  const terms: Term[] = rows.filter((r) => r.text.trim()).map((r) => ({ text: r.text, side: r.side || undefined }));
  const hits = searchConflicts(terms, s.contacts, s.matters, s.pncs, s.roles);
  const set = (i: number, patch: Partial<Row>) => setRows((rs) => {
    const next = rs.map((r, k) => (k === i ? { ...r, ...patch } : r));
    return next[next.length - 1].text ? [...next, { text: '', side: '' }] : next;
  });

  return (
    <>
      <PageHead title="Conflict check" sub="Searches every contact on every PNC matter, open Client matter and former Client matter, including former names, phone numbers and emails." />
      <div className="grid cols-main">
        <section className="panel">
          <div className="panel-head"><h2>Who’s involved?</h2><span className="small muted">Name (either order), phone or email. Pick a side for a sharper answer.</span></div>
          <div className="panel-body stack" style={{ gap: 8 }}>
            {rows.map((r, i) => (
              <div key={i} className="row" style={{ gap: 6 }}>
                <input className="input" style={{ flex: '1 1 200px' }} id={`cc-${i}`} aria-label={`Person ${i + 1}`} placeholder="e.g. Jordan Okafor, (555) 217-1373, name@email.com" value={r.text} onChange={(e) => set(i, { text: e.target.value })} />
                <select className="input" style={{ width: 'auto' }} id={`cc-side-${i}`} aria-label="Their side in the new matter" value={r.side} onChange={(e) => set(i, { side: e.target.value as Row['side'] })}>
                  <option value="">Side: unknown</option>
                  <option value="client">Our side (client, spouse, PR…)</option>
                  <option value="adverse">Other side (opposing party or counsel)</option>
                  <option value="neutral">Neutral (heir, court, advisor…)</option>
                </select>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="panel-head"><h2>What’s searched</h2></div>
          <div className="panel-body small stack" style={{ gap: 4 }}>
            <span><strong className="num">{s.contacts.length}</strong> contacts</span>
            <span><strong className="num">{s.pncs.length}</strong> PNC matters (including lost and declined)</span>
            <span><strong className="num">{s.matters.filter((m) => m.status === 'open').length}</strong> open Client matters</span>
            <span><strong className="num">{s.matters.filter((m) => m.status === 'closed').length}</strong> former Client matters</span>
            <span className="muted">After the Monday import, all 1,501 completed matters will be searched too.</span>
          </div>
        </section>
      </div>
      {terms.length > 0 && <SummaryBanner hits={hits} />}
      {terms.length > 0 && (
        <section className="panel panel-body row">
          <span className="small"><strong>Attach this check to a matter:</strong></span>
          <select className="input" style={{ width: 'auto' }} id="cc-attach" aria-label="Matter to attach to" value={attachTo} onChange={(e) => setAttachTo(e.target.value)}>
            <option value="">Choose a matter…</option>
            <optgroup label="PNC matters">
              {s.pncs.filter((p) => !p.matterId).map((p) => <option key={p.id} value={`pnc:${p.id}`}>{lookup.clientOf(p)?.name} — {p.title}</option>)}
            </optgroup>
            <optgroup label="Open Client matters">
              {s.matters.filter((m) => m.status === 'open').map((m) => <option key={m.id} value={`matter:${m.id}`}>{m.name}</option>)}
            </optgroup>
          </select>
          {(['clear', 'waived', 'conflict'] as const).map((r) => (
            <button
              key={r}
              className={`btn sm ${r === 'conflict' ? 'danger' : ''}`}
              disabled={!attachTo || (r === 'clear' && summarize(hits).level === 'danger')}
              onClick={() => {
                const [kind, id] = attachTo.split(':') as ['pnc' | 'matter', string];
                actions.recordConflict({ kind, id }, { date: todayISO(), by: 'me', terms: terms.map((t) => t.text), hits: hits.length, snapshot: snapshotOf(hits), result: r });
                notify(`Check attached as “${r}”. It’s on the matter’s Conflicts tab.`);
                setAttachTo('');
              }}
            >
              {r === 'clear' ? 'Attach as cleared' : r === 'waived' ? 'Attach as waived' : 'Attach as conflict'}
            </button>
          ))}
        </section>
      )}
      <section className="panel">
        <div className="panel-head"><h2>Results</h2><span className="small muted">{hits.length} match{hits.length === 1 ? '' : 'es'}</span></div>
        <HitList hits={hits} />
      </section>
    </>
  );
}
