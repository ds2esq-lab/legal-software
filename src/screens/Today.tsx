import { useState } from 'react';
import { useStore } from '../store';
import { TEAM, type Matter } from '../data';
import { dueMilestones } from '../calc';
import { nextTouch } from '../intake';
import { addDays, contactState, todayISO } from '../practice';
import { ContactPill, DuePill, fmtTime, PageHead, Person, relDay } from '../ui';

interface Item {
  key: string;
  date: string;
  kind: 'Milestone' | 'Suspense' | 'Contact' | 'Deadline';
  what: string;
  m: Matter;
}

export default function Today() {
  const { s, actions, lookup, go, notify } = useStore();
  const [who, setWho] = useState('me');
  const today = todayISO();
  const soonWindow = addDays(today, 2);

  // One queue from every source of dates: milestones, suspense dates, contact timers, reminders.
  const items: Item[] = [];
  for (const m of s.matters) {
    if (who !== 'all' && m.ball !== who && m.owner !== who) continue;
    const area = lookup.areaOf(m);
    for (const d of dueMilestones(m, area)) if (d.date <= soonWindow) items.push({ key: `${m.id}-ms-${d.milestoneId}`, date: d.date, kind: 'Milestone', what: `${d.name} due`, m });
    if (m.suspense && m.suspense <= soonWindow) items.push({ key: `${m.id}-susp`, date: m.suspense, kind: 'Suspense', what: m.suspenseNote || 'Suspense date', m });
    if (contactState(m.lastContact, area) === 'followup') items.push({ key: `${m.id}-contact`, date: addDays(m.lastContact!, area.cadence.followUp), kind: 'Contact', what: 'Client follow-up needed', m });
  }
  for (const r of s.reminders) {
    if (r.done || !r.matterId || (who !== 'all' && r.assignee !== who)) continue;
    const m = lookup.matter(r.matterId);
    if (m && r.due.slice(0, 10) <= soonWindow) items.push({ key: `rem-${r.id}`, date: r.due.slice(0, 10), kind: 'Deadline', what: r.title, m });
  }
  items.sort((a, b) => a.date.localeCompare(b.date));
  const late = items.filter((i) => i.date < today).length;

  const allFollowUps = s.matters.filter((m) => contactState(m.lastContact, lookup.areaOf(m)) === 'followup').length;
  const lateMilestones = s.matters.reduce((n, m) => n + dueMilestones(m, lookup.areaOf(m)).filter((d) => d.late).length, 0);
  const touchesDue = s.pncs.filter((p) => { const t = nextTouch(p, s.cadences); return t && t.due <= today; }).length;
  const todayEvents = s.events.filter((e) => e.start.slice(0, 10) === today || relDay(e.start) === 'Today').sort((a, b) => a.start.localeCompare(b.start));

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      <PageHead title={greeting} sub={new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) + '. Everything with a date on it, in one list.'}>
        <select className="input" style={{ width: 'auto' }} id="who" aria-label="Whose list" value={who} onChange={(e) => setWho(e.target.value)}>
          {TEAM.map((t) => <option key={t.id} value={t.id}>{t.id === 'me' ? 'My list' : `${t.name}’s list`}</option>)}
          <option value="all">Whole firm</option>
        </select>
      </PageHead>

      <div className="stats">
        <button className="stat" onClick={() => go('matters')}>
          <span className="label">Clients needing follow-up</span>
          <span className="v" style={{ color: allFollowUps ? 'var(--danger)' : undefined }}>{allFollowUps}</span>
        </button>
        <button className="stat" onClick={() => go('matters')}>
          <span className="label">Late milestones</span>
          <span className="v" style={{ color: lateMilestones ? 'var(--danger)' : undefined }}>{lateMilestones}</span>
        </button>
        <button className="stat" onClick={() => go('intake')}>
          <span className="label">Intake touches due</span>
          <span className="v">{touchesDue}</span>
        </button>
        <button className="stat" onClick={() => go('matters')}>
          <span className="label">Open matters</span>
          <span className="v">{s.matters.length}</span>
        </button>
      </div>

      <div className="grid cols-main">
        <section className="panel">
          <div className="panel-head">
            <h2>Due now and next 2 days</h2>
            <span className="small muted">{items.length} item{items.length === 1 ? '' : 's'}{late ? ` · ${late} late` : ''}</span>
          </div>
          <ul className="list">
            {items.length === 0 && <li className="muted">Nothing due. Check the board for matters without a suspense date.</li>}
            {items.map((i) => (
              <li key={i.key} className="queue-row">
                <DuePill iso={i.date} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div><strong style={{ fontWeight: 500 }}>{i.what}</strong> <span className="pill">{i.kind}</span></div>
                  <div className="small muted row" style={{ gap: 6 }}>
                    <button className="link" onClick={() => go('matter', i.m.id)}>{i.m.name}</button>
                    <span>·</span>
                    <span>{lookup.areaOf(i.m).name}</span>
                    <span>·</span>
                    <span className="row" style={{ gap: 4 }}>Ball: <Person id={i.m.ball} showName /></span>
                  </div>
                </div>
                {i.kind === 'Contact' && <button className="btn sm" onClick={() => { actions.logContact(i.m.id); notify('Contact logged'); }}>Logged contact</button>}
                {i.kind === 'Milestone' && <button className="btn sm" onClick={() => go('matter', i.m.id)}>Open</button>}
                {i.kind === 'Suspense' && (
                  <button className="btn sm" onClick={() => { actions.updateMatter(i.m.id, { suspense: addDays(today, 7) }); notify('Suspense moved out one week'); }}>+1 week</button>
                )}
                {i.kind === 'Deadline' && <button className="btn sm" onClick={() => go('reminders')}>Open</button>}
              </li>
            ))}
          </ul>
        </section>

        <div className="stack" style={{ gap: 16 }}>
          <section className="panel">
            <div className="panel-head"><h2>Today’s schedule</h2><button className="btn sm ghost" onClick={() => go('calendar')}>Week →</button></div>
            <ul className="list">
              {todayEvents.length === 0 && <li className="muted">No meetings today.</li>}
              {todayEvents.map((e) => (
                <li key={e.id}>
                  <span className="num small muted" style={{ width: 64, flex: 'none' }}>{fmtTime(e.start)}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 500 }}>{e.title}</div>
                    <div className="small muted">{e.minutes} min</div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
          <section className="panel">
            <div className="panel-head"><h2>Longest without contact</h2></div>
            <ul className="list">
              {[...s.matters]
                .filter((m) => m.lastContact)
                .sort((a, b) => a.lastContact!.localeCompare(b.lastContact!))
                .slice(0, 5)
                .map((m) => (
                  <li key={m.id} className="spread">
                    <button className="link" onClick={() => go('matter', m.id)}>{m.name}</button>
                    <ContactPill m={m} />
                  </li>
                ))}
            </ul>
          </section>
          <section className="panel">
            <div className="panel-head"><h2>Try it</h2></div>
            <div className="panel-body stack" style={{ gap: 8 }}>
              <button className="btn" disabled={!!s.activeCall} onClick={() => actions.simulateIncomingCall()}>Simulate incoming client call</button>
              <button className="btn" onClick={() => go('intake')}>Work the intake queue</button>
              <button className="btn" onClick={() => go('settings')}>Edit stages & deadline rules</button>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
