import { useEffect, useState } from 'react';
import { useStore, type Screen } from './store';
import { formatClock } from './billing';
import { TEAM, teamName, type Perm } from './data';
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
import Trust from './screens/Trust';
import Performance from './screens/Performance';
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
  { id: 'trust', label: 'Trust accounting' },
  { group: 'Clients', id: 'scheduling', label: 'Scheduling' },
  { id: 'portal', label: 'Client portal' },
  { id: 'phone', label: 'Phone' },
  { group: 'Firm', id: 'performance', label: 'Performance' },
  { id: 'settings', label: 'Settings' },
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

/** Which permission opens each screen. Screens not listed are open to everyone. */
function allowed(sc: Screen, can: (p: Perm) => boolean) {
  switch (sc) {
    case 'intake': case 'pnc': case 'scheduling': return can('intake');
    case 'matters': case 'matter': return can('matters') || can('billingView');
    case 'contacts': case 'contact': case 'conflicts': return can('contacts');
    case 'time': return can('billingView');
    case 'trust': return can('payments');
    case 'performance': return can('reports') || can('billingView');
    case 'portal': case 'phone': return can('matters');
    case 'settings': return can('settings') || can('users');
    default: return true;
  }
}

export default function App() {
  const { screen, go, s, toast, access, actions } = useStore();
  const trustPending = s.trustTxns.filter((t) => t.status === 'pending').length;
  const overdue = s.tasks.filter((r) => !r.done && r.assignee === access.user && new Date(r.due).getTime() < Date.now()).length;

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
    trust: <Trust />,
    performance: <Performance />,
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
          {NAV.filter((n) => allowed(n.id, access.can)).map((n) => (
            <div key={n.id} style={{ display: 'contents' }}>
              {n.group && <div className="nav-group">{n.group}</div>}
              <button aria-current={screen === n.id || (screen === 'matter' && n.id === 'matters') || (screen === 'pnc' && n.id === 'intake') || (screen === 'contact' && n.id === 'contacts') ? 'page' : undefined} onClick={() => go(n.id)}>
                <span>{n.label}</span>
                {n.id === 'tasks' && overdue > 0 && <span className="count">{overdue}</span>}
                {n.id === 'trust' && trustPending > 0 && <span className="count">{trustPending}</span>}
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
          {access.can('time') && <TimerWidget />}
          <label className="viewas small">
            <span className="muted">Viewing as</span>
            <select className="input small tight" id="view-as" value={s.viewAs} onChange={(e) => { actions.setViewAs(e.target.value); go('today'); }}>
              {TEAM.map((t) => <option key={t.id} value={t.id}>{t.id === 'me' ? 'You' : t.name}</option>)}
            </select>
          </label>
        </header>
        {s.viewAs !== 'me' && (
          <div className="viewas-bar">
            Previewing what <strong>{teamName(s.viewAs)}</strong> ({access.roleName}) can see and do. <button className="link" onClick={() => { actions.setViewAs('me'); go('today'); }}>Back to your view</button>
          </div>
        )}
        <CallBar />
        <main className="content">{allowed(screen, access.can) ? view : <NoAccess />}</main>
      </div>
      <TaskDrawer />
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

export function NoAccess({ what = 'this area' }: { what?: string }) {
  const { access } = useStore();
  return (
    <div className="panel panel-body stack" style={{ maxWidth: 560 }}>
      <h2>No access</h2>
      <p className="muted">{teamName(access.user)}’s role ({access.roleName}) doesn’t include {what}. A managing attorney can change this in Settings → Users & permissions.</p>
    </div>
  );
}
