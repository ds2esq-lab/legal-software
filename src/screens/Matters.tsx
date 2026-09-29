import { useState } from 'react';
import { useStore } from '../store';
import { TEAM, OUTSIDE_BALLS, type Matter } from '../data';
import { dueMilestones } from '../calc';
import { contactState } from '../practice';
import { BallSelect, ContactPill, DateField, DuePill, fmtDate, PageHead, Person } from '../ui';
import { CopyText } from '../people';
import { ConflictBadge } from '../conflictPanel';

type View = 'board' | 'table';

function NextDue({ m }: { m: Matter }) {
  const { lookup } = useStore();
  const d = dueMilestones(m, lookup.areaOf(m))[0];
  if (!d) return <span className="small muted">No deadline</span>;
  return (
    <span className="row" style={{ gap: 4 }}>
      <DuePill iso={d.date} />
      <span className="small" style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{d.name}</span>
    </span>
  );
}

function FormerMatters() {
  const { s, lookup, go, actions, notify } = useStore();
  const [q, setQ] = useState('');
  const [areaId, setAreaId] = useState('all');
  const term = q.trim().toLowerCase();
  const rows = s.matters
    .filter((m) => m.status === 'closed')
    .filter((m) => areaId === 'all' || m.areaId === areaId)
    .filter((m) => !term || m.name.toLowerCase().includes(term) || m.parties.some((p) => lookup.contact(p.contactId)?.name.toLowerCase().includes(term)) || m.number.includes(term))
    .sort((a, b) => (b.closedOn ?? '').localeCompare(a.closedOn ?? ''));
  return (
    <>
      <div className="row">
        <input className="input" style={{ flex: '1 1 260px', maxWidth: 420 }} id="former-search" aria-label="Search former clients" placeholder="Search former clients by name or matter number…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" style={{ width: 'auto' }} id="former-area" aria-label="Practice area" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
          <option value="all">All practice areas</option>
          {s.areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <span className="small muted">{rows.length} former matter{rows.length === 1 ? '' : 's'}</span>
      </div>
      <section className="panel table-wrap">
        <table className="t">
          <thead><tr><th>Matter</th><th>Client</th><th>Phone</th><th>Area</th><th>Engaged</th><th>Closed</th><th>Review</th><th /></tr></thead>
          <tbody>
            {rows.map((m) => {
              const c = lookup.clientOf(m);
              return (
                <tr key={m.id}>
                  <td style={{ minWidth: 180 }}><button className="link" onClick={() => go('matter', m.id)}>{m.name}</button><div className="small muted num">{m.number}{m.planType ? ` · ${m.planType}` : ''}</div></td>
                  <td>{c && <button className="link" onClick={() => go('contact', c.id)}>{c.name}</button>}</td>
                  <td><CopyText text={c?.phone ?? ''} label="phone" /></td>
                  <td>{lookup.areaOf(m).name}</td>
                  <td className="num">{fmtDate(m.opened)} {m.opened.slice(0, 4)}</td>
                  <td className="num">{m.closedOn ? `${fmtDate(m.closedOn)} ${m.closedOn.slice(0, 4)}` : '—'}</td>
                  <td>{m.closeout?.review ? <span className={`pill ${m.closeout.review === 'Hell No' ? 'danger' : m.closeout.review === 'Ask First' ? 'warn' : 'ok'}`}>{m.closeout.review}</span> : '—'}</td>
                  <td className="r"><button className="btn sm ghost" onClick={() => { actions.reopenMatter(m.id); notify(`${m.name} reopened`); }}>Reopen</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </>
  );
}

export default function Matters() {
  const { s, actions, lookup, go, notify } = useStore();
  const [scope, setScope] = useState<'open' | 'former'>('open');
  const [areaId, setAreaId] = useState<string>('ep');
  const [view, setView] = useState<View>('board');
  const [ball, setBall] = useState('all');
  const [showStalled, setShowStalled] = useState(true);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  const area = areaId === 'all' ? undefined : lookup.area(areaId);
  const open = s.matters.filter((m) => m.status === 'open');
  const list = open
    .filter((m) => areaId === 'all' || m.areaId === areaId)
    .filter((m) => ball === 'all' || m.ball === ball)
    .filter((m) => showStalled || !m.stalled);

  const move = (m: Matter, stageId: string) => {
    if (m.stageId === stageId) return;
    const a = lookup.areaOf(m);
    actions.moveStage(m.id, stageId);
    const st = a.stages.find((x) => x.id === stageId)!;
    const created = a.stageTasks.filter((t) => t.stageId === stageId).length;
    if (a.stages[a.stages.length - 1].id === stageId) {
      notify(`Moved to ${st.name}. Open the matter to finish the closeout checklist.`);
    } else {
      notify(`Moved to ${st.name}.${created ? ` ${created} task${created === 1 ? '' : 's'} created.` : ''} The client’s portal updated.`);
    }
  };

  const tableFor = (items: Matter[]) => (
    <div className="table-wrap">
      <table className="t">
        <thead>
          <tr>
            <th>Matter</th>
            <th>Client</th>
            <th>Stage</th>
            <th>Whose Ball</th>
            <th>Contact</th>
            <th>Next deadline</th>
            <th>Suspense</th>
          </tr>
        </thead>
        <tbody>
          {items.map((m) => {
            const a = lookup.areaOf(m);
            return (
              <tr key={m.id} className={m.stalled ? 'stalled' : ''}>
                <td style={{ minWidth: 200 }}>
                  <button className="link" onClick={() => go('matter', m.id)}>{m.name}</button>
                  <div className="small muted">
                    {m.planType ?? a.name} · <span className="num">{m.number}</span>
                    {m.stalled && <span className="pill warn" style={{ marginLeft: 6 }}>Stalled</span>}
                  </div>
                  <div className="small" style={{ marginTop: 2 }}>
                    <ConflictBadge checks={m.conflicts} parties={m.parties} />
                  </div>
                </td>
                <td style={{ minWidth: 150 }}>
                  {(() => { const c = lookup.clientOf(m); return c ? <><button className="link small" onClick={() => go('contact', c.id)}>{c.name}</button><div className="small"><CopyText text={c.phone} label="phone" /></div></> : null; })()}
                </td>
                <td>
                  <select className="input small tight" aria-label="Stage" id={`stage-${m.id}`} value={m.stageId} onChange={(e) => move(m, e.target.value)}>
                    {a.stages.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </select>
                </td>
                <td><BallSelect compact id={`ball-${m.id}`} value={m.ball} onChange={(v) => actions.updateMatter(m.id, { ball: v })} /></td>
                <td>
                  <div className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                    <ContactPill m={m} />
                    <button className="btn sm ghost" title="Log a client contact today" onClick={() => { actions.logContact(m.id); notify('Contact logged. Timer reset.'); }}>Log</button>
                  </div>
                </td>
                <td><NextDue m={m} /></td>
                <td>
                  <DateField id={`susp-${m.id}`} label="Suspense date" value={m.suspense} onChange={(v) => actions.updateMatter(m.id, { suspense: v })} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const followUps = list.filter((m) => contactState(m.lastContact, lookup.areaOf(m)) === 'followup').length;

  return (
    <>
      <PageHead title="Client matters" sub="Open matters by practice area, and every former client. Each practice area has its own stages, milestones and contact timer.">
        <div className="seg" role="group" aria-label="Open or former">
          <button aria-pressed={scope === 'open'} onClick={() => setScope('open')}>Open <span className="num">{open.length}</span></button>
          <button aria-pressed={scope === 'former'} onClick={() => setScope('former')}>Former clients <span className="num">{s.matters.length - open.length}</span></button>
        </div>
        {scope === 'open' && <>
        <select className="input" style={{ width: 'auto' }} id="ball-filter" aria-label="Filter by whose ball" value={ball} onChange={(e) => setBall(e.target.value)}>
          <option value="all">Whose Ball: anyone</option>
          {TEAM.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          {OUTSIDE_BALLS.map((b) => <option key={b.id} value={b.id}>Waiting on {b.name.toLowerCase()}</option>)}
        </select>
        <label className="row small" style={{ gap: 4 }}>
          <input type="checkbox" id="show-stalled" checked={showStalled} onChange={(e) => setShowStalled(e.target.checked)} /> Show stalled
        </label>
        <div className="seg" role="group" aria-label="View">
          <button aria-pressed={view === 'board'} disabled={areaId === 'all'} onClick={() => setView('board')}>Board</button>
          <button aria-pressed={view === 'table' || areaId === 'all'} onClick={() => setView('table')}>Table</button>
        </div>
        </>}
      </PageHead>

      {scope === 'former' ? <FormerMatters /> : <>
      <div className="tabs" role="tablist" aria-label="Practice area">
        <button role="tab" aria-selected={areaId === 'all'} onClick={() => setAreaId('all')}>
          All <span className="num muted">{open.length}</span>
        </button>
        {s.areas.map((a) => (
          <button key={a.id} role="tab" aria-selected={areaId === a.id} onClick={() => setAreaId(a.id)}>
            {a.name} <span className="num muted">{open.filter((m) => m.areaId === a.id).length}</span>
          </button>
        ))}
      </div>

      <div className="small muted">
        {list.length} matter{list.length === 1 ? '' : 's'} · {followUps} need follow-up
        {area && <> · {area.name}: contact soon after {area.cadence.soon} days, follow-up needed after {area.cadence.followUp}</>}
      </div>

      {area && view === 'board' ? (
        <div className="board">
          {area.stages.map((st) => {
            const items = list.filter((m) => m.stageId === st.id);
            return (
              <div
                key={st.id}
                className={`col ${overCol === st.id ? 'over' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setOverCol(st.id); }}
                onDragLeave={() => setOverCol((c) => (c === st.id ? null : c))}
                onDrop={(e) => {
                  e.preventDefault();
                  const m = dragId ? lookup.matter(dragId) : undefined;
                  if (m) move(m, st.id);
                  setDragId(null);
                  setOverCol(null);
                }}
              >
                <div className="col-head"><span>{st.name}</span><span className="num small muted">{items.length}</span></div>
                <div className="col-body">
                  {items.map((m) => (
                    <article
                      key={m.id}
                      className={`card ${dragId === m.id ? 'dragging' : ''} ${m.priority ? 'prio-high' : ''} ${m.stalled ? 'stalled' : ''}`}
                      draggable
                      onDragStart={() => setDragId(m.id)}
                      onDragEnd={() => setDragId(null)}
                    >
                      <div className="spread" style={{ alignItems: 'flex-start' }}>
                        <button className="link t1" style={{ color: 'var(--ink)' }} onClick={() => go('matter', m.id)}>{m.name}</button>
                        <Person id={m.ball} />
                      </div>
                      <div className="small muted">{m.planType ?? area.name}</div>
                      <div className="row" style={{ gap: 4 }}>
                        <ContactPill m={m} />
                        {m.stalled && <span className="pill warn">Stalled</span>}
                      </div>
                      <NextDue m={m} />
                      {m.suspense && (
                        <div className="small row" style={{ gap: 4 }}>
                          <DuePill iso={m.suspense} prefix="Suspense · " />
                          <span className="muted" style={{ overflowWrap: 'anywhere' }}>{m.suspenseNote}</span>
                        </div>
                      )}
                      <select className="input small tight" aria-label={`Move ${m.name}`} id={`move-${m.id}`} value={m.stageId} onChange={(e) => move(m, e.target.value)}>
                        {area.stages.map((x) => <option key={x.id} value={x.id}>Move to: {x.name}</option>)}
                      </select>
                    </article>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : area ? (
        <section className="panel">{tableFor(list)}</section>
      ) : (
        <div className="stack" style={{ gap: 16 }}>
          {s.areas.map((a) => {
            const items = list.filter((m) => m.areaId === a.id);
            if (!items.length) return null;
            return (
              <section key={a.id} className="panel">
                <div className="panel-head">
                  <h2>{a.name} <span className="num small muted">{items.length}</span></h2>
                  <button className="btn sm ghost" onClick={() => { setAreaId(a.id); setView('board'); }}>Open board →</button>
                </div>
                {tableFor(items)}
              </section>
            );
          })}
        </div>
      )}
      </>}
    </>
  );
}
