import { useState } from 'react';
import { useStore } from '../store';
import { daysFromToday, fmtTime, PageHead, startOfToday } from '../ui';

export default function Calendar() {
  const { s, lookup, go } = useStore();
  const [offset, setOffset] = useState(0);
  const start = startOfToday();
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7) + offset * 7); // Monday
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
  const sameDay = (iso: string, d: Date) => {
    const x = new Date(iso);
    return x.getFullYear() === d.getFullYear() && x.getMonth() === d.getMonth() && x.getDate() === d.getDate();
  };

  return (
    <>
      <PageHead title="Calendar" sub="Meetings, consults and court deadlines on one calendar. Deadlines come from Tasks, so they can’t drift out of sync.">
        <button className="btn" onClick={() => setOffset((o) => o - 1)}>← Prev</button>
        <button className="btn" onClick={() => setOffset(0)}>This week</button>
        <button className="btn" onClick={() => setOffset((o) => o + 1)}>Next →</button>
      </PageHead>
      <div className="row small muted" style={{ gap: 12 }}>
        <span className="row" style={{ gap: 4 }}><span className="ev court" style={{ padding: '0 6px' }}>&nbsp;</span>Court</span>
        <span className="row" style={{ gap: 4 }}><span className="ev deadline" style={{ padding: '0 6px' }}>&nbsp;</span>Deadline</span>
        <span className="row" style={{ gap: 4 }}><span className="ev consult" style={{ padding: '0 6px' }}>&nbsp;</span>Consult</span>
        <span className="row" style={{ gap: 4 }}><span className="ev" style={{ padding: '0 6px' }}>&nbsp;</span>Meeting / call</span>
        <span className="row" style={{ gap: 4 }}><span className="ev block" style={{ padding: '0 6px' }}>&nbsp;</span>Focus block</span>
      </div>
      <div className="week">
        {days.map((d) => {
          const iso = d.toISOString();
          const evs = s.events.filter((e) => sameDay(e.start, d)).sort((a, b) => a.start.localeCompare(b.start));
          const dls = s.tasks.filter((r) => !r.done && (r.kind === 'court' || r.kind === 'statute') && sameDay(r.due, d));
          return (
            <div key={iso} className={`day ${daysFromToday(iso) === 0 ? 'today' : ''}`}>
              <div className="day-head">
                <strong>{d.toLocaleDateString('en-US', { weekday: 'short' })}</strong>
                <span className="num small muted">{d.getDate()}</span>
              </div>
              <div className="day-body">
                {dls.map((r) => (
                  <button key={r.id} className="ev deadline" onClick={() => go('tasks')}>
                    <strong>Due {fmtTime(r.due)}</strong>
                    <div>{r.title}</div>
                  </button>
                ))}
                {evs.map((e) => (
                  <button
                    key={e.id}
                    className={`ev ${e.kind}`}
                    onClick={() => e.matterId && go('matter', e.matterId)}
                  >
                    <strong className="num">{fmtTime(e.start)}</strong>
                    <div>{e.title}</div>
                    {e.matterId && <div className="muted">{lookup.matter(e.matterId)?.name}</div>}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
