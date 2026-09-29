import { useState } from 'react';
import { useStore } from '../store';
import { TEAM, teamName, type Task, type TaskKind } from '../data';
import { todayISO } from '../practice';
import { daysFromToday, fmtDate, fmtTime, PageHead, Person, relDay } from '../ui';

export const KIND_LABEL: Record<TaskKind, string> = {
  internal: 'Task',
  client: 'Client follow-up',
  court: 'Court deadline',
  statute: 'Statute of limitations',
};
const isHard = (k: TaskKind) => k === 'court' || k === 'statute';

/** The nudge schedule every task follows. Hard deadlines get the long runway. */
function ladder(t: Task) {
  const steps = isHard(t.kind) ? ['30 days', '14 days', '7 days', '3 days', '1 day', 'Morning of', '2h before'] : ['1 day', 'Morning of', 'Overdue: daily'];
  const left = daysFromToday(t.due);
  const thresholds = isHard(t.kind) ? [30, 14, 7, 3, 1, 0, 0] : [1, 0, -1];
  return steps.map((label, i) => ({ label, hit: left <= thresholds[i] }));
}

export function TaskRow({ t, showMatter = true }: { t: Task; showMatter?: boolean }) {
  const { actions, lookup, go, notify } = useStore();
  const [open, setOpen] = useState(false);
  const late = !t.done && new Date(t.due).getTime() < Date.now();
  const soon = !late && daysFromToday(t.due) <= 1;
  const hard = isHard(t.kind);
  const snoozesLeft = Math.max(0, 3 - t.snoozes);
  const doneCount = t.checklist.filter((c) => c.done).length;
  const m = t.matterId ? lookup.matter(t.matterId) : undefined;
  const p = t.pncId ? lookup.pnc(t.pncId) : undefined;

  const snooze = (label: string, hours: number) => {
    actions.snoozeTask(t.id, label, hours);
    notify(t.snoozes + 1 >= 3 && t.escalateTo ? `Snoozed. Third snooze, so ${teamName(t.escalateTo)} has been brought in.` : `Snoozed ${label}`);
  };

  return (
    <div className={`rem task ${t.done ? 'done' : late ? 'overdue' : soon ? 'soon' : ''}`}>
      <span className="stripe" />
      <input
        type="checkbox"
        className="task-check"
        id={`done-${t.id}`}
        aria-label={`Mark ${t.title} done`}
        checked={t.done}
        onChange={(e) => { actions.setTaskDone(t.id, e.target.checked); if (e.target.checked) notify('Done. Logged on the matter.'); }}
      />
      <div style={{ minWidth: 0 }}>
        <div className="row" style={{ gap: 6 }}>
          <button className="link task-title" style={{ color: 'var(--ink)', textDecoration: t.done ? 'line-through' : undefined }} onClick={() => setOpen((o) => !o)}>{t.title}</button>
          <span className={`pill ${hard ? 'danger' : t.kind === 'client' ? 'info' : ''}`}>{KIND_LABEL[t.kind]}</span>
          {t.source === 'stage' && <span className="pill" title="Created automatically by a stage">Auto</span>}
          {t.checklist.length > 0 && <span className={`pill ${doneCount === t.checklist.length ? 'ok' : ''}`}>{doneCount}/{t.checklist.length}</span>}
        </div>
        <div className="small muted row" style={{ gap: 6 }}>
          {showMatter && m && <><button className="link" onClick={() => go('matter', m.id)}>{m.name}</button><span>·</span></>}
          {showMatter && p && <><button className="link" onClick={() => go('pnc', p.id)}>PNC: {lookup.clientOf(p)?.name}</button><span>·</span></>}
          <span style={{ color: late ? 'var(--danger)' : undefined }}>{t.done ? `Done ${t.doneAt ? relDay(t.doneAt) : ''}` : `${late ? 'Overdue since' : 'Due'} ${relDay(t.due)} ${fmtTime(t.due)}`}</span>
          <span>·</span>
          <span className="row" style={{ gap: 4 }}><Person id={t.assignee} showName />{t.escalateTo ? <span>→ backup {teamName(t.escalateTo)}</span> : null}</span>
        </div>
        {!t.done && (
          <div className="ladder" aria-label="Nudge schedule">
            {ladder(t).map((s, i) => <span key={i} className={s.hit ? 'hit' : ''}>{s.label}</span>)}
          </div>
        )}
        {open && (
          <div className="task-detail stack">
            {t.checklist.length > 0 && (
              <ul className="checklist">
                {t.checklist.map((c, i) => (
                  <li key={i}>
                    <label className="row" style={{ gap: 6 }}>
                      <input type="checkbox" id={`cl-${t.id}-${i}`} checked={c.done} onChange={() => actions.toggleChecklist(t.id, i)} />
                      <span style={{ textDecoration: c.done ? 'line-through' : undefined }}>{c.text}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <div className="row" style={{ gap: 8 }}>
              <div className="field">
                <label htmlFor={`due-${t.id}`}>Due</label>
                <input
                  className="input small tight num"
                  type="date"
                  id={`due-${t.id}`}
                  value={t.due.slice(0, 10)}
                  disabled={hard && t.snoozes > 0}
                  onChange={(e) => e.target.value && actions.updateTask(t.id, { due: new Date(e.target.value + 'T17:00:00').toISOString() }, `Due date changed to ${fmtDate(e.target.value)}`)}
                />
              </div>
              <div className="field">
                <label htmlFor={`who-${t.id}`}>Assigned to</label>
                <select className="input small tight" id={`who-${t.id}`} value={t.assignee} onChange={(e) => actions.updateTask(t.id, { assignee: e.target.value }, `Reassigned to ${teamName(e.target.value)}`)}>
                  {TEAM.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor={`esc-${t.id}`}>Backup</label>
                <select className="input small tight" id={`esc-${t.id}`} value={t.escalateTo ?? ''} onChange={(e) => actions.updateTask(t.id, { escalateTo: e.target.value || undefined })}>
                  <option value="">None</option>
                  {TEAM.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              </div>
            </div>
            <ul className="small muted" style={{ margin: 0, paddingLeft: 18 }}>
              {t.log.length ? t.log.map((l, i) => <li key={i}>{l}</li>) : <li>No activity yet.</li>}
            </ul>
          </div>
        )}
      </div>
      {!t.done && (
        <div className="stack" style={{ gap: 6, alignItems: 'flex-end' }}>
          {hard ? (
            <span className="small muted" style={{ textAlign: 'right', maxWidth: 120 }}>Deadline can’t be snoozed</span>
          ) : (
            <div className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
              <button className="btn sm" disabled={snoozesLeft === 0} onClick={() => snooze('1 hour', 1)}>1h</button>
              <button className="btn sm" disabled={snoozesLeft === 0} onClick={() => snooze('until tomorrow', 24)}>Tomorrow</button>
            </div>
          )}
          {!hard && <span className="small muted">{snoozesLeft === 0 ? 'No snoozes left' : `${snoozesLeft} snooze${snoozesLeft === 1 ? '' : 's'} left`}</span>}
        </div>
      )}
    </div>
  );
}

export function NewTaskForm({ matterId, pncId, onDone }: { matterId?: string; pncId?: string; onDone?: () => void }) {
  const { s, actions, lookup, notify } = useStore();
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState(todayISO());
  const [kind, setKind] = useState<TaskKind>('internal');
  const [assignee, setAssignee] = useState('me');
  const [target, setTarget] = useState(matterId ? `m:${matterId}` : pncId ? `p:${pncId}` : '');
  const [checklist, setChecklist] = useState('');
  return (
    <form
      className="panel-body stack"
      style={{ gap: 8 }}
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        const [k, id] = target.split(':');
        actions.addTask({
          title: title.trim(),
          due: new Date(when + 'T17:00:00').toISOString(),
          kind,
          assignee,
          escalateTo: assignee === 'me' ? 'marcus' : 'me',
          matterId: k === 'm' ? id : undefined,
          pncId: k === 'p' ? id : undefined,
          checklist: checklist.split('\n').map((x) => x.trim()).filter(Boolean).map((text) => ({ text, done: false })),
        });
        setTitle(''); setChecklist('');
        notify('Task added');
        onDone?.();
      }}
    >
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <div className="field" style={{ flex: '2 1 220px' }}><label htmlFor="t-title">What needs to happen</label><input className="input" id="t-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Serve discovery responses" /></div>
        <div className="field" style={{ flex: '1 1 140px' }}><label htmlFor="t-when">Due</label><input className="input num" id="t-when" type="date" value={when} onChange={(e) => setWhen(e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 150px' }}><label htmlFor="t-kind">Type</label>
          <select className="input" id="t-kind" value={kind} onChange={(e) => setKind(e.target.value as TaskKind)}>
            {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 140px' }}><label htmlFor="t-who">Assigned to</label>
          <select className="input" id="t-who" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            {TEAM.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        {!matterId && !pncId && (
          <div className="field" style={{ flex: '1 1 200px' }}><label htmlFor="t-matter">Matter</label>
            <select className="input" id="t-matter" value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">None</option>
              <optgroup label="Client matters">{s.matters.filter((m) => m.status === 'open').map((m) => <option key={m.id} value={`m:${m.id}`}>{m.name}</option>)}</optgroup>
              <optgroup label="PNC matters">{s.pncs.filter((p) => !p.matterId).map((p) => <option key={p.id} value={`p:${p.id}`}>{lookup.clientOf(p)?.name}</option>)}</optgroup>
            </select>
          </div>
        )}
      </div>
      <div className="field"><label htmlFor="t-cl">Checklist <span className="muted">(optional, one item per line)</span></label><textarea className="input" id="t-cl" rows={2} value={checklist} onChange={(e) => setChecklist(e.target.value)} /></div>
      <div><button className="btn primary" type="submit">Add task</button></div>
    </form>
  );
}

export default function Tasks() {
  const { s } = useStore();
  const [who, setWho] = useState('me');
  const [adding, setAdding] = useState(false);
  const now = Date.now();
  const mine = s.tasks.filter((t) => who === 'all' || t.assignee === who);
  const open = mine.filter((t) => !t.done).sort((a, b) => a.due.localeCompare(b.due));
  const groups: [string, Task[]][] = [
    ['Overdue', open.filter((t) => new Date(t.due).getTime() < now)],
    ['Today', open.filter((t) => new Date(t.due).getTime() >= now && daysFromToday(t.due) === 0)],
    ['Next 7 days', open.filter((t) => daysFromToday(t.due) >= 1 && daysFromToday(t.due) <= 7)],
    ['Later', open.filter((t) => daysFromToday(t.due) > 7)],
    ['Done', mine.filter((t) => t.done).sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? '')).slice(0, 10)],
  ];

  return (
    <>
      <PageHead title="Tasks" sub="Everything someone has to do, with an owner and a due date. Tasks keep nudging until they’re done: three snoozes, then the backup person is brought in. Court and statute deadlines can’t be snoozed.">
        <select className="input" style={{ width: 'auto' }} id="task-who" aria-label="Whose tasks" value={who} onChange={(e) => setWho(e.target.value)}>
          {TEAM.map((t) => <option key={t.id} value={t.id}>{t.id === 'me' ? 'My tasks' : `${t.name}’s tasks`}</option>)}
          <option value="all">Everyone’s tasks</option>
        </select>
        <button className="btn primary" onClick={() => setAdding((a) => !a)}>{adding ? 'Cancel' : '+ New task'}</button>
      </PageHead>

      {adding && <section className="panel"><NewTaskForm onDone={() => setAdding(false)} /></section>}

      {open.length === 0 && <p className="muted">Nothing open. Tasks appear here when you add them or when a matter moves into a stage that creates them.</p>}

      {groups.map(([label, items]) =>
        items.length ? (
          <section key={label} className="panel">
            <div className="panel-head">
              <h2 style={{ color: label === 'Overdue' ? 'var(--danger)' : undefined }}>{label} <span className="num small muted">{items.length}</span></h2>
            </div>
            <div>{items.map((t) => <TaskRow key={t.id} t={t} />)}</div>
          </section>
        ) : null,
      )}
    </>
  );
}
