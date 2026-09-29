import { useMemo, useState } from 'react';
import { useStore } from '../store';
import type { CalEvent, EventType } from '../data';
import { fmtTime, PageHead, startOfToday } from '../ui';

const WORK_START = 9;
const WORK_END = 17;

/** Open slots for a day: working hours minus existing events (with buffers), min notice, and the daily cap. */
function slotsFor(day: Date, type: EventType, events: CalEvent[]): Date[] {
  const onDay = events.filter((e) => new Date(e.start).toDateString() === day.toDateString());
  const sameTypeCount = onDay.filter((e) => e.kind === 'consult').length;
  if (type.who === 'prospects' && sameTypeCount >= type.dailyCap) return [];
  const earliest = Date.now() + type.minNoticeHours * 3600000;
  const out: Date[] = [];
  for (let h = WORK_START; h < WORK_END; h += 0.5) {
    const s = new Date(day);
    s.setHours(Math.floor(h), (h % 1) * 60, 0, 0);
    const start = s.getTime() - type.bufferBefore * 60000;
    const end = s.getTime() + (type.minutes + type.bufferAfter) * 60000;
    if (s.getTime() + type.minutes * 60000 > new Date(day).setHours(WORK_END, 0, 0, 0)) continue;
    if (s.getTime() < earliest) continue;
    const clash = onDay.some((e) => {
      const es = new Date(e.start).getTime();
      const ee = es + e.minutes * 60000;
      return start < ee && es < end;
    });
    if (!clash) out.push(s);
  }
  return out;
}

function nextBusinessDays(n: number) {
  const out: Date[] = [];
  const d = startOfToday();
  while (out.length < n) {
    if (d.getDay() !== 0 && d.getDay() !== 6) out.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function BookingPage({ type }: { type: EventType }) {
  const { s, actions, go } = useStore();
  const days = useMemo(() => nextBusinessDays(5), []);
  const [dayIdx, setDayIdx] = useState(1);
  const [slot, setSlot] = useState<Date | null>(null);
  const [name, setName] = useState('Avery, Jordan');
  const [email, setEmail] = useState('jordan.avery@example.com');
  const [phone] = useState('(555) 555-0142');
  const [answers, setAnswers] = useState<string[]>(type.who === 'prospects' ? ['Trust for our family; we have a rental property', 'Spouse: Casey Avery', ''] : ['']);
  const [booked, setBooked] = useState<Date | null>(null);

  const slots = slotsFor(days[dayIdx], type, s.events);

  if (booked) {
    return (
      <div className="booking">
        <div className="booking-head">
          <div className="label">Confirmed</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>You’re booked, {name.split(',').pop()?.trim()}.</h2>
          <div className="muted">{booked.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at {fmtTime(booked.toISOString())} · {type.minutes} min</div>
        </div>
        <div className="panel-body stack">
          <div className="label">What happened inside the firm</div>
          <ul style={{ margin: 0, paddingLeft: 18 }} className="stack">
            <li>Added to your calendar with {type.bufferBefore} min before and {type.bufferAfter} min after held open.</li>
            {type.who === 'prospects' ? (
              <>
                <li>Added to <button className="link" onClick={() => go('intake')}>Intake → Consult scheduled</button>, with show-rate reminders {s.cadences.preConsult.map((d) => -d).join(', ')} days before.</li>
                <li>Conflict check queued against “{answers[1] || 'no one named'}”. Posted to #intake.</li>
              </>
            ) : (
              <li>Linked to the client’s matter. A time entry is drafted when the call ends.</li>
            )}
            <li>Client gets a text and email reminder 24 hours and 1 hour before, each with a reschedule link.</li>
          </ul>
          <div className="row">
            <button className="btn" onClick={() => { setBooked(null); setSlot(null); }}>Book another</button>
            <button className="btn primary" onClick={() => go('calendar')}>See it on the calendar</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="booking">
      <div className="booking-head">
        <div className="label">Public booking page · what the client sees</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>{type.name}</h2>
        <div className="muted small">{type.minutes} minutes · Video or phone · Times shown in your time zone</div>
      </div>
      <div className="panel-body stack" style={{ gap: 14 }}>
        <div className="days-strip">
          {days.map((d, i) => {
            const n = slotsFor(d, type, s.events).length;
            return (
              <button key={d.toISOString()} aria-pressed={i === dayIdx} disabled={n === 0} onClick={() => { setDayIdx(i); setSlot(null); }}>
                <div style={{ fontWeight: 600 }}>{d.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                <div className="num">{d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
              </button>
            );
          })}
        </div>
        <div className="slots">
          {slots.length === 0 && <span className="muted small">No times left this day.</span>}
          {slots.map((t) => (
            <button key={t.toISOString()} className="num" aria-pressed={slot?.getTime() === t.getTime()} onClick={() => setSlot(t)}>
              {fmtTime(t.toISOString())}
            </button>
          ))}
        </div>
        {slot && (
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              actions.book(type.id, slot.toISOString(), name.trim(), phone, answers);
              setBooked(slot);
            }}
          >
            <div className="grid cols-2" style={{ gap: 10 }}>
              <div className="field"><label htmlFor="b-name">Your name</label><input className="input" id="b-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div className="field"><label htmlFor="b-email">Email</label><input className="input" id="b-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            </div>
            {type.questions.map((q, i) => (
              <div className="field" key={q}>
                <label htmlFor={`b-q${i}`}>{q}</label>
                <input className="input" id={`b-q${i}`} value={answers[i] ?? ''} onChange={(e) => setAnswers((a) => Object.assign([...a], { [i]: e.target.value }))} />
              </div>
            ))}
            <button className="btn primary" type="submit">Confirm {fmtTime(slot.toISOString())}</button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function Scheduling() {
  const { s, actions } = useStore();
  const [sel, setSel] = useState('et1');
  const type = s.eventTypes.find((t) => t.id === sel)!;

  return (
    <>
      <PageHead title="Scheduling" sub="Your booking links, built into the firm. Bookings check your real calendar and court dates, respect buffers, and land on the right matter automatically." />
      <div className="grid cols-2">
        <div className="stack" style={{ gap: 12 }}>
          {s.eventTypes.map((t) => (
            <section key={t.id} className="panel" style={{ borderColor: t.id === sel ? 'var(--accent)' : undefined }}>
              <div className="panel-head">
                <button className="link" style={{ fontSize: 15 }} onClick={() => setSel(t.id)}>{t.name}</button>
                <div className="row">
                  <span className={`pill ${t.who === 'prospects' ? 'info' : 'accent'}`}>{t.who === 'prospects' ? 'For new prospects' : 'For existing clients'}</span>
                  <label className="row small" style={{ gap: 4 }}>
                    <input type="checkbox" id={`active-${t.id}`} checked={t.active} onChange={() => actions.toggleEventType(t.id)} /> Active
                  </label>
                </div>
              </div>
              {t.id === sel ? (
                <div className="panel-body grid cols-2" style={{ gap: 10 }}>
                  <div className="field"><label htmlFor={`len-${t.id}`}>Length (min)</label><input className="input num" id={`len-${t.id}`} type="number" min={10} step={5} value={t.minutes} onChange={(e) => actions.updateEventType(t.id, { minutes: Number(e.target.value) || 10 })} /></div>
                  <div className="field"><label htmlFor={`notice-${t.id}`}>Minimum notice (hours)</label><input className="input num" id={`notice-${t.id}`} type="number" min={0} value={t.minNoticeHours} onChange={(e) => actions.updateEventType(t.id, { minNoticeHours: Number(e.target.value) || 0 })} /></div>
                  <div className="field"><label htmlFor={`bb-${t.id}`}>Buffer before (min)</label><input className="input num" id={`bb-${t.id}`} type="number" min={0} step={5} value={t.bufferBefore} onChange={(e) => actions.updateEventType(t.id, { bufferBefore: Number(e.target.value) || 0 })} /></div>
                  <div className="field"><label htmlFor={`ba-${t.id}`}>Buffer after (min)</label><input className="input num" id={`ba-${t.id}`} type="number" min={0} step={5} value={t.bufferAfter} onChange={(e) => actions.updateEventType(t.id, { bufferAfter: Number(e.target.value) || 0 })} /></div>
                  <div className="field"><label htmlFor={`cap-${t.id}`}>Max per day</label><input className="input num" id={`cap-${t.id}`} type="number" min={1} value={t.dailyCap} onChange={(e) => actions.updateEventType(t.id, { dailyCap: Number(e.target.value) || 1 })} /></div>
                  <div className="field"><span className="small muted">When booked, creates</span><strong>{t.creates}</strong></div>
                </div>
              ) : (
                <div className="panel-body small muted">{t.minutes} min · {t.minNoticeHours}h notice · {t.bufferBefore}/{t.bufferAfter} min buffers · max {t.dailyCap}/day</div>
              )}
            </section>
          ))}
        </div>
        <BookingPage key={type.id + type.minutes + type.bufferBefore + type.bufferAfter + type.minNoticeHours + type.dailyCap} type={type} />
      </div>
    </>
  );
}
