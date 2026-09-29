import { useState } from 'react';
import { useStore } from '../store';
import { TEAM, teamName, type Reminder } from '../data';
import { daysFromToday, fmtDate, fmtTime, MatterLink, PageHead, relDay } from '../ui';

const KIND_LABEL: Record<Reminder['kind'], string> = {
  court: 'Court deadline',
  statute: 'Statute of limitations',
  client: 'Client follow-up',
  internal: 'Internal',
};

/** The fixed nudge schedule every reminder follows. Court/statute get the long runway. */
function ladder(r: Reminder) {
  const hard = r.kind === 'court' || r.kind === 'statute';
  const steps = hard ? ['30 days', '14 days', '7 days', '3 days', '1 day', 'Morning of', '2h before'] : ['3 days', '1 day', 'Morning of'];
  const left = daysFromToday(r.due);
  const thresholds = hard ? [30, 14, 7, 3, 1, 0, 0] : [3, 1, 0];
  return steps.map((label, i) => ({ label, hit: left <= thresholds[i] }));
}

function Row({ r }: { r: Reminder }) {
  const { actions, notify } = useStore();
  const [open, setOpen] = useState(false);
  const late = !r.done && new Date(r.due).getTime() < Date.now();
  const soon = !late && daysFromToday(r.due) <= 1;
  const hard = r.kind === 'court' || r.kind === 'statute';
  const snoozesLeft = Math.max(0, 3 - r.snoozes);

  const snooze = (label: string, hours: number) => {
    actions.snoozeReminder(r.id, label, hours);
    notify(
      r.snoozes + 1 >= 3 && r.escalateTo
        ? `Snoozed. That’s the third snooze, so ${teamName(r.escalateTo)} has been looped in.`
        : hard
          ? `Next nudge in ${label}. The deadline itself does not move.`
          : `Snoozed ${label}`,
    );
  };

  return (
    <div className={`rem ${r.done ? 'done' : late ? 'overdue' : soon ? 'soon' : ''}`}>
      <span className="stripe" />
      <div style={{ minWidth: 0 }}>
        <div className="row" style={{ gap: 6 }}>
          <strong style={{ textDecoration: r.done ? 'line-through' : undefined }}>{r.title}</strong>
          <span className={`pill ${hard ? 'danger' : r.kind === 'client' ? 'info' : ''}`}>{KIND_LABEL[r.kind]}</span>
        </div>
        <div className="small muted row" style={{ gap: 6 }}>
          <MatterLink id={r.matterId} />
          <span>·</span>
          <span style={{ color: late ? 'var(--danger)' : undefined }}>{late ? 'Overdue since ' : 'Due '}{relDay(r.due)}, {fmtDate(r.due)} {fmtTime(r.due)}</span>
          <span>·</span>
          <span>{teamName(r.assignee)}{r.escalateTo ? ` → escalates to ${teamName(r.escalateTo)}` : ''}</span>
        </div>
        <div className="ladder" aria-label="Reminder schedule">
          {ladder(r).map((s, i) => (
            <span key={i} className={s.hit ? 'hit' : ''}>{s.label}</span>
          ))}
        </div>
        {open && (
          <ul className="small muted" style={{ margin: '8px 0 0', paddingLeft: 18 }}>
            {r.log.length ? r.log.map((l, i) => <li key={i}>{l}</li>) : <li>No activity yet.</li>}
          </ul>
        )}
      </div>
      {!r.done && (
        <div className="stack" style={{ gap: 6, alignItems: 'flex-end' }}>
          <button className="btn sm primary" onClick={() => { actions.completeReminder(r.id); notify('Done. Logged on the matter.'); }}>Done</button>
          <div className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
            <button className="btn sm" disabled={snoozesLeft === 0} onClick={() => snooze('1 hour', 1)}>1h</button>
            <button className="btn sm" disabled={snoozesLeft === 0} onClick={() => snooze('until tomorrow', 24)}>Tomorrow</button>
          </div>
          <button className="btn sm ghost small" onClick={() => setOpen((o) => !o)}>
            {snoozesLeft === 0 ? 'Snoozes used up · history' : `${snoozesLeft} snooze${snoozesLeft === 1 ? '' : 's'} left · history`}
          </button>
        </div>
      )}
    </div>
  );
}

export default function Reminders() {
  const { s, actions, notify } = useStore();
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState(() => {
    const t = new Date(Date.now() + 86400000);
    t.setHours(9, 0, 0, 0);
    return new Date(t.getTime() - t.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [kind, setKind] = useState<Reminder['kind']>('internal');
  const [assignee, setAssignee] = useState('me');
  const [matter, setMatter] = useState('');

  const now = Date.now();
  const openR = s.reminders.filter((r) => !r.done).sort((a, b) => a.due.localeCompare(b.due));
  const groups: [string, Reminder[]][] = [
    ['Overdue', openR.filter((r) => new Date(r.due).getTime() < now)],
    ['Today', openR.filter((r) => new Date(r.due).getTime() >= now && daysFromToday(r.due) === 0)],
    ['Next 7 days', openR.filter((r) => daysFromToday(r.due) >= 1 && daysFromToday(r.due) <= 7)],
    ['Later', openR.filter((r) => daysFromToday(r.due) > 7)],
    ['Done', s.reminders.filter((r) => r.done)],
  ];

  return (
    <>
      <PageHead title="Reminders" sub="Reminders that don’t go away. Every one has an owner and a schedule. Snoozing is limited, and a third snooze brings in a backup person. Court dates can never be snoozed past." />

      <section className="panel">
        <div className="panel-head"><h2>New reminder</h2></div>
        <form
          className="panel-body row"
          style={{ alignItems: 'flex-end' }}
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            actions.addReminder({ title: title.trim(), due: new Date(when).toISOString(), kind, assignee, escalateTo: assignee === 'me' ? 'marcus' : 'me', matterId: matter || undefined });
            setTitle('');
            notify('Reminder set');
          }}
        >
          <div className="field" style={{ flex: '2 1 240px' }}>
            <label htmlFor="r-title">What needs to happen</label>
            <input className="input" id="r-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Serve discovery responses" />
          </div>
          <div className="field" style={{ flex: '1 1 180px' }}>
            <label htmlFor="r-when">Due</label>
            <input className="input" id="r-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </div>
          <div className="field" style={{ flex: '1 1 150px' }}>
            <label htmlFor="r-kind">Type</label>
            <select className="input" id="r-kind" value={kind} onChange={(e) => setKind(e.target.value as Reminder['kind'])}>
              {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: '1 1 150px' }}>
            <label htmlFor="r-who">Owner</label>
            <select className="input" id="r-who" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              {TEAM.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: '1 1 180px' }}>
            <label htmlFor="r-matter">Matter</label>
            <select className="input" id="r-matter" value={matter} onChange={(e) => setMatter(e.target.value)}>
              <option value="">None</option>
              {s.matters.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <button className="btn primary" type="submit">Add</button>
        </form>
      </section>

      {groups.map(([label, items]) =>
        items.length ? (
          <section key={label} className="panel">
            <div className="panel-head">
              <h2 style={{ color: label === 'Overdue' ? 'var(--danger)' : undefined }}>{label} <span className="num small muted">{items.length}</span></h2>
            </div>
            <div>{items.map((r) => <Row key={r.id} r={r} />)}</div>
          </section>
        ) : null,
      )}
    </>
  );
}
