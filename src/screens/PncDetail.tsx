import { useState } from 'react';
import { useStore } from '../store';
import { PNC_STAGES, TEAM, type PncStage } from '../data';
import { touchesFor } from '../intake';
import { NotesPanel, PartiesPanel } from '../people';
import { DuePill, fmtDate, PageHead } from '../ui';
import { ConflictBadge, ConflictPanel } from '../conflictPanel';
import { HireForm } from './Intake';

export default function PncDetail() {
  const { s, pncId, lookup, actions, go, notify } = useStore();
  const [hiring, setHiring] = useState(false);
  const p = lookup.pnc(pncId);
  if (!p) return <p>PNC matter not found.</p>;
  const primary = lookup.clientOf(p);
  const touches = touchesFor(p, s.cadences);
  const up = (patch: Parameters<typeof actions.updatePnc>[1]) => actions.updatePnc(p.id, patch);

  return (
    <>
      <div className="small"><button className="link" onClick={() => go('intake')}>← PNC matters</button></div>
      <PageHead title={primary?.name ?? 'Unnamed prospect'} sub={`PNC matter · ${p.title} · ${p.areaId ? lookup.area(p.areaId)?.name : 'Area not set'} · first contact ${fmtDate(p.firstContact)}`}>
        <ConflictBadge checks={p.conflicts} parties={p.parties} />
        {p.matterId ? (
          <button className="btn primary" onClick={() => go('matter', p.matterId)}>Open Client matter →</button>
        ) : (
          <button className="btn primary" disabled={p.conflicts[0]?.result === 'conflict'} onClick={() => setHiring(true)}>Hired → open Client matter</button>
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
          <ConflictPanel target={{ kind: 'pnc', id: p.id }} parties={p.parties} checks={p.conflicts} />

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
