import { useState } from 'react';
import { useStore } from '../store';
import { PNC_STAGES, TEAM, type Pnc, type PncStage } from '../data';
import { searchConflicts, summarize } from '../conflicts';
import { nextTouch, touchesFor } from '../intake';
import { addDays, newId, todayISO } from '../practice';
import { DuePill, fmtDate, fmtTime, PageHead, Person, relDay } from '../ui';

const OPEN = PNC_STAGES.filter((x) => x.open);
const CLOSED = PNC_STAGES.filter((x) => !x.open);

export function HireForm({ p, onDone }: { p: Pnc; onDone: () => void }) {
  const { s, actions, go, notify } = useStore();
  const [areaId, setAreaId] = useState(p.areaId ?? s.areas[0].id);
  const area = s.areas.find((a) => a.id === areaId)!;
  const [plan, setPlan] = useState('');
  return (
    <div className="stack hire" style={{ gap: 6 }}>
      <select className="input small tight" id={`hire-area-${p.id}`} aria-label="Practice area" value={areaId} onChange={(e) => { setAreaId(e.target.value); setPlan(''); }}>
        {s.areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
      <select className="input small tight" id={`hire-plan-${p.id}`} aria-label={area.planLabel} value={plan} onChange={(e) => setPlan(e.target.value)}>
        <option value="">{area.planLabel}: choose later</option>
        {area.planTypes.map((x) => <option key={x} value={x}>{x}</option>)}
      </select>
      <div className="row" style={{ gap: 4 }}>
        <button
          className="btn sm primary"
          onClick={() => {
            const mid = newId('m');
            actions.hirePnc(p.id, areaId, plan || undefined, mid);
            notify(`Matter opened in ${area.name} › ${area.stages[0].name}. “${area.milestones[0]?.name ?? 'Engaged'}” dated today.`);
            onDone();
            go('matter', mid);
          }}
        >
          Open matter
        </button>
        <button className="btn sm ghost" onClick={onDone}>Cancel</button>
      </div>
    </div>
  );
}

function ConflictPill({ p }: { p: Pnc }) {
  if (!p.conflict) return <span className="pill warn">Conflicts: not run</span>;
  const r = p.conflict.result;
  return <span className={`pill ${r === 'conflict' ? 'danger' : r === 'waived' ? 'warn' : 'ok'}`}>Conflicts: {r}</span>;
}

function PncCard({ p }: { p: Pnc }) {
  const { s, actions, lookup, notify, go } = useStore();
  const who = lookup.clientOf(p);
  const [hiring, setHiring] = useState(false);
  const next = nextTouch(p, s.cadences);
  const all = touchesFor(p, s.cadences);
  const doneCount = all.filter((t) => t.done).length;
  const setStage = (stage: PncStage, extra: Partial<Pnc> = {}) => actions.updatePnc(p.id, { stage, ...extra });

  return (
    <article className="card" style={{ cursor: 'default' }}>
      <div className="spread" style={{ alignItems: 'flex-start' }}>
        <button className="link t1" style={{ color: 'var(--ink)' }} onClick={() => go('pnc', p.id)}>{who?.name ?? 'Unnamed'}</button>
        <Person id={p.owner} />
      </div>
      <div className="small muted">{p.title}</div>
      <div className="row" style={{ gap: 4 }}><ConflictPill p={p} />{p.parties.length > 1 && <span className="small muted">+{p.parties.length - 1} people</span>}</div>
      {p.consultAt && (p.stage === 'scheduled' || p.stage === 'notes') && (
        <div className="small">Consult {relDay(p.consultAt)} {fmtTime(p.consultAt)}</div>
      )}
      {all.length > 0 && (
        <div className="ladder" aria-label="Follow-up schedule">
          {all.map((t) => (
            <span key={t.key} className={t.done ? 'hit-ok' : t.due < todayISO() ? 'hit' : ''} title={`${t.label} · due ${fmtDate(t.due)}${t.done ? ` · done ${fmtDate(t.done)}` : ''}`}>
              {t.key.split(':')[1].replace('-', '−')}
            </span>
          ))}
        </div>
      )}
      {next ? (
        <div className="row" style={{ gap: 6 }}>
          <DuePill iso={next.due} />
          <span className="small">{next.label}</span>
        </div>
      ) : all.length > 0 ? (
        <span className="small muted">All {doneCount} touches done</span>
      ) : null}

      {hiring ? (
        <HireForm p={p} onDone={() => setHiring(false)} />
      ) : (
        <div className="row" style={{ gap: 4 }}>
          {next && <button className="btn sm" onClick={() => { actions.markTouch(p.id, next.key); notify(`Logged: ${next.label}`); }}>Touch done</button>}
          {p.stage === 'inquiry' && (
            <button className="btn sm" onClick={() => { setStage('scheduled', { consultAt: new Date(addDays(todayISO(), 3) + 'T10:00:00').toISOString() }); notify('Consult booked. Pre-consult reminders scheduled.'); }}>Book consult</button>
          )}
          {p.stage === 'scheduled' && <button className="btn sm" onClick={() => { setStage('notes'); notify('Consult held. Waiting on attorney notes.'); }}>Consult held</button>}
          {p.stage === 'notes' && <button className="btn sm" onClick={() => { setStage('followup'); notify('Notes in. Follow-up cadence started.'); }}>Notes done</button>}
          {p.stage === 'followup' && <button className="btn sm" onClick={() => { setStage('el', { elSent: todayISO() }); notify('Engagement letter sent. EL follow-ups scheduled.'); }}>EL sent</button>}
          {(p.stage === 'followup' || p.stage === 'el') && <button className="btn sm primary" onClick={() => setHiring(true)}>Hired</button>}
          <select
            className="input small tight"
            style={{ width: 'auto' }}
            aria-label="Close out prospect"
            id={`close-${p.id}`}
            value=""
            onChange={(e) => {
              const v = e.target.value as PncStage;
              if (!v) return;
              setStage(v, v === 'future' ? { futureDate: addDays(todayISO(), 60) } : {});
              notify(`Marked ${PNC_STAGES.find((x) => x.id === v)!.label.toLowerCase()}.`);
            }}
          >
            <option value="">More…</option>
            <option value="future">Specific future date</option>
            <option value="post">Cadence finished, no answer</option>
            <option value="lost">Lost</option>
          </select>
        </div>
      )}
      {p.matterId && <button className="link small" onClick={() => go('matter', p.matterId)}>Open matter →</button>}
    </article>
  );
}

export default function Intake() {
  const { s, actions, lookup, notify, go } = useStore();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [title, setTitle] = useState('');
  const [others, setOthers] = useState('');
  const [adverse, setAdverse] = useState('');
  const [source, setSource] = useState('Phone call');
  const [areaId, setAreaId] = useState('ep');
  const [owner, setOwner] = useState('dana');

  const open = s.pncs.filter((p) => OPEN.some((x) => x.id === p.stage));
  const queue = open
    .map((p) => ({ p, t: nextTouch(p, s.cadences) }))
    .filter((x) => x.t && x.t.due <= todayISO())
    .sort((a, b) => a.t!.due.localeCompare(b.t!.due));
  const notes = open.filter((p) => p.stage === 'notes');

  return (
    <>
      <PageHead title="PNC matters" sub="One PNC matter per prospect, from first call to hired. The system schedules every follow-up touch; your team works the “Due today” list. Change the cadences in Settings." />

      <div className="grid cols-main">
        <section className="panel">
          <div className="panel-head"><h2>Due today</h2><span className="small muted">{queue.length} touch{queue.length === 1 ? '' : 'es'}{notes.length ? ` · ${notes.length} consult note${notes.length === 1 ? '' : 's'} pending` : ''}</span></div>
          <ul className="list">
            {queue.length === 0 && notes.length === 0 && <li className="muted">Nothing due. Nice.</li>}
            {notes.map((p) => (
              <li key={p.id} className="spread">
                <span><button className="link" onClick={() => go('pnc', p.id)}><strong>{lookup.clientOf(p)?.name}</strong></button><div className="small muted">Consult held {p.consultAt ? relDay(p.consultAt) : ''}. Attorney notes needed before follow-up starts.</div></span>
                <button className="btn sm" onClick={() => { actions.updatePnc(p.id, { stage: 'followup' }); notify('Notes in. Follow-up cadence started.'); }}>Notes done</button>
              </li>
            ))}
            {queue.map(({ p, t }) => (
              <li key={p.id} className="spread">
                <span>
                  <button className="link" onClick={() => go('pnc', p.id)}><strong>{lookup.clientOf(p)?.name}</strong></button> <span className="small muted num">{lookup.clientOf(p)?.phone}</span>
                  <div className="small muted">{t!.label} · {p.areaId ? lookup.area(p.areaId)?.name : ''}</div>
                </span>
                <span className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                  <DuePill iso={t!.due} />
                  <button className="btn sm primary" onClick={() => { actions.markTouch(p.id, t!.key); notify(`Logged: ${t!.label}`); }}>Done</button>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <div className="panel-head"><h2>New PNC matter</h2></div>
          <form
            className="panel-body stack"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              const extra = [
                ...others.split('\n').map((x) => x.trim()).filter(Boolean).map((n) => ({ contactId: actions.addContact({ name: n, kind: 'person', phone: '', email: '' }), role: 'spouse' })),
                ...adverse.split('\n').map((x) => x.trim()).filter(Boolean).map((n) => ({ contactId: actions.addContact({ name: n, kind: 'person', phone: '', email: '' }), role: 'opposing' })),
              ];
              const id = actions.addPnc({ title: title.trim() || 'New inquiry', source, areaId, stage: 'inquiry', firstContact: todayISO(), owner }, { name: name.trim(), kind: 'person', phone, email }, extra);
              setName(''); setPhone(''); setEmail(''); setTitle(''); setOthers(''); setAdverse('');
              notify('PNC matter created. Review the conflict check before booking the consult.');
              go('pnc', id);
            }}
          >
            <div className="field"><label htmlFor="n-name">Name (Last, First)</label><input className="input" id="n-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rivera, Sam" /></div>
            <div className="field"><label htmlFor="n-title">What it’s about</label><input className="input" id="n-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Probate of father’s estate" /></div>
            <div className="grid cols-2" style={{ gap: 8 }}>
              <div className="field"><label htmlFor="n-phone">Phone</label><input className="input num" id="n-phone" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
              <div className="field"><label htmlFor="n-email">Email</label><input className="input" id="n-email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div className="field"><label htmlFor="n-others">Others on their side <span className="muted">(one per line)</span></label><textarea className="input" id="n-others" rows={2} value={others} onChange={(e) => setOthers(e.target.value)} placeholder="Spouse, co-trustee…" /></div>
              <div className="field"><label htmlFor="n-adverse">Other side <span className="muted">(one per line)</span></label><textarea className="input" id="n-adverse" rows={2} value={adverse} onChange={(e) => setAdverse(e.target.value)} placeholder="Opposing party, their lawyer…" /></div>
              <div className="field"><label htmlFor="n-src">Source</label>
                <select className="input" id="n-src" value={source} onChange={(e) => setSource(e.target.value)}>
                  {['Phone call', 'Website form', 'Google', 'Referral: past client', 'Referral: professional', 'Seminar'].map((x) => <option key={x}>{x}</option>)}
                </select>
              </div>
              <div className="field"><label htmlFor="n-area">Practice area</label>
                <select className="input" id="n-area" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
                  {s.areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="field"><label htmlFor="n-owner">Owner</label>
                <select className="input" id="n-owner" value={owner} onChange={(e) => setOwner(e.target.value)}>
                  {TEAM.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
            {name.trim().length > 2 && <LiveConflict name={name} phone={phone} email={email} others={others} adverse={adverse} />}
            <button className="btn primary" type="submit">Create PNC matter</button>
          </form>
        </section>
      </div>

      <div className="board">
        {OPEN.map((st) => {
          const items = s.pncs.filter((p) => p.stage === st.id);
          return (
            <div key={st.id} className="col">
              <div className="col-head"><span>{st.label}</span><span className="num small muted">{items.length}</span></div>
              <div className="col-body">{items.map((p) => <PncCard key={p.id} p={p} />)}</div>
            </div>
          );
        })}
      </div>

      <section className="panel">
        <div className="panel-head"><h2>Closed out</h2><span className="small muted">Kept, not archived, so you can report on where prospects go</span></div>
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Prospect</th><th>Outcome</th><th>Area</th><th>Source</th><th>Consult</th><th /></tr></thead>
            <tbody>
              {s.pncs.filter((p) => CLOSED.some((x) => x.id === p.stage)).map((p) => (
                <tr key={p.id}>
                  <td><button className="link" onClick={() => go('pnc', p.id)}>{lookup.clientOf(p)?.name}</button><div className="small muted">{p.title}</div></td>
                  <td>
                    <span className={`pill ${p.stage === 'hired' ? 'ok' : p.stage === 'lost' ? 'danger' : 'warn'}`}>{PNC_STAGES.find((x) => x.id === p.stage)!.label}</span>
                    {p.stage === 'future' && p.futureDate && <span className="small muted"> · call back {fmtDate(p.futureDate)}</span>}
                  </td>
                  <td>{p.areaId ? lookup.area(p.areaId)?.name : '—'}</td>
                  <td>{p.source}</td>
                  <td className="num">{p.consultAt ? fmtDate(p.consultAt) : '—'}</td>
                  <td className="r">{p.stage !== 'hired' && <button className="btn sm ghost" onClick={() => actions.updatePnc(p.id, { stage: 'followup' })}>Reopen</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

/** Conflict preview while the intake form is being filled in. */
function LiveConflict({ name, phone, email, others, adverse }: { name: string; phone: string; email: string; others: string; adverse: string }) {
  const { s } = useStore();
  const lines = (v: string) => v.split('\n').map((x) => x.trim()).filter(Boolean);
  const terms = [
    { text: name, side: 'client' as const },
    ...(phone.replace(/\D/g, '').length >= 7 ? [{ text: phone, side: 'client' as const }] : []),
    ...(email.includes('@') ? [{ text: email, side: 'client' as const }] : []),
    ...lines(others).map((t) => ({ text: t, side: 'client' as const })),
    ...lines(adverse).map((t) => ({ text: t, side: 'adverse' as const })),
  ];
  const hits = searchConflicts(terms, s.contacts, s.matters, s.pncs, s.roles);
  const sum = summarize(hits);
  return (
    <div className={`banner sev-${sum.level} small`}>
      <strong>Conflict preview:</strong> {sum.text}
      {hits.slice(0, 3).map((h) => <div key={h.contact.id}>· {h.contact.name}: {h.links.map((l) => `${l.role.name} on ${l.title}${l.kind === 'former' ? ' (former)' : l.kind === 'pnc' ? ' (PNC)' : ''}`).join('; ') || 'no matters'}</div>)}
    </div>
  );
}
