import { useState } from 'react';
import { useStore } from '../store';
import { PNC_STAGES, TEAM, teamName, type PncStage } from '../data';
import { searchConflicts, summarize, type Term } from '../conflicts';
import { touchesFor } from '../intake';
import { todayISO } from '../practice';
import { NotesPanel, PartiesPanel } from '../people';
import { DuePill, fmtDate, PageHead } from '../ui';
import { HitList, SummaryBanner } from './Conflicts';
import { HireForm } from './Intake';

export default function PncDetail() {
  const { s, pncId, lookup, actions, go, notify } = useStore();
  const [hiring, setHiring] = useState(false);
  const p = lookup.pnc(pncId);
  if (!p) return <p>PNC matter not found.</p>;
  const primary = lookup.clientOf(p);
  const touches = touchesFor(p, s.cadences);
  const up = (patch: Parameters<typeof actions.updatePnc>[1]) => actions.updatePnc(p.id, patch);

  // Conflict check straight from the people on this PNC matter
  const terms: Term[] = p.parties.flatMap((party) => {
    const c = lookup.contact(party.contactId);
    if (!c) return [];
    const side = lookup.role(party.role).side;
    return [{ text: c.name, side }, ...(c.aka ? [{ text: c.aka.replace(/\(.*?\)/g, ''), side }] : []), ...(c.phone ? [{ text: c.phone, side }] : [])];
  });
  const hits = searchConflicts(terms, s.contacts, s.matters, s.pncs, s.roles, p.id);
  const sum = summarize(hits);
  const record = (result: 'clear' | 'waived' | 'conflict') => {
    actions.recordConflict(p.id, { date: todayISO(), by: 'me', terms: p.parties.map((x) => lookup.contact(x.contactId)?.name ?? ''), hits: hits.length, result });
    notify(result === 'conflict' ? 'Recorded as a conflict. PNC matter declined.' : `Conflict check recorded: ${result}.`);
  };

  return (
    <>
      <div className="small"><button className="link" onClick={() => go('intake')}>← PNC matters</button></div>
      <PageHead title={primary?.name ?? 'Unnamed prospect'} sub={`PNC matter · ${p.title} · ${p.areaId ? lookup.area(p.areaId)?.name : 'Area not set'} · first contact ${fmtDate(p.firstContact)}`}>
        {p.conflict ? (
          <span className={`pill ${p.conflict.result === 'conflict' ? 'danger' : p.conflict.result === 'waived' ? 'warn' : 'ok'}`}>Conflicts: {p.conflict.result}</span>
        ) : (
          <span className="pill warn">Conflict check not recorded</span>
        )}
        {p.matterId ? (
          <button className="btn primary" onClick={() => go('matter', p.matterId)}>Open Client matter →</button>
        ) : (
          <button className="btn primary" disabled={p.conflict?.result === 'conflict'} onClick={() => setHiring(true)}>Hired → open Client matter</button>
        )}
      </PageHead>

      {hiring && !p.matterId && (
        <section className="panel panel-body" style={{ maxWidth: 420 }}>
          <strong>Open a Client matter</strong>
          <p className="small muted">Everyone on this PNC matter, their roles and the notes carry over. Nothing is retyped.</p>
          <HireForm p={p} onDone={() => setHiring(false)} />
        </section>
      )}

      <div className="grid cols-main">
        <div className="stack" style={{ gap: 16 }}>
          <section className="panel">
            <div className="panel-head">
              <h2>Conflict check</h2>
              {p.conflict && <span className="small muted">Recorded {fmtDate(p.conflict.date)} by {teamName(p.conflict.by)}: {p.conflict.result}</span>}
            </div>
            <div className="panel-body stack" style={{ gap: 10 }}>
              <SummaryBanner hits={hits} />
              <span className="small muted">Runs automatically on everyone listed below, including phone numbers and former names. Add the other side’s names to “People” to include them.</span>
            </div>
            <HitList hits={hits} />
            <div className="panel-body row" style={{ borderTop: '1px solid var(--line)' }}>
              <span className="small">Attorney decision:</span>
              <button className="btn sm" onClick={() => record('clear')} disabled={sum.level === 'danger'}>Clear</button>
              <button className="btn sm" onClick={() => record('waived')}>Waived (written consent)</button>
              <button className="btn sm danger" onClick={() => record('conflict')}>Conflict: decline</button>
            </div>
          </section>

          <PartiesPanel target={{ kind: 'pnc', id: p.id }} parties={p.parties} title="People on this PNC matter" />

          <NotesPanel target={{ kind: 'pnc', id: p.id }} notes={p.notes} />
        </div>

        <div className="stack" style={{ gap: 16 }}>
          <section className="panel">
            <div className="panel-head"><h2>Details</h2></div>
            <div className="panel-body stack" style={{ gap: 10 }}>
              <div className="field"><label htmlFor="pn-title">What it’s about</label><input className="input" id="pn-title" value={p.title} onChange={(e) => up({ title: e.target.value })} /></div>
              <div className="field">
                <label htmlFor="pn-stage">Stage</label>
                <select className="input" id="pn-stage" value={p.stage} onChange={(e) => up({ stage: e.target.value as PncStage })}>
                  {PNC_STAGES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="pn-area">Practice area</label>
                <select className="input" id="pn-area" value={p.areaId ?? ''} onChange={(e) => up({ areaId: e.target.value || undefined })}>
                  <option value="">Not sure yet</option>
                  {s.areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="pn-owner">Owner</label>
                <select className="input" id="pn-owner" value={p.owner} onChange={(e) => up({ owner: e.target.value })}>
                  {TEAM.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="pn-consult">Consult</label>
                <input className="input num" id="pn-consult" type="datetime-local" value={p.consultAt ? new Date(new Date(p.consultAt).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''} onChange={(e) => up({ consultAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })} />
              </div>
              <div className="field"><label htmlFor="pn-src">Source</label><input className="input" id="pn-src" value={p.source} onChange={(e) => up({ source: e.target.value })} /></div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head"><h2>Follow-up schedule</h2><span className="small muted">{PNC_STAGES.find((x) => x.id === p.stage)!.label}</span></div>
            <ul className="list">
              {touches.length === 0 && <li className="muted small">No touches scheduled in this stage.</li>}
              {touches.map((t) => (
                <li key={t.key} className="spread">
                  <span className="small">{t.label}</span>
                  {t.done ? (
                    <span className="pill ok">Done {fmtDate(t.done)}</span>
                  ) : (
                    <span className="row" style={{ gap: 4 }}>
                      <DuePill iso={t.due} />
                      <button className="btn sm" onClick={() => { actions.markTouch(p.id, t.key); notify(`Logged: ${t.label}`); }}>Done</button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
