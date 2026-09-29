import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { TEAM, teamName } from '../data';
import { money } from '../billing';
import { newId } from '../practice';
import * as S from '../sched';
import { fmtDate, fmtTime, PageHead, Person } from '../ui';

type Tab = 'types' | 'availability' | 'routing' | 'bookings' | 'page';
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const place = (id: string) => S.PLACES.find((p) => p.id === id);
const ASSIGN: Record<S.MeetingType['assignment'], string> = {
  'client-picks': 'Client picks who',
  'first-available': 'First available',
  'round-robin': 'Round robin (even out the load)',
  collective: 'Everyone attends',
};

// ---------------- Meeting types ----------------

function TypeEditor({ mt, onClose }: { mt: S.MeetingType; onClose: () => void }) {
  const { actions, notify } = useStore();
  const [d, setD] = useState<S.MeetingType>(mt);
  const up = (p: Partial<S.MeetingType>) => setD((x) => ({ ...x, ...p }));
  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  return (
    <section className="panel" style={{ borderColor: 'var(--accent)' }}>
      <div className="panel-head"><h2>{mt.name ? `Edit: ${mt.name}` : 'New meeting type'}</h2><button className="btn sm ghost icon" aria-label="Close" onClick={onClose}>×</button></div>
      <div className="panel-body stack" style={{ gap: 14 }}>
        <div className="grid cols-3" style={{ gap: 10 }}>
          <div className="field"><label htmlFor="mt-name">Name</label><input className="input" id="mt-name" value={d.name} onChange={(e) => up({ name: e.target.value })} placeholder="e.g. Deed Signing" /></div>
          <div className="field"><label htmlFor="mt-min">Length (minutes)</label><input className="input num" type="number" min={5} step={5} id="mt-min" value={d.minutes} onChange={(e) => up({ minutes: Number(e.target.value) || 5 })} /></div>
          <div className="field"><label htmlFor="mt-aud">Who books it</label>
            <select className="input" id="mt-aud" value={d.audience} onChange={(e) => up({ audience: e.target.value as S.MeetingType['audience'] })}>
              <option value="prospects">New prospects (creates a PNC matter)</option>
              <option value="clients">Existing clients (attaches to their matter)</option>
              <option value="internal">Internal / private link</option>
            </select>
          </div>
        </div>

        <div className="field"><span className="small muted">Hosts</span>
          <div className="row" style={{ gap: 10 }}>
            {TEAM.filter((t) => t.id !== 'lena').map((t) => (
              <label key={t.id} className="row small" style={{ gap: 4 }}><input type="checkbox" id={`mt-h-${t.id}`} checked={d.hosts.includes(t.id)} onChange={() => up({ hosts: toggle(d.hosts, t.id) })} />{t.id === 'me' ? 'You' : t.name}</label>
            ))}
          </div>
        </div>
        {d.hosts.length > 1 && (
          <div className="field"><label htmlFor="mt-assign">With more than one host</label>
            <select className="input" style={{ maxWidth: 360 }} id="mt-assign" value={d.assignment} onChange={(e) => up({ assignment: e.target.value as S.MeetingType['assignment'] })}>
              {Object.entries(ASSIGN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        )}
        <div className="field"><span className="small muted">Where (the client chooses one; times come from each host’s schedules for that place)</span>
          <div className="row" style={{ gap: 10 }}>
            {S.PLACES.map((p) => (
              <label key={p.id} className="row small" style={{ gap: 4 }}><input type="checkbox" id={`mt-p-${p.id}`} checked={d.places.includes(p.id)} onChange={() => up({ places: toggle(d.places, p.id) })} />{p.name}</label>
            ))}
          </div>
        </div>

        <div className="grid cols-3" style={{ gap: 10 }}>
          <div className="field"><label htmlFor="mt-bb">Buffer before (min)</label><input className="input num" type="number" min={0} step={5} id="mt-bb" value={d.bufferBefore} onChange={(e) => up({ bufferBefore: Number(e.target.value) || 0 })} /></div>
          <div className="field"><label htmlFor="mt-ba">Buffer after (min)</label><input className="input num" type="number" min={0} step={5} id="mt-ba" value={d.bufferAfter} onChange={(e) => up({ bufferAfter: Number(e.target.value) || 0 })} /></div>
          <div className="field"><label htmlFor="mt-notice">Minimum notice (hours)</label><input className="input num" type="number" min={0} id="mt-notice" value={d.minNoticeHours} onChange={(e) => up({ minNoticeHours: Number(e.target.value) || 0 })} /></div>
          <div className="field"><label htmlFor="mt-cap">Max per host per day</label><input className="input num" type="number" min={1} id="mt-cap" value={d.maxPerDay} onChange={(e) => up({ maxPerDay: Number(e.target.value) || 1 })} /></div>
          <div className="field"><label htmlFor="mt-hz">Bookable how far ahead (days)</label><input className="input num" type="number" min={1} id="mt-hz" value={d.horizonDays} onChange={(e) => up({ horizonDays: Number(e.target.value) || 1 })} /></div>
          <div className="field"><label htmlFor="mt-ms">When held, mark milestone done</label>
            <select className="input" id="mt-ms" value={d.completesMilestone ?? ''} onChange={(e) => up({ completesMilestone: e.target.value || undefined })}>
              <option value="">Nothing</option>
              {['Questionnaire Discussion', 'Draft Discussion', 'Signing', 'Signed', 'Onboarding Call', 'Hearing'].map((n) => <option key={n}>{n}</option>)}
            </select>
          </div>
          <div className="field"><label htmlFor="mt-price">Paid consult (LawPay at booking)</label><input className="input num" type="number" min={0} step={25} id="mt-price" placeholder="Free" value={d.price ?? ''} onChange={(e) => up({ price: Number(e.target.value) || undefined })} /></div>
          <div className="field"><label htmlFor="mt-group">Group event: seats</label><input className="input num" type="number" min={2} id="mt-group" placeholder="One-on-one" value={d.capacity ?? ''} onChange={(e) => up({ capacity: Number(e.target.value) || undefined })} /></div>
          <label className="row small" style={{ gap: 6, alignSelf: 'end' }}><input type="checkbox" id="mt-secret" checked={d.secret} onChange={(e) => up({ secret: e.target.checked })} /> Private link only (not listed)</label>
        </div>

        <div className="stack" style={{ gap: 6 }}>
          <span className="label">Questions</span>
          {d.questions.map((q, i) => (
            <div key={q.id} className="row" style={{ gap: 6 }}>
              <input className="input small" style={{ flex: '1 1 260px' }} id={`q-l-${q.id}`} aria-label="Question" value={q.label} onChange={(e) => up({ questions: d.questions.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)) })} />
              <select className="input small tight" id={`q-t-${q.id}`} aria-label="Answer type" value={q.type} onChange={(e) => up({ questions: d.questions.map((x, k) => (k === i ? { ...x, type: e.target.value as S.Question['type'] } : x)) })}>
                <option value="text">Short answer</option><option value="long">Paragraph</option><option value="phone">Phone</option><option value="choice">Multiple choice</option>
              </select>
              <label className="row small" style={{ gap: 4 }}><input type="checkbox" id={`q-r-${q.id}`} checked={q.required} onChange={(e) => up({ questions: d.questions.map((x, k) => (k === i ? { ...x, required: e.target.checked } : x)) })} />Required</label>
              <button className="btn sm ghost icon danger" aria-label="Remove question" onClick={() => up({ questions: d.questions.filter((_, k) => k !== i) })}>×</button>
            </div>
          ))}
          <div><button className="btn sm" onClick={() => up({ questions: [...d.questions, { id: newId('q'), label: '', type: 'text', required: false }] })}>+ Add question</button></div>
        </div>

        <div className="stack" style={{ gap: 6 }}>
          <span className="label">Reminders to the invitee</span>
          {d.reminders.map((r, i) => (
            <div key={i} className="row" style={{ gap: 6 }}>
              <input className="input small tight num" style={{ width: 70 }} type="number" min={1} id={`rm-h-${i}`} aria-label="Hours before" value={r.hoursBefore} onChange={(e) => up({ reminders: d.reminders.map((x, k) => (k === i ? { ...x, hoursBefore: Number(e.target.value) || 1 } : x)) })} />
              <span className="small">hours before, by</span>
              <select className="input small tight" id={`rm-c-${i}`} aria-label="Channel" value={r.channel} onChange={(e) => up({ reminders: d.reminders.map((x, k) => (k === i ? { ...x, channel: e.target.value as 'email' | 'text' } : x)) })}>
                <option value="email">Email</option><option value="text">Text message</option>
              </select>
              <button className="btn sm ghost icon danger" aria-label="Remove reminder" onClick={() => up({ reminders: d.reminders.filter((_, k) => k !== i) })}>×</button>
            </div>
          ))}
          <div><button className="btn sm" onClick={() => up({ reminders: [...d.reminders, { hoursBefore: 48, channel: 'email' }] })}>+ Add reminder</button></div>
        </div>

        <div className="row">
          <button className="btn primary" disabled={!d.name.trim() || !d.hosts.length || !d.places.length} onClick={() => { actions.saveMeetingType(d); notify(`${d.name} saved`); onClose(); }}>Save meeting type</button>
          <button className="btn" onClick={onClose}>Cancel</button>
          {mt.name && <button className="btn ghost danger" style={{ marginLeft: 'auto' }} onClick={() => { actions.deleteMeetingType(mt.id); notify(`${mt.name} deleted`); onClose(); }}>Delete</button>}
        </div>
      </div>
    </section>
  );
}

function TypesTab({ openPreview }: { openPreview: (id: string) => void }) {
  const { s, actions, notify } = useStore();
  const [editing, setEditing] = useState<S.MeetingType | null>(null);
  const groups: [S.MeetingType['audience'], string][] = [['prospects', 'For new prospects'], ['clients', 'For clients'], ['internal', 'Internal']];
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="banner small">Each meeting type is defined once, for every host and location that offers it. Your {s.meetingTypes.length} types here cover what took 64 separate Calendly event types.</div>
      <div><button className="btn primary" onClick={() => setEditing(S.MEETING_TYPES[1] && { ...S.MEETING_TYPES[1], id: newId('mt'), name: '', hosts: ['me'], places: ['zoom'], completesMilestone: undefined, price: undefined, capacity: undefined })}>+ New meeting type</button></div>
      {editing && <TypeEditor key={editing.id} mt={editing} onClose={() => setEditing(null)} />}
      {groups.map(([aud, label]) => {
        const list = s.meetingTypes.filter((m) => m.audience === aud);
        if (!list.length) return null;
        return (
          <section key={aud} className="panel">
            <div className="panel-head"><h2>{label} <span className="num small muted">{list.length}</span></h2></div>
            <ul className="list">
              {list.map((m) => (
                <li key={m.id} className="spread" style={{ flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0, flex: '1 1 320px' }} className="stack">
                    <div className="row" style={{ gap: 6 }}>
                      <strong>{m.name}</strong>
                      <span className="small muted num">{m.minutes} min</span>
                      {m.price && <span className="pill warn">Paid · {money(m.price)}</span>}
                      {m.capacity && <span className="pill info">Group · {m.capacity} seats</span>}
                      {m.completesMilestone && <span className="pill accent" title="Marks this milestone done when the meeting is held">→ {m.completesMilestone}</span>}
                      {m.secret && <span className="pill">Private link</span>}
                      {!m.active && <span className="pill">Off</span>}
                    </div>
                    <div className="row small muted" style={{ gap: 8 }}>
                      <span className="row" style={{ gap: 2 }}>{m.hosts.map((h) => <Person key={h} id={h} />)}</span>
                      <span>{m.hosts.length > 1 ? ASSIGN[m.assignment] : teamName(m.hosts[0])}</span>
                      <span>·</span>
                      <span>{m.places.map((p) => place(p)?.name).join(', ')}</span>
                    </div>
                  </div>
                  <div className="row" style={{ gap: 4 }}>
                    <label className="row small" style={{ gap: 4 }}><input type="checkbox" id={`act-${m.id}`} checked={m.active} onChange={() => actions.saveMeetingType({ ...m, active: !m.active })} />On</label>
                    <button className="btn sm" onClick={() => { navigator.clipboard?.writeText(`https://book.yourfirm.example/${m.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`).catch(() => undefined); notify('Booking link copied'); }}>Copy link</button>
                    <button className="btn sm" onClick={() => openPreview(m.id)}>Preview</button>
                    <button className="btn sm" onClick={() => setEditing(m)}>Edit</button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

// ---------------- Availability ----------------

function ScheduleCard({ sc }: { sc: S.Schedule }) {
  const { s, actions, notify } = useStore();
  const [od, setOd] = useState('');
  const save = (p: Partial<S.Schedule>) => actions.saveSchedule({ ...sc, ...p });
  const setDay = (wd: number, iv: [string, string][]) => save({ week: { ...sc.week, [wd]: iv } });
  return (
    <section className="panel">
      <div className="panel-head">
        <input className="input small" style={{ maxWidth: 320, fontWeight: 600 }} id={`sc-n-${sc.id}`} aria-label="Schedule name" value={sc.name} onChange={(e) => save({ name: e.target.value })} />
        <button className="btn sm ghost danger" onClick={() => { actions.deleteSchedule(sc.id); notify('Schedule deleted'); }}>Delete</button>
      </div>
      <div className="panel-body stack" style={{ gap: 10 }}>
        <div className="row small" style={{ gap: 10 }}>
          <span className="muted">Offers:</span>
          {S.PLACES.map((p) => (
            <label key={p.id} className="row" style={{ gap: 4 }}><input type="checkbox" id={`sc-${sc.id}-${p.id}`} checked={sc.places.includes(p.id)} onChange={() => save({ places: sc.places.includes(p.id) ? sc.places.filter((x) => x !== p.id) : [...sc.places, p.id] })} />{p.name}</label>
          ))}
        </div>
        <div className="row small" style={{ gap: 10 }}>
          <span className="muted">Used for:</span>
          <label className="row" style={{ gap: 4 }}><input type="checkbox" id={`sc-all-${sc.id}`} checked={!sc.meetingTypes?.length} onChange={(e) => save({ meetingTypes: e.target.checked ? undefined : [s.meetingTypes[0].id] })} />All meeting types</label>
          {!!sc.meetingTypes?.length && s.meetingTypes.filter((m) => m.hosts.includes(sc.owner)).map((m) => (
            <label key={m.id} className="row" style={{ gap: 4 }}><input type="checkbox" id={`sc-${sc.id}-mt-${m.id}`} checked={sc.meetingTypes!.includes(m.id)} onChange={() => save({ meetingTypes: sc.meetingTypes!.includes(m.id) ? sc.meetingTypes!.filter((x) => x !== m.id) : [...sc.meetingTypes!, m.id] })} />{m.name}</label>
          ))}
        </div>
        <div className="week-grid">
          {WD.map((w, wd) => {
            const iv = sc.week[wd] ?? [];
            return (
              <div key={wd} className="wk-row">
                <strong className="small" style={{ width: 36 }}>{w}</strong>
                <div className="row" style={{ gap: 6, flex: 1 }}>
                  {iv.length === 0 && <span className="small muted">Unavailable</span>}
                  {iv.map(([a, b], i) => (
                    <span key={i} className="iv">
                      <input className="input small tight num" type="time" step={900} aria-label={`${w} start`} id={`iv-${sc.id}-${wd}-${i}-a`} value={a} onChange={(e) => setDay(wd, iv.map((x, k) => (k === i ? [e.target.value, x[1]] : x)))} />
                      –
                      <input className="input small tight num" type="time" step={900} aria-label={`${w} end`} id={`iv-${sc.id}-${wd}-${i}-b`} value={b} onChange={(e) => setDay(wd, iv.map((x, k) => (k === i ? [x[0], e.target.value] : x)))} />
                      <button className="btn sm ghost icon" aria-label="Remove hours" onClick={() => setDay(wd, iv.filter((_, k) => k !== i))}>×</button>
                    </span>
                  ))}
                  <button className="btn sm ghost" onClick={() => setDay(wd, [...iv, ['09:00', '12:00']])}>+ hours</button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="stack" style={{ gap: 6 }}>
          <span className="label">Date overrides</span>
          {sc.overrides.map((o, i) => (
            <div key={i} className="row small" style={{ gap: 6 }}>
              <span className="num">{fmtDate(o.date)}</span>
              <span>{o.intervals.length ? o.intervals.map(([a, b]) => `${a}–${b}`).join(', ') : 'Unavailable (out of office)'}</span>
              <button className="btn sm ghost icon" aria-label="Remove override" onClick={() => save({ overrides: sc.overrides.filter((_, k) => k !== i) })}>×</button>
            </div>
          ))}
          <div className="row" style={{ gap: 6 }}>
            <input className="input small tight num" type="date" id={`od-${sc.id}`} aria-label="Date" value={od} onChange={(e) => setOd(e.target.value)} />
            <button className="btn sm" disabled={!od} onClick={() => { save({ overrides: [...sc.overrides, { date: od, intervals: [] }] }); setOd(''); notify('Marked unavailable that day'); }}>Block this day</button>
          </div>
        </div>
      </div>
    </section>
  );
}

function AvailabilityTab() {
  const { s, actions } = useStore();
  const [who, setWho] = useState('me');
  const mine = s.schedules.filter((x) => x.owner === who);
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row">
        <select className="input" style={{ width: 'auto' }} id="av-who" aria-label="Whose availability" value={who} onChange={(e) => setWho(e.target.value)}>
          {TEAM.filter((t) => t.id !== 'lena').map((t) => <option key={t.id} value={t.id}>{t.id === 'me' ? 'Your schedules' : `${t.name}’s schedules`}</option>)}
        </select>
        <button className="btn" onClick={() => actions.saveSchedule({ id: newId('sc'), name: 'New schedule', owner: who, places: ['zoom'], week: { 1: [['09:00', '12:00']] }, overrides: [] })}>+ New schedule</button>
        <span className="small muted">A schedule is a block of hours for certain locations, like “Consults · Woodbridge”. Busy times on the firm calendar are always excluded.</span>
      </div>
      {mine.length === 0 && <p className="muted">No schedules yet.</p>}
      {mine.map((sc) => <ScheduleCard key={sc.id} sc={sc} />)}
    </div>
  );
}

// ---------------- Routing ----------------

function RoutingTab() {
  const { s, actions, notify } = useStore();
  const f = s.routing;
  const [q, setQ] = useState(0);
  const [a, setA] = useState('');
  const [to, setTo] = useState('msg');
  const [msg, setMsg] = useState('');
  return (
    <div className="grid cols-main">
      <section className="panel">
        <div className="panel-head"><h2>Routing form: {f.name}</h2><span className="small muted">Asked before the calendar appears</span></div>
        <ol className="panel-body stack" style={{ gap: 10, margin: 0, paddingLeft: 34 }}>
          {f.questions.map((qq, i) => (
            <li key={i}>
              <strong>{qq.label}</strong>
              <div className="row small" style={{ gap: 4, marginTop: 4 }}>{qq.choices.map((c) => <span key={c} className="pill">{c}</span>)}</div>
            </li>
          ))}
        </ol>
        <div className="panel-body small muted">After the last question, anyone not routed elsewhere goes to <strong>{s.meetingTypes.find((m) => m.id === f.fallback)?.name}</strong>, at the office they chose.</div>
      </section>
      <section className="panel">
        <div className="panel-head"><h2>Routes</h2></div>
        <ul className="list">
          {f.routes.map((r, i) => (
            <li key={i} className="spread small">
              <span>If “{f.questions[r.when[0].question].label}” is <strong>{r.when[0].answer}</strong> → {'message' in r.to ? <em>show a message</em> : <strong>{s.meetingTypes.find((m) => m.id === (r.to as { meetingTypeId: string }).meetingTypeId)?.name}</strong>}</span>
              <button className="btn sm ghost icon danger" aria-label="Remove route" onClick={() => actions.saveRouting({ ...f, routes: f.routes.filter((_, k) => k !== i) })}>×</button>
            </li>
          ))}
        </ul>
        <div className="panel-body stack" style={{ gap: 6, borderTop: '1px solid var(--line)' }}>
          <span className="label">Add a route</span>
          <select className="input small" id="rt-q" aria-label="Question" value={q} onChange={(e) => { setQ(Number(e.target.value)); setA(''); }}>{f.questions.map((qq, i) => <option key={i} value={i}>{qq.label}</option>)}</select>
          <select className="input small" id="rt-a" aria-label="Answer" value={a} onChange={(e) => setA(e.target.value)}><option value="">Choose an answer…</option>{f.questions[q].choices.map((c) => <option key={c}>{c}</option>)}</select>
          <select className="input small" id="rt-to" aria-label="Send to" value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="msg">Show a message instead of the calendar</option>
            {s.meetingTypes.filter((m) => m.audience === 'prospects').map((m) => <option key={m.id} value={m.id}>Book: {m.name}</option>)}
          </select>
          {to === 'msg' && <input className="input small" id="rt-msg" aria-label="Message" placeholder="What they’ll see" value={msg} onChange={(e) => setMsg(e.target.value)} />}
          <div><button className="btn sm primary" disabled={!a || (to === 'msg' && !msg.trim())} onClick={() => { actions.saveRouting({ ...f, routes: [...f.routes, { when: [{ question: q, answer: a }], to: to === 'msg' ? { message: msg.trim() } : { meetingTypeId: to } }] }); setA(''); setMsg(''); notify('Route added'); }}>Add route</button></div>
        </div>
      </section>
    </div>
  );
}

// ---------------- Bookings ----------------

function BookingsTab() {
  const { s, actions, lookup, go, notify } = useStore();
  const list = [...s.bookings].sort((a, b) => a.start.localeCompare(b.start));
  const decided = s.bookings.filter((b) => b.status === 'held' || b.status === 'no-show');
  const shows = decided.filter((b) => b.status === 'held').length;
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="stats" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        <div className="stat"><span className="label">Upcoming</span><span className="v">{s.bookings.filter((b) => b.status === 'booked').length}</span></div>
        <div className="stat"><span className="label">Show rate</span><span className="v">{decided.length ? `${Math.round((shows / decided.length) * 100)}%` : '—'}</span></div>
        <div className="stat"><span className="label">No-shows</span><span className="v">{decided.length - shows}</span></div>
      </div>
      <section className="panel">
        <div className="panel-head"><h2>Bookings</h2><span className="small muted">Marking a meeting held completes its milestone and logs client contact.</span></div>
        {list.length === 0 && <p className="panel-body muted">No bookings yet. Try the Booking page tab.</p>}
        <ul className="list">
          {list.map((b) => {
            const mt = s.meetingTypes.find((m) => m.id === b.meetingTypeId);
            return (
              <li key={b.id} className="spread" style={{ flexWrap: 'wrap' }}>
                <span>
                  <strong>{mt?.name}</strong> · {b.who}
                  <div className="small muted">{fmtDate(b.start)} {fmtTime(b.start)} · {b.minutes} min · {teamName(b.host)} · {place(b.place)?.name}
                    {b.matterId && <> · <button className="link" onClick={() => go('matter', b.matterId)}>{lookup.matter(b.matterId)?.name}</button></>}
                    {b.pncId && <> · <button className="link" onClick={() => go('pnc', b.pncId)}>PNC matter</button></>}
                  </div>
                </span>
                {b.status === 'booked' ? (
                  <span className="row" style={{ gap: 4 }}>
                    <button className="btn sm primary" onClick={() => { actions.setBookingStatus(b.id, 'held'); notify(mt?.completesMilestone && b.matterId ? `Held. “${mt.completesMilestone}” marked done on the matter.` : 'Marked held'); }}>Held</button>
                    <button className="btn sm" onClick={() => { actions.setBookingStatus(b.id, 'no-show'); notify('No-show logged. A follow-up task is a good idea.'); }}>No-show</button>
                    <button className="btn sm ghost" onClick={() => { actions.setBookingStatus(b.id, 'cancelled'); notify('Cancelled and removed from the calendar'); }}>Cancel</button>
                  </span>
                ) : <span className={`pill ${b.status === 'held' ? 'ok' : b.status === 'no-show' ? 'danger' : ''}`}>{b.status === 'held' ? 'Held' : b.status === 'no-show' ? 'No-show' : 'Cancelled'}</span>}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

// ---------------- Public booking page ----------------

function BookingPage({ initialType }: { initialType?: string }) {
  const { s, actions, lookup, notify } = useStore();
  const [mode, setMode] = useState<'prospect' | 'client'>(initialType && s.meetingTypes.find((m) => m.id === initialType)?.audience === 'clients' ? 'client' : 'prospect');
  const [answersRF, setAnswersRF] = useState<string[]>([]);
  const [typeId, setTypeId] = useState<string | undefined>(initialType);
  const [placeId, setPlaceId] = useState<string>('');
  const [hostPick, setHostPick] = useState<string>('');
  const [day, setDay] = useState<string>('');
  const [slot, setSlot] = useState<S.Slot | null>(null);
  const [who, setWho] = useState('Avery, Jordan');
  const [email, setEmail] = useState('jordan.avery@example.com');
  const [qa, setQa] = useState<Record<string, string>>({ 'q-cell': '(555) 555-0142', 'q-city': 'Woodbridge, VA' });
  const [matterId, setMatterId] = useState('m1');
  const [done, setDone] = useState<string | null>(null);

  const routed = mode === 'prospect' && !initialType ? S.route(s.routing, answersRF) : null;
  const mt = s.meetingTypes.find((m) => m.id === (typeId ?? (routed && 'meetingTypeId' in routed ? routed.meetingTypeId : undefined)));
  const officeFromForm = answersRF[2] === 'Woodbridge office' ? 'woodbridge' : answersRF[2] === 'Arlington office' ? 'arlington' : answersRF[2] === 'Online' ? 'zoom' : '';
  const effPlace = placeId || (mt && officeFromForm && mt.places.includes(officeFromForm) ? officeFromForm : mt?.places.length === 1 ? mt.places[0] : '');
  const busy = useMemo(() => s.events.map((e) => ({ host: e.host ?? 'me', start: e.start, minutes: e.minutes })), [s.events]);
  const days = mt ? S.nextDays(Math.min(mt.horizonDays, 14)) : [];
  const hostFilter = mt && mt.assignment === 'client-picks' && mt.hosts.length > 1 ? hostPick || undefined : undefined;
  const slots = mt && effPlace && day ? S.slotsFor(mt, effPlace, day, s.schedules, busy, hostFilter) : [];

  const reset = () => { setAnswersRF([]); setTypeId(initialType); setPlaceId(''); setHostPick(''); setDay(''); setSlot(null); setDone(null); };

  if (done) {
    return (
      <div className="booking">
        <div className="booking-head"><div className="label">Confirmed</div><h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>You’re booked.</h2><div className="muted">{done}</div></div>
        <div className="panel-body stack">
          <div className="label">What happened inside the firm</div>
          <ul style={{ margin: 0, paddingLeft: 18 }} className="stack small">
            <li>On {teamName(slot!.host)}’s calendar, with buffers held.</li>
            {mt!.audience === 'prospects' ? <li>A PNC matter was created in “Consult scheduled”, with pre-consult reminders and a conflict check waiting.</li> : <li>Linked to the matter{mt!.completesMilestone ? `; marking it held will complete “${mt!.completesMilestone}”` : ''}.</li>}
            {mt!.reminders.map((r, i) => <li key={i}>{r.channel === 'text' ? 'Text' : 'Email'} reminder {r.hoursBefore} hours before, with a reschedule link.</li>)}
            {mt!.price && <li>{money(mt!.price)} collected through LawPay (simulated).</li>}
          </ul>
          <div><button className="btn" onClick={reset}>Book another</button></div>
        </div>
      </div>
    );
  }

  return (
    <div className="booking">
      <div className="booking-head">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="label">Public booking page · what the client sees</div>
          {!initialType && (
            <div className="seg" role="group" aria-label="Who is booking">
              <button aria-pressed={mode === 'prospect'} onClick={() => { setMode('prospect'); reset(); }}>New client</button>
              <button aria-pressed={mode === 'client'} onClick={() => { setMode('client'); reset(); }}>Existing client (portal)</button>
            </div>
          )}
        </div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>{mt ? mt.name : mode === 'prospect' ? 'Schedule a consultation' : 'Book a meeting'}</h2>
        {mt && <div className="muted small">{mt.minutes} minutes{mt.price ? ` · ${money(mt.price)}, paid when you book` : ''}{mt.capacity ? ` · group session, ${mt.capacity} seats` : ''}</div>}
      </div>
      <div className="panel-body stack" style={{ gap: 14 }}>
        {mode === 'prospect' && !initialType && (
          <div className="stack" style={{ gap: 10 }}>
            {s.routing.questions.map((q, i) => i <= answersRF.length && (
              <div key={i} className="field">
                <label htmlFor={`rf-${i}`}>{q.label}</label>
                <select className="input" id={`rf-${i}`} value={answersRF[i] ?? ''} onChange={(e) => { setAnswersRF([...answersRF.slice(0, i), e.target.value]); setDay(''); setSlot(null); }}>
                  <option value="">Choose…</option>
                  {q.choices.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
            ))}
            {routed && 'message' in routed && <div className="banner warn">{routed.message}</div>}
          </div>
        )}
        {mode === 'client' && !initialType && (
          <div className="grid cols-2" style={{ gap: 10 }}>
            <div className="field"><label htmlFor="bk-type">Meeting</label>
              <select className="input" id="bk-type" value={typeId ?? ''} onChange={(e) => { setTypeId(e.target.value || undefined); setPlaceId(''); setDay(''); setSlot(null); }}>
                <option value="">Choose…</option>
                {s.meetingTypes.filter((m) => m.audience === 'clients' && m.active && !m.secret).map((m) => <option key={m.id} value={m.id}>{m.name} ({m.minutes} min)</option>)}
              </select>
            </div>
            <div className="field"><label htmlFor="bk-matter">Signed in as (portal)</label>
              <select className="input" id="bk-matter" value={matterId} onChange={(e) => setMatterId(e.target.value)}>
                {s.matters.filter((m) => m.status === 'open').map((m) => <option key={m.id} value={m.id}>{lookup.clientOf(m)?.name} — {m.name}</option>)}
              </select>
            </div>
          </div>
        )}

        {mt && (
          <>
            <div className="field"><span className="small muted">Where</span>
              <div className="row" style={{ gap: 6 }}>
                {mt.places.map((p) => <button key={p} className="btn sm" aria-pressed={effPlace === p} onClick={() => { setPlaceId(p); setDay(''); setSlot(null); }}>{place(p)?.name}</button>)}
              </div>
            </div>
            {mt.assignment === 'client-picks' && mt.hosts.length > 1 && (
              <div className="field"><span className="small muted">With</span>
                <div className="row" style={{ gap: 6 }}>
                  <button className="btn sm" aria-pressed={!hostPick} onClick={() => { setHostPick(''); setSlot(null); }}>Anyone available</button>
                  {mt.hosts.map((h) => <button key={h} className="btn sm" aria-pressed={hostPick === h} onClick={() => { setHostPick(h); setSlot(null); }}>{h === 'me' ? 'Don (you)' : teamName(h)}</button>)}
                </div>
              </div>
            )}
            {effPlace && (
              <>
                <div className="days-strip" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
                  {days.slice(0, 14).map((d) => {
                    const n = S.slotsFor(mt, effPlace, d, s.schedules, busy, hostFilter).length;
                    const dt = new Date(d + 'T12:00:00');
                    return (
                      <button key={d} aria-pressed={day === d} disabled={!n} onClick={() => { setDay(d); setSlot(null); }}>
                        <div style={{ fontWeight: 600 }}>{dt.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                        <div className="num">{dt.getDate()}</div>
                      </button>
                    );
                  })}
                </div>
                {day && (
                  <div className="slots">
                    {slots.length === 0 && <span className="small muted">No times left this day.</span>}
                    {slots.map((t) => (
                      <button key={t.start.toISOString() + t.host} className="num" aria-pressed={slot?.start.getTime() === t.start.getTime()} onClick={() => setSlot(t)} title={`With ${teamName(t.host)}`}>
                        {fmtTime(t.start.toISOString())}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            {slot && (
              <form
                className="stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  const missing = mt.questions.find((q) => q.required && !qa[q.id]?.trim());
                  if (missing) { notify(`Please answer: ${missing.label}`); return; }
                  const m = mode === 'client' ? lookup.matter(matterId) : undefined;
                  const name = m ? lookup.clientOf(m)?.name ?? who : who;
                  actions.bookMeeting({ meetingTypeId: mt.id, host: slot.host, place: effPlace, start: slot.start.toISOString(), minutes: mt.minutes, who: name, answers: { ...qa, need: answersRF[0] ?? '' }, matterId: m?.id, phone: qa['q-cell'], email });
                  setDone(`${mt.name} with ${slot.host === 'me' ? 'Don' : teamName(slot.host)} · ${slot.start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at ${fmtTime(slot.start.toISOString())} · ${place(effPlace)?.name}`);
                }}
              >
                <div className="small">With <strong>{slot.host === 'me' ? 'Don' : teamName(slot.host)}</strong> at <strong>{fmtTime(slot.start.toISOString())}</strong></div>
                {mode === 'prospect' && (
                  <div className="grid cols-2" style={{ gap: 10 }}>
                    <div className="field"><label htmlFor="b-name">Your name</label><input className="input" id="b-name" value={who} onChange={(e) => setWho(e.target.value)} /></div>
                    <div className="field"><label htmlFor="b-email">Email</label><input className="input" id="b-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                  </div>
                )}
                {mt.questions.map((q) => (
                  <div className="field" key={q.id}>
                    <label htmlFor={`bq-${q.id}`}>{q.label}{q.required && ' *'}</label>
                    {q.type === 'long' ? <textarea className="input" rows={2} id={`bq-${q.id}`} value={qa[q.id] ?? ''} onChange={(e) => setQa((x) => ({ ...x, [q.id]: e.target.value }))} /> : <input className="input" id={`bq-${q.id}`} value={qa[q.id] ?? ''} onChange={(e) => setQa((x) => ({ ...x, [q.id]: e.target.value }))} />}
                  </div>
                ))}
                <button className="btn primary" type="submit">{mt.price ? `Pay ${money(mt.price)} with LawPay & confirm` : `Confirm ${fmtTime(slot.start.toISOString())}`}</button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function Scheduling() {
  const { s } = useStore();
  const [tab, setTab] = useState<Tab>('types');
  const [preview, setPreview] = useState<string | undefined>();
  return (
    <>
      <PageHead title="Scheduling" sub="Booking links built into the firm. Availability comes from each person’s schedules and the firm calendar; bookings land on the right PNC matter or Client matter." />
      <div className="tabs" role="tablist">
        {([['types', 'Meeting types'], ['availability', 'Availability'], ['routing', 'Routing form'], ['bookings', `Bookings${s.bookings.filter((b) => b.status === 'booked').length ? ` (${s.bookings.filter((b) => b.status === 'booked').length})` : ''}`], ['page', 'Booking page']] as [Tab, string][]).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => { setTab(k); if (k === 'page') setPreview(undefined); }}>{l}</button>
        ))}
      </div>
      {tab === 'types' && <TypesTab openPreview={(id) => { setPreview(id); setTab('page'); }} />}
      {tab === 'availability' && <AvailabilityTab />}
      {tab === 'routing' && <RoutingTab />}
      {tab === 'bookings' && <BookingsTab />}
      {tab === 'page' && <div style={{ maxWidth: 720 }}><BookingPage key={preview ?? 'root'} initialType={preview} /></div>}
    </>
  );
}
