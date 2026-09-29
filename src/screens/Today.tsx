import { useStore } from '../store';
import { money, billedMinutes, formatHours } from '../billing';
import { entryValue } from '../calc';
import { daysFromToday, fmtTime, MatterLink, PageHead, relDay } from '../ui';

export default function Today() {
  const { s, actions, lookup, go, notify } = useStore();
  const now = Date.now();
  const open = s.reminders.filter((r) => !r.done);
  const urgent = open
    .filter((r) => daysFromToday(r.due) <= 2)
    .sort((a, b) => a.due.localeCompare(b.due));
  const overdue = open.filter((r) => new Date(r.due).getTime() < now).length;
  const todayEvents = s.events.filter((e) => daysFromToday(e.start) === 0).sort((a, b) => a.start.localeCompare(b.start));

  const weekMinutes = s.timeEntries
    .filter((t) => daysFromToday(t.date) > -7 && t.user === 'me')
    .reduce((n, t) => n + billedMinutes(t.actualMinutes, s.billing), 0);
  const unbilled = s.timeEntries
    .filter((t) => !t.invoiced)
    .reduce((n, t) => n + entryValue(t, lookup.matter(t.matterId), s.billing), 0)
    + s.flatFees.filter((f) => f.status === 'unbilled').reduce((n, f) => n + f.amount, 0);
  const consults = s.events.filter((e) => e.kind === 'consult' && daysFromToday(e.start) >= 0 && daysFromToday(e.start) < 7).length;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      <PageHead
        title={greeting}
        sub={new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) + '. Here is what needs you today.'}
      />

      <div className="stats">
        <div className="stat">
          <span className="label">Overdue / due in 48h</span>
          <span className="v" style={{ color: overdue ? 'var(--danger)' : undefined }}>
            {overdue} / {urgent.length}
          </span>
        </div>
        <div className="stat">
          <span className="label">My hours, last 7 days</span>
          <span className="v">{formatHours(weekMinutes, s.billing)}</span>
        </div>
        <div className="stat">
          <span className="label">Unbilled work</span>
          <span className="v">{money(unbilled)}</span>
        </div>
        <div className="stat">
          <span className="label">Consults this week</span>
          <span className="v">{consults}</span>
        </div>
      </div>

      <div className="grid cols-main">
        <section className="panel">
          <div className="panel-head">
            <h2>Needs attention</h2>
            <button className="btn sm ghost" onClick={() => go('reminders')}>All reminders →</button>
          </div>
          <div>
            {urgent.length === 0 && <p className="panel-body muted">Nothing due in the next 48 hours.</p>}
            {urgent.map((r) => {
              const late = new Date(r.due).getTime() < now;
              const n = daysFromToday(r.due);
              return (
                <div key={r.id} className={`rem ${late ? 'overdue' : n <= 1 ? 'soon' : ''}`}>
                  <span className="stripe" />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{r.title}</div>
                    <div className="small muted row" style={{ gap: 6 }}>
                      <MatterLink id={r.matterId} />
                      <span>·</span>
                      <span style={{ color: late ? 'var(--danger)' : undefined }}>
                        {late ? 'Overdue, was due ' : 'Due '}
                        {relDay(r.due)} {fmtTime(r.due)}
                      </span>
                      {r.kind === 'court' && <span className="pill danger">Court deadline</span>}
                    </div>
                  </div>
                  <button
                    className="btn sm"
                    onClick={() => {
                      actions.completeReminder(r.id);
                      notify('Marked done and logged on the matter');
                    }}
                  >
                    Done
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Today’s schedule</h2>
            <button className="btn sm ghost" onClick={() => go('calendar')}>Week →</button>
          </div>
          <ul className="list">
            {todayEvents.length === 0 && <li className="muted">No meetings today.</li>}
            {todayEvents.map((e) => (
              <li key={e.id}>
                <span className="num small muted" style={{ width: 64, flex: 'none' }}>{fmtTime(e.start)}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 500 }}>{e.title}</div>
                  <div className="small">
                    <MatterLink id={e.matterId} /> <span className="muted">· {e.minutes} min</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2>Try the connected pieces</h2>
          <span className="small muted">Each one writes to the same matter record</span>
        </div>
        <div className="panel-body grid cols-3">
          <div className="stack">
            <strong>Phone system</strong>
            <span className="small muted">A client calls. The number is matched to their matter, and hanging up drafts a time entry.</span>
            <div><button className="btn primary" disabled={!!s.activeCall} onClick={() => actions.simulateIncomingCall()}>Simulate incoming call</button></div>
          </div>
          <div className="stack">
            <strong>Scheduling</strong>
            <span className="small muted">A prospect books a consult from your public link and lands in Intake with a conflict check queued.</span>
            <div><button className="btn" onClick={() => go('scheduling')}>Open booking page</button></div>
          </div>
          <div className="stack">
            <strong>Client portal</strong>
            <span className="small muted">See exactly what your client sees: status, messages, documents and invoices.</span>
            <div><button className="btn" onClick={() => go('portal')}>View as client</button></div>
          </div>
        </div>
      </section>
    </>
  );
}
