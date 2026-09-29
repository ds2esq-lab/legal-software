import { useState } from 'react';
import { useStore } from '../store';
import { STAGES, TEAM, type Matter, type Stage } from '../data';
import { money } from '../billing';
import { entryValue } from '../calc';
import { BillingPill, DuePill, PageHead, Person, StagePill } from '../ui';

type View = 'board' | 'table';

export default function Matters() {
  const { s, actions, lookup, go, notify } = useStore();
  const [view, setView] = useState<View>('board');
  const [owner, setOwner] = useState('all');
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<Stage | null>(null);

  const list = s.matters.filter((m) => owner === 'all' || m.owner === owner);
  const unbilled = (m: Matter) =>
    s.timeEntries.filter((t) => t.matterId === m.id && !t.invoiced).reduce((n, t) => n + entryValue(t, m, s.billing), 0) +
    s.flatFees.filter((f) => f.matterId === m.id && f.status === 'unbilled').reduce((n, f) => n + f.amount, 0);

  const move = (id: string, stage: Stage) => {
    const m = lookup.matter(id);
    if (!m || m.stage === stage) return;
    actions.moveMatter(id, stage);
    if (stage === 'waiting') {
      const due = new Date(Date.now() + 3 * 86400000);
      due.setHours(10, 0, 0, 0);
      actions.addReminder({ title: `Follow up with ${lookup.clientOf(m)?.name ?? 'client'}`, matterId: id, due: due.toISOString(), assignee: m.owner, escalateTo: 'me', kind: 'client' });
    }
    const label = STAGES.find((x) => x.id === stage)!.label;
    notify(stage === 'waiting' ? `Moved to ${label}. Client gets a portal update and a reminder is set for 3 days.` : `Moved to ${label}. Client portal status updated.`);
  };

  return (
    <>
      <PageHead title="Matters" sub="Every client matter is a project. Drag a card to change its stage. The client’s portal updates with it.">
        <select className="input" style={{ width: 'auto' }} id="owner-filter" aria-label="Filter by owner" value={owner} onChange={(e) => setOwner(e.target.value)}>
          <option value="all">Everyone</option>
          {TEAM.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <div className="seg" role="group" aria-label="View">
          <button aria-pressed={view === 'board'} onClick={() => setView('board')}>Board</button>
          <button aria-pressed={view === 'table'} onClick={() => setView('table')}>Table</button>
        </div>
      </PageHead>

      {view === 'board' ? (
        <div className="board">
          {STAGES.map((st) => {
            const items = list.filter((m) => m.stage === st.id);
            return (
              <div
                key={st.id}
                className={`col ${overCol === st.id ? 'over' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverCol(st.id);
                }}
                onDragLeave={() => setOverCol((c) => (c === st.id ? null : c))}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragId) move(dragId, st.id);
                  setDragId(null);
                  setOverCol(null);
                }}
              >
                <div className="col-head">
                  <span>{st.label}</span>
                  <span className="num small muted">{items.length}</span>
                </div>
                <div className="col-body">
                  {items.map((m) => (
                    <article
                      key={m.id}
                      className={`card ${dragId === m.id ? 'dragging' : ''} ${m.priority === 'high' ? 'prio-high' : ''}`}
                      draggable
                      onDragStart={() => setDragId(m.id)}
                      onDragEnd={() => setDragId(null)}
                    >
                      <div className="spread" style={{ alignItems: 'flex-start' }}>
                        <button className="link t1" style={{ color: 'var(--ink)' }} onClick={() => go('matter', m.id)}>
                          {m.name}
                        </button>
                        <Person id={m.owner} />
                      </div>
                      <div className="small muted">
                        {lookup.clientOf(m)?.name} · <span className="num">{m.number}</span>
                      </div>
                      <div className="row" style={{ gap: 6 }}>
                        <BillingPill b={m.billing} />
                        <DuePill iso={m.nextDeadline} />
                      </div>
                      <select
                        className="input small"
                        aria-label={`Move ${m.name}`}
                        id={`move-${m.id}`}
                        value={m.stage}
                        onChange={(e) => move(m.id, e.target.value as Stage)}
                        style={{ padding: '2px 6px' }}
                      >
                        {STAGES.map((x) => (
                          <option key={x.id} value={x.id}>Move to: {x.label}</option>
                        ))}
                      </select>
                    </article>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="stack" style={{ gap: 16 }}>
          {STAGES.map((st) => {
            const items = list.filter((m) => m.stage === st.id);
            if (!items.length) return null;
            return (
              <section key={st.id} className="panel">
                <div className="panel-head">
                  <h2>
                    {st.label} <span className="num small muted">{items.length}</span>
                  </h2>
                </div>
                <div className="table-wrap">
                  <table className="t">
                    <thead>
                      <tr>
                        <th>Matter</th>
                        <th>Client</th>
                        <th>Area</th>
                        <th>Stage</th>
                        <th>Owner</th>
                        <th>Billing</th>
                        <th>Next deadline</th>
                        <th className="r">Unbilled</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((m) => (
                        <tr key={m.id}>
                          <td>
                            <button className="link" onClick={() => go('matter', m.id)}>{m.name}</button>
                            <div className="small muted num">{m.number}</div>
                          </td>
                          <td>{lookup.clientOf(m)?.name}</td>
                          <td>{m.area}</td>
                          <td>
                            <select className="input small" style={{ padding: '2px 6px', width: 'auto' }} aria-label="Stage" id={`stage-${m.id}`} value={m.stage} onChange={(e) => move(m.id, e.target.value as Stage)}>
                              {STAGES.map((x) => (
                                <option key={x.id} value={x.id}>{x.label}</option>
                              ))}
                            </select>
                          </td>
                          <td><Person id={m.owner} showName /></td>
                          <td><BillingPill b={m.billing} /></td>
                          <td><DuePill iso={m.nextDeadline} /></td>
                          <td className="r num">{money(unbilled(m))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      )}
      <p className="small muted">
        <StagePill stage="waiting" /> Moving a matter to “Waiting on client” sends the client a portal notice and starts a follow-up reminder.
      </p>
    </>
  );
}
