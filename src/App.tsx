import { useEffect, useState } from 'react';
import { useStore, type Screen } from './store';
import { formatClock } from './billing';
import Today from './screens/Today';
import Intake from './screens/Intake';
import PncDetail from './screens/PncDetail';
import Contacts, { ContactDetail } from './screens/Contacts';
import Conflicts from './screens/Conflicts';
import Matters from './screens/Matters';
import MatterDetail from './screens/MatterDetail';
import TimeBilling from './screens/TimeBilling';
import Calendar from './screens/Calendar';
import Scheduling from './screens/Scheduling';
import Tasks, { TaskDrawer } from './screens/Tasks';
import Messages from './screens/Messages';
import Phone from './screens/Phone';
import Portal from './screens/Portal';
import Settings from './screens/Settings';

const NAV: { group?: string; id: Screen; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'intake', label: 'PNC matters' },
  { id: 'matters', label: 'Client matters' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'conflicts', label: 'Conflict check' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'messages', label: 'Messages' },
  { group: 'Money', id: 'time', label: 'Time & billing' },
  { group: 'Clients', id: 'scheduling', label: 'Scheduling' },
  { id: 'portal', label: 'Client portal' },
  { id: 'phone', label: 'Phone' },
  { group: 'Firm', id: 'settings', label: 'Settings' },
];

function useTick(active: boolean) {
  const [, set] = useState(0);
  useEffect(() => {
    if (!active) return;
    const h = window.setInterval(() => set((n) => n + 1), 1000);
    return () => window.clearInterval(h);
  }, [active]);
}

function TimerWidget() {
  const { s, actions, lookup, notify } = useStore();
  useTick(!!s.timer);
  if (!s.timer) {
    return (
      <button className="btn" onClick={() => actions.startTimer('m2', 'Draft trust agreement')}>
        ▶ Start timer
      </button>
    );
  }
  const secs = (Date.now() - s.timer.startedAt) / 1000;
  const m = lookup.matter(s.timer.matterId);
  return (
    <div className="timer" role="timer">
      <span className="dot" aria-hidden />
      <span className="num">{formatClock(secs)}</span>
      <span className="small" style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {m?.name}
      </span>
      <button
        className="btn sm primary"
        onClick={() => {
          actions.stopTimer(Math.max(1, Math.round(secs / 60)));
          notify('Time entry saved to the matter');
        }}
      >
        Stop
      </button>
    </div>
  );
}

function CallBar() {
  const { s, actions, lookup, notify, go } = useStore();
  useTick(!!s.activeCall);
  const c = s.activeCall;
  if (!c) return null;
  const m = c.matterId ? lookup.matter(c.matterId) : undefined;
  return (
    <div className="callbar" role="status">
      <strong>On a call with {c.contact}</strong>
      <span className="num">{formatClock((Date.now() - c.startedAt) / 1000)}</span>
      {m && (
        <span className="small">
          Matched to <button className="link" onClick={() => go('matter', m.id)}>{m.name}</button>
        </span>
      )}
      <span style={{ flex: 1 }} />
      <button
        className="btn sm primary"
        onClick={() => {
          actions.endCall();
          notify('Call logged and a time entry drafted on the matter');
        }}
      >
        End call
      </button>
    </div>
  );
}

export default function App() {
  const { screen, go, s, toast } = useStore();
  const overdue = s.tasks.filter((r) => !r.done && r.assignee === 'me' && new Date(r.due).getTime() < Date.now()).length;

  const view = {
    today: <Today />,
    intake: <Intake />,
    pnc: <PncDetail />,
    contacts: <Contacts />,
    contact: <ContactDetail />,
    conflicts: <Conflicts />,
    matters: <Matters />,
    matter: <MatterDetail />,
    time: <TimeBilling />,
    calendar: <Calendar />,
    scheduling: <Scheduling />,
    tasks: <Tasks />,
    messages: <Messages />,
    phone: <Phone />,
    portal: <Portal />,
    settings: <Settings />,
  }[screen];

  return (
    <div className="shell">
      <aside className="rail">
        <div className="brand">
          <b>Docket</b>
          <span>Prototype</span>
        </div>
        <nav className="nav" aria-label="Main">
          {NAV.map((n) => (
            <div key={n.id} style={{ display: 'contents' }}>
              {n.group && <div className="nav-group">{n.group}</div>}
              <button aria-current={screen === n.id || (screen === 'matter' && n.id === 'matters') || (screen === 'pnc' && n.id === 'intake') || (screen === 'contact' && n.id === 'contacts') ? 'page' : undefined} onClick={() => go(n.id)}>
                <span>{n.label}</span>
                {n.id === 'tasks' && overdue > 0 && <span className="count">{overdue}</span>}
              </button>
            </div>
          ))}
        </nav>
        <div className="rail-foot">Sample data only. All names are fictional.</div>
      </aside>
      <div className="main">
        <header className="topbar">
          <input className="search" id="global-search" placeholder="Search matters, clients, documents…" aria-label="Search" />
          <span style={{ flex: 1 }} />
          <TimerWidget />
        </header>
        <CallBar />
        <main className="content">{view}</main>
      </div>
      <TaskDrawer />
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
