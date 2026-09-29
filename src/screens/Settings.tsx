import { useState } from 'react';
import { useStore } from '../store';
import { INCREMENT_OPTIONS, type RoundingMode } from '../billing';
import type { Cadences, Role, RoleSide } from '../data';
import { newId, renderNumber, type DueRule, type Milestone, type PracticeArea, type Stage, type TaskTemplate } from '../practice';
import { PERMS, TEAM, type Perm, type PermRole, type UserAccess } from '../data';
import * as T from '../trust';
import { PageHead } from '../ui';

type Section = 'users' | 'numbering' | 'trust' | 'areas' | 'roles' | 'intake' | 'billing' | 'integrations';

const INTEGRATIONS = [
  { name: 'Phone system (VoIP)', detail: 'RingCentral, Zoom Phone, 8x8, Dialpad. Caller ID matched to clients, click-to-call, calls logged as time and as client contact.', status: 'Planned' },
  { name: 'Calendar', detail: 'Google and Microsoft 365, two-way sync. Booking-link availability comes from here.', status: 'Planned' },
  { name: 'Email', detail: 'Outlook and Gmail. Emails to and from a client are filed on the matter and count as contact.', status: 'Planned' },
  { name: 'Slack', detail: 'Post milestone and closeout alerts to your existing channels while the team moves over.', status: 'Planned' },
  { name: 'LawPay', detail: 'Card and eCheck payments from invoices and the client portal. Each payment is deposited to trust or operating correctly, with processing fees always charged to operating. Payments post back to the invoice automatically.', status: 'Planned' },
  { name: 'E-signature', detail: 'Engagement letters and documents signed inside the client portal.', status: 'Planned' },
  { name: 'Zapier', detail: 'Connect to 6,000+ apps. Triggers: new PNC matter, matter changed stage, milestone completed, task done, invoice paid, conflict check recorded. Actions: create a PNC matter or contact, add a note, create a task, log a client contact.', status: 'Planned' },
  { name: 'Open API + webhooks', detail: 'The same events Zapier uses, available to any tool or developer, so nothing is locked in.', status: 'Planned' },
  { name: 'monday.com import', detail: 'One-time import of open matters, milestone dates and completed-matter history.', status: 'Planned' },
];

function move<T>(arr: T[], i: number, d: -1 | 1): T[] {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const out = [...arr];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

function AddRow({ placeholder, onAdd, id }: { placeholder: string; onAdd: (v: string) => void; id: string }) {
  const [v, setV] = useState('');
  return (
    <form className="row" style={{ gap: 6 }} onSubmit={(e) => { e.preventDefault(); if (v.trim()) { onAdd(v.trim()); setV(''); } }}>
      <input className="input small" style={{ flex: '1 1 180px' }} id={id} aria-label={placeholder} placeholder={placeholder} value={v} onChange={(e) => setV(e.target.value)} />
      <button className="btn sm" type="submit">Add</button>
    </form>
  );
}

function FeeScheduleEditor({ area, save }: { area: PracticeArea; save: (patch: Partial<PracticeArea>) => void }) {
  const total = area.feeSchedule.reduce((n, f) => n + f.percent, 0);
  const set = (feeSchedule: PracticeArea['feeSchedule']) => save({ feeSchedule });
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Fixed-price earning schedule</h2>
        <span className="small muted">Fixed-price fees stay in trust until earned. When a milestone below is marked done, that share is queued to move to operating, pending approval.</span>
      </div>
      <ul className="list">
        {area.feeSchedule.length === 0 && <li className="muted small">No schedule. Fixed-price matters in this area are drawn by hand from the matter’s Trust tab.</li>}
        {area.feeSchedule.map((f, i) => (
          <li key={i} className="row" style={{ gap: 6 }}>
            <input className="input small tight num" style={{ width: 70 }} type="number" min={1} max={100} id={`fs-p-${i}`} aria-label="Percent" value={f.percent} onChange={(e) => set(area.feeSchedule.map((x, k) => (k === i ? { ...x, percent: Math.max(0, Math.min(100, Number(e.target.value) || 0)) } : x)))} />
            <span className="small">% earned when</span>
            <select className="input small tight" id={`fs-m-${i}`} aria-label="Milestone" value={f.milestoneId} onChange={(e) => set(area.feeSchedule.map((x, k) => (k === i ? { ...x, milestoneId: e.target.value } : x)))}>
              {area.milestones.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <span className="small">is done</span>
            <button className="btn sm ghost icon danger" aria-label="Remove" onClick={() => set(area.feeSchedule.filter((_, k) => k !== i))}>×</button>
          </li>
        ))}
      </ul>
      <div className="panel-body row">
        <button className="btn sm" onClick={() => set([...area.feeSchedule, { milestoneId: area.milestones[Math.min(1, area.milestones.length - 1)].id, percent: Math.max(0, 100 - total) }])}>+ Add step</button>
        <span className={`small ${total === 100 || total === 0 ? 'muted' : 'sev-text'}`}>{total === 0 ? '' : total === 100 ? 'Totals 100%' : `Totals ${total}%. Fixed-price schedules normally total 100%.`}</span>
      </div>
    </section>
  );
}

function StageTasksEditor({ area, save }: { area: PracticeArea; save: (patch: Partial<PracticeArea>) => void }) {
  const [stageId, setStageId] = useState(area.stages[0]?.id ?? '');
  const set = (stageTasks: TaskTemplate[]) => save({ stageTasks });
  const upd = (id: string, patch: Partial<TaskTemplate>) => set(area.stageTasks.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  return (
    <section className="panel">
      <div className="panel-head"><h2>Tasks created by stage</h2><span className="small muted">When a matter enters a stage, these tasks are created and assigned automatically.</span></div>
      <ul className="list">
        {area.stages.map((st) => {
          const items = area.stageTasks.filter((t) => t.stageId === st.id);
          if (!items.length) return null;
          return (
            <li key={st.id} className="stack" style={{ display: 'flex', gap: 8 }}>
              <strong className="small">{st.name}</strong>
              {items.map((t) => (
                <div key={t.id} className="stack" style={{ gap: 4, width: '100%' }}>
                  <div className="tt-row">
                    <input className="input small" id={`tt-title-${t.id}`} aria-label="Task" value={t.title} onChange={(e) => upd(t.id, { title: e.target.value })} />
                    <select className="input small tight" id={`tt-who-${t.id}`} aria-label="Assign to" value={t.assignTo} onChange={(e) => upd(t.id, { assignTo: e.target.value })}>
                      <option value="owner">Responsible attorney</option>
                      <option value="ball">Whoever has the ball</option>
                      {TEAM.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                    <span className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                      <span className="small muted">due in</span>
                      <input className="input small tight num" style={{ width: 56 }} type="number" min={0} id={`tt-n-${t.id}`} aria-label="Due in" value={t.dueIn} onChange={(e) => upd(t.id, { dueIn: Math.max(0, Number(e.target.value) || 0) })} />
                      <select className="input small tight" id={`tt-u-${t.id}`} aria-label="Unit" value={t.dueUnit} onChange={(e) => upd(t.id, { dueUnit: e.target.value as TaskTemplate['dueUnit'] })}>
                        <option value="workdays">workdays</option>
                        <option value="days">days</option>
                      </select>
                    </span>
                    <button className="btn sm ghost icon danger" aria-label={`Delete ${t.title}`} onClick={() => set(area.stageTasks.filter((x) => x.id !== t.id))}>×</button>
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    <select className="input small tight" id={`tt-k-${t.id}`} aria-label="Type" value={t.kind} onChange={(e) => upd(t.id, { kind: e.target.value as TaskTemplate['kind'] })}>
                      <option value="internal">Task</option>
                      <option value="client">Client follow-up</option>
                      <option value="court">Court deadline</option>
                    </select>
                    <input className="input small" style={{ flex: '1 1 240px' }} id={`tt-cl-${t.id}`} aria-label="Checklist" placeholder="Checklist items, separated by commas (optional)" value={t.checklist.join(', ')} onChange={(e) => upd(t.id, { checklist: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} />
                  </div>
                </div>
              ))}
            </li>
          );
        })}
        {area.stageTasks.length === 0 && <li className="muted small">No automatic tasks yet.</li>}
      </ul>
      <div className="panel-body row" style={{ gap: 6 }}>
        <span className="small">Add a task to</span>
        <select className="input small tight" id="tt-stage" aria-label="Stage" value={stageId} onChange={(e) => setStageId(e.target.value)}>
          {area.stages.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
        </select>
        <div style={{ flex: '1 1 240px' }}>
          <AddRow id="add-tt" placeholder="Task, e.g. Order certified copies" onAdd={(title) => set([...area.stageTasks, { id: newId('tt'), stageId, title, assignTo: 'owner', dueIn: 3, dueUnit: 'workdays', kind: 'internal', checklist: [] }])} />
        </div>
      </div>
    </section>
  );
}

function AreaEditor({ area }: { area: PracticeArea }) {
  const { s, actions, notify } = useStore();
  const save = (patch: Partial<PracticeArea>) => actions.saveArea({ ...area, ...patch });
  const inStage = (id: string) => s.matters.filter((m) => m.areaId === area.id && m.stageId === id).length;
  const areaMatters = s.matters.filter((m) => m.areaId === area.id).length;

  const setStages = (stages: Stage[]) => save({ stages });
  const setMilestones = (milestones: Milestone[]) => save({ milestones });
  const setRule = (i: number, rule: DueRule | undefined) => setMilestones(area.milestones.map((m, k) => (k === i ? { ...m, rule } : m)));

  return (
    <div className="stack" style={{ gap: 16 }}>
      <section className="panel">
        <div className="panel-head">
          <h2>General</h2>
          <button
            className="btn sm danger"
            disabled={areaMatters > 0}
            title={areaMatters ? `${areaMatters} matters use this area. Move or close them first.` : 'Delete this practice area'}
            onClick={() => { actions.deleteArea(area.id); notify(`${area.name} deleted`); }}
          >
            Delete area
          </button>
        </div>
        <div className="panel-body grid cols-2" style={{ gap: 12 }}>
          <div className="field"><label htmlFor="a-name">Name</label><input className="input" id="a-name" value={area.name} onChange={(e) => save({ name: e.target.value })} /></div>
          <div className="field"><label htmlFor="a-plan">What you call the matter type</label><input className="input" id="a-plan" value={area.planLabel} onChange={(e) => save({ planLabel: e.target.value })} /></div>
          <div className="field">
            <label htmlFor="a-soon">“Contact soon” after (days without contact)</label>
            <input className="input num" id="a-soon" type="number" min={1} value={area.cadence.soon} onChange={(e) => save({ cadence: { ...area.cadence, soon: Math.max(1, Number(e.target.value) || 1) } })} />
          </div>
          <div className="field">
            <label htmlFor="a-fu">“Follow-up needed” after (days)</label>
            <input className="input num" id="a-fu" type="number" min={1} value={area.cadence.followUp} onChange={(e) => save({ cadence: { ...area.cadence, followUp: Math.max(1, Number(e.target.value) || 1) } })} />
          </div>
        </div>
        {area.cadence.followUp <= area.cadence.soon && <div className="panel-body banner warn" style={{ margin: '0 16px 14px' }}>“Follow-up needed” should be later than “Contact soon”.</div>}
      </section>

      <section className="panel">
        <div className="panel-head"><h2>Stages</h2><span className="small muted">Board columns, in order. The last one is closeout.</span></div>
        <ul className="list">
          {area.stages.map((st, i) => (
            <li key={st.id} className="spread">
              <span className="num small muted" style={{ width: 20 }}>{i + 1}</span>
              <input className="input small" style={{ flex: 1 }} id={`st-${st.id}`} aria-label="Stage name" value={st.name} onChange={(e) => setStages(area.stages.map((x) => (x.id === st.id ? { ...x, name: e.target.value } : x)))} />
              <span className="small muted num" style={{ width: 70, textAlign: 'right' }}>{inStage(st.id)} matter{inStage(st.id) === 1 ? '' : 's'}</span>
              <button className="btn sm ghost icon" aria-label="Move up" disabled={i === 0} onClick={() => setStages(move(area.stages, i, -1))}>↑</button>
              <button className="btn sm ghost icon" aria-label="Move down" disabled={i === area.stages.length - 1} onClick={() => setStages(move(area.stages, i, 1))}>↓</button>
              <button
                className="btn sm ghost icon danger"
                aria-label={`Delete ${st.name}`}
                disabled={inStage(st.id) > 0 || area.stages.length <= 2}
                title={inStage(st.id) > 0 ? 'Move the matters in this stage first' : 'Delete stage'}
                onClick={() => save({ stages: area.stages.filter((x) => x.id !== st.id), stageTasks: area.stageTasks.filter((t) => t.stageId !== st.id) })}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <div className="panel-body"><AddRow id="add-stage" placeholder="New stage name" onAdd={(name) => { const stages = [...area.stages]; stages.splice(stages.length - 1, 0, { id: newId('st'), name }); setStages(stages); }} /></div>
      </section>

      <FeeScheduleEditor area={area} save={save} />

      <StageTasksEditor area={area} save={save} />

      <section className="panel">
        <div className="panel-head"><h2>Milestones & deadline rules</h2><span className="small muted">The dated steps of every matter. A rule sets the due date automatically; any matter can override it.</span></div>
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Milestone</th><th>Automatic due date</th><th /></tr></thead>
            <tbody>
              {area.milestones.map((ms, i) => (
                <tr key={ms.id}>
                  <td style={{ minWidth: 200 }}>
                    <input className="input small" id={`ms-${ms.id}`} aria-label="Milestone name" value={ms.name} onChange={(e) => setMilestones(area.milestones.map((x) => (x.id === ms.id ? { ...x, name: e.target.value } : x)))} />
                  </td>
                  <td>
                    <div className="row" style={{ gap: 4 }}>
                      <select className="input small tight" style={{ width: 'auto' }} id={`rule-on-${ms.id}`} aria-label="Has a rule" value={ms.rule ? 'on' : 'off'} onChange={(e) => {
                        const prev = area.milestones.slice(0, i).reverse()[0];
                        setRule(i, e.target.value === 'on' && prev ? { after: prev.id, amount: 5, unit: 'workdays' } : undefined);
                      }}>
                        <option value="off">None</option>
                        <option value="on" disabled={i === 0}>Due…</option>
                      </select>
                      {ms.rule && (
                        <>
                          <input className="input small tight num" style={{ width: 64 }} type="number" min={0} id={`rule-n-${ms.id}`} aria-label="Amount" value={ms.rule.amount} onChange={(e) => setRule(i, { ...ms.rule!, amount: Math.max(0, Number(e.target.value) || 0) })} />
                          <select className="input small tight" style={{ width: 'auto' }} id={`rule-u-${ms.id}`} aria-label="Unit" value={ms.rule.unit} onChange={(e) => setRule(i, { ...ms.rule!, unit: e.target.value as DueRule['unit'] })}>
                            <option value="days">calendar days</option>
                            <option value="workdays">workdays</option>
                          </select>
                          <span className="small muted">after</span>
                          <select className="input small tight" style={{ width: 'auto' }} id={`rule-a-${ms.id}`} aria-label="After milestone" value={ms.rule.after} onChange={(e) => setRule(i, { ...ms.rule!, after: e.target.value })}>
                            {area.milestones.filter((x) => x.id !== ms.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                          </select>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="r" style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn sm ghost icon" aria-label="Move up" disabled={i === 0} onClick={() => setMilestones(move(area.milestones, i, -1))}>↑</button>
                    <button className="btn sm ghost icon" aria-label="Move down" disabled={i === area.milestones.length - 1} onClick={() => setMilestones(move(area.milestones, i, 1))}>↓</button>
                    <button
                      className="btn sm ghost icon danger"
                      aria-label={`Delete ${ms.name}`}
                      onClick={() => setMilestones(area.milestones.filter((x) => x.id !== ms.id).map((x) => (x.rule?.after === ms.id ? { ...x, rule: undefined } : x)))}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="panel-body stack" style={{ gap: 8 }}>
          <AddRow id="add-ms" placeholder="New milestone name" onAdd={(name) => setMilestones([...area.milestones.slice(0, -1), { id: newId('ms'), name }, ...area.milestones.slice(-1)])} />
          <p className="small muted">The probate and guardianship rules here are starting examples. Set them to your jurisdiction’s actual deadlines.</p>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><h2>{area.planLabel} options</h2></div>
        <div className="panel-body stack" style={{ gap: 10 }}>
          <div className="row" style={{ gap: 6 }}>
            {area.planTypes.length === 0 && <span className="small muted">None yet.</span>}
            {area.planTypes.map((p) => (
              <span key={p} className="pill chip">
                {p}
                <button className="chip-x" aria-label={`Remove ${p}`} onClick={() => save({ planTypes: area.planTypes.filter((x) => x !== p) })}>×</button>
              </span>
            ))}
          </div>
          <AddRow id="add-plan" placeholder={`New ${area.planLabel.toLowerCase()}`} onAdd={(v) => !area.planTypes.includes(v) && save({ planTypes: [...area.planTypes, v] })} />
        </div>
      </section>
    </div>
  );
}

function CadenceEditor() {
  const { s, actions, notify } = useStore();
  const rows: { key: keyof Cadences; label: string; help: string }[] = [
    { key: 'scheduling', label: 'Getting the consult booked', help: 'Days after first contact' },
    { key: 'preConsult', label: 'Before the consult (show-rate reminders)', help: 'Days before the consult, as negative numbers' },
    { key: 'followUp', label: 'After the consult', help: 'Days after the consult' },
    { key: 'el', label: 'After the engagement letter', help: 'Days after the letter goes out' },
  ];
  const [draft, setDraft] = useState(() => Object.fromEntries(rows.map((r) => [r.key, s.cadences[r.key].join(', ')])) as Record<keyof Cadences, string>);
  const parse = (v: string) => v.split(/[,\s]+/).map((x) => parseInt(x, 10)).filter((n) => !Number.isNaN(n));
  return (
    <section className="panel">
      <div className="panel-head"><h2>Intake follow-up cadences</h2><span className="small muted">Every prospect gets these touches automatically, and they show up in Intake → Due today.</span></div>
      <form
        className="panel-body stack"
        onSubmit={(e) => {
          e.preventDefault();
          const next = Object.fromEntries(rows.map((r) => [r.key, [...new Set(parse(draft[r.key]))].sort((a, b) => a - b)])) as unknown as Cadences;
          actions.setCadences(next);
          setDraft(Object.fromEntries(rows.map((r) => [r.key, next[r.key].join(', ')])) as Record<keyof Cadences, string>);
          notify('Cadences saved. Every open prospect’s schedule updated.');
        }}
      >
        {rows.map((r) => (
          <div key={r.key} className="field">
            <label htmlFor={`cad-${r.key}`}>{r.label} <span className="muted">· {r.help}</span></label>
            <input className="input num" id={`cad-${r.key}`} value={draft[r.key]} onChange={(e) => setDraft((d) => ({ ...d, [r.key]: e.target.value }))} />
          </div>
        ))}
        <div><button className="btn primary" type="submit">Save cadences</button></div>
      </form>
    </section>
  );
}

function RolesEditor() {
  const { s, actions } = useStore();
  const used = (id: string) => s.matters.some((m) => m.parties.some((p) => p.role === id)) || s.pncs.some((p) => p.parties.some((x) => x.role === id));
  const set = (roles: Role[]) => actions.setRoles(roles);
  return (
    <section className="panel" style={{ maxWidth: 760 }}>
      <div className="panel-head"><h2>Contact roles</h2><span className="small muted">The side decides how conflict checks treat a match.</span></div>
      <ul className="list">
        {s.roles.map((r, i) => (
          <li key={r.id} className="spread">
            <input className="input small" style={{ flex: 1 }} id={`role-name-${r.id}`} aria-label="Role name" value={r.name} onChange={(e) => set(s.roles.map((x) => (x.id === r.id ? { ...x, name: e.target.value } : x)))} />
            <select className="input small tight" id={`role-side-${r.id}`} aria-label="Side" value={r.side} onChange={(e) => set(s.roles.map((x) => (x.id === r.id ? { ...x, side: e.target.value as RoleSide } : x)))}>
              <option value="client">Our side</option>
              <option value="adverse">Other side (adverse)</option>
              <option value="neutral">Neutral</option>
            </select>
            <button className="btn sm ghost icon" aria-label="Move up" disabled={i === 0} onClick={() => set(move(s.roles, i, -1))}>↑</button>
            <button className="btn sm ghost icon" aria-label="Move down" disabled={i === s.roles.length - 1} onClick={() => set(move(s.roles, i, 1))}>↓</button>
            <button className="btn sm ghost icon danger" aria-label={`Delete ${r.name}`} disabled={used(r.id)} title={used(r.id) ? 'In use on a matter' : 'Delete role'} onClick={() => set(s.roles.filter((x) => x.id !== r.id))}>×</button>
          </li>
        ))}
      </ul>
      <div className="panel-body"><AddRow id="add-role" placeholder="New role, e.g. Guardian ad Litem" onAdd={(name) => set([...s.roles, { id: newId('role'), name, side: 'neutral' }])} /></div>
    </section>
  );
}

function NumberingEditor() {
  const { s, actions, notify } = useStore();
  const n = s.numbering;
  const set = (patch: Partial<typeof n>) => actions.setNumbering({ ...n, ...patch });
  const scopeLabel = { firm: 'one running sequence for the whole firm', year: 'restarts every January', area: 'separate sequence per practice area', 'area-year': 'per practice area, restarting every January' }[n.scope];
  return (
    <div className="grid cols-main">
      <section className="panel">
        <div className="panel-head"><h2>Matter number format</h2><span className="small muted">Applies to new Client matters. Existing numbers never change.</span></div>
        <div className="panel-body stack" style={{ gap: 12 }}>
          <div className="field">
            <label htmlFor="num-format">Format</label>
            <input className="input num" id="num-format" value={n.format} onChange={(e) => set({ format: e.target.value })} />
            <span className="small muted">Building blocks: <code>{'{YYYY}'}</code> year · <code>{'{YY}'}</code> 2-digit year · <code>{'{AREA}'}</code> practice-area code · <code>{'{CLIENT}'}</code> client’s last name · <code>{'{SEQ}'}</code> the running number</span>
          </div>
          <div className="row">
            {['{YYYY}-{SEQ}', '{AREA}-{YY}-{SEQ}', '{YY}{AREA}{SEQ}', '{CLIENT}-{SEQ}'].map((f) => (
              <button key={f} className="btn sm" aria-pressed={n.format === f} onClick={() => set({ format: f })}>{f}</button>
            ))}
          </div>
          <div className="grid cols-2" style={{ gap: 10 }}>
            <div className="field">
              <label htmlFor="num-scope">Numbering sequence</label>
              <select className="input" id="num-scope" value={n.scope} onChange={(e) => set({ scope: e.target.value as typeof n.scope })}>
                <option value="year">Restart every year</option>
                <option value="firm">Never restart (firm-wide)</option>
                <option value="area">Separate per practice area</option>
                <option value="area-year">Per practice area, restart yearly</option>
              </select>
              <span className="small muted">{scopeLabel}</span>
            </div>
            <div className="field">
              <label htmlFor="num-digits">Digits in the running number</label>
              <select className="input" id="num-digits" value={n.digits} onChange={(e) => set({ digits: Number(e.target.value) })}>
                {[2, 3, 4, 5].map((d) => <option key={d} value={d}>{d} ({String(7).padStart(d, '0')})</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="num-start">Start the sequence at</label>
              <input className="input num" type="number" min={1} id="num-start" value={n.start} onChange={(e) => set({ start: Math.max(1, Number(e.target.value) || 1) })} />
            </div>
          </div>
          <div><button className="btn sm ghost" onClick={() => { set({ counters: {} }); notify('Sequence counters reset'); }}>Reset sequence counters</button></div>
        </div>
      </section>
      <section className="panel">
        <div className="panel-head"><h2>Preview</h2></div>
        <ul className="list">
          {s.areas.map((a) => (
            <li key={a.id} className="spread">
              <span>{a.name} <span className="small muted">code</span>{' '}
                <input className="input small tight num" style={{ width: 60 }} id={`code-${a.id}`} aria-label={`${a.name} code`} value={a.code ?? ''} onChange={(e) => actions.saveArea({ ...a, code: e.target.value.toUpperCase().slice(0, 6) })} />
              </span>
              <strong className="num">{renderNumber(n, n.start, a, 'Whitford')}</strong>
            </li>
          ))}
        </ul>
        <p className="panel-body small muted">Preview uses a client named Whitford. Any matter’s number can still be edited by hand on the matter page.</p>
      </section>
    </div>
  );
}

function UsersEditor() {
  const { s, actions, notify, access } = useStore();
  const setRole = (r: PermRole) => actions.setPermRoles(s.permRoles.map((x) => (x.id === r.id ? r : x)));
  const setUser = (u: UserAccess) => actions.setUsers(s.users.map((x) => (x.userId === u.userId ? u : x)));
  return (
    <div className="stack" style={{ gap: 16 }}>
      <section className="panel">
        <div className="panel-head"><h2>People</h2><span className="small muted">Each person gets a role and the practice areas whose Client matters they can see.</span></div>
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Person</th><th>Role</th><th>Practice areas</th><th /></tr></thead>
            <tbody>
              {TEAM.map((t) => {
                const u = s.users.find((x) => x.userId === t.id) ?? { userId: t.id, roleId: 'paralegal', areas: 'all' as const };
                return (
                  <tr key={t.id}>
                    <td style={{ whiteSpace: 'nowrap' }}><strong style={{ fontWeight: 500 }}>{t.id === 'me' ? 'You' : t.name}</strong><div className="small muted">{t.role}</div></td>
                    <td>
                      <select className="input small tight" id={`u-role-${t.id}`} aria-label={`Role for ${t.name}`} value={u.roleId} disabled={t.id === access.user} onChange={(e) => setUser({ ...u, roleId: e.target.value })}>
                        {s.permRoles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    </td>
                    <td>
                      <div className="row" style={{ gap: 8 }}>
                        <label className="row small" style={{ gap: 4 }}>
                          <input type="checkbox" id={`u-all-${t.id}`} checked={u.areas === 'all'} onChange={(e) => setUser({ ...u, areas: e.target.checked ? 'all' : [] })} /> All
                        </label>
                        {u.areas !== 'all' && s.areas.map((a) => (
                          <label key={a.id} className="row small" style={{ gap: 4 }}>
                            <input
                              type="checkbox"
                              id={`u-${t.id}-${a.id}`}
                              checked={(u.areas as string[]).includes(a.id)}
                              onChange={(e) => setUser({ ...u, areas: e.target.checked ? [...(u.areas as string[]), a.id] : (u.areas as string[]).filter((x) => x !== a.id) })}
                            />
                            {a.name}
                          </label>
                        ))}
                      </div>
                    </td>
                    <td className="r">{t.id !== access.user && <button className="btn sm ghost" onClick={() => { actions.setViewAs(t.id); notify(`Now previewing ${t.name}’s view`); }}>View as</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><h2>Roles</h2><span className="small muted">Tick what each role can do. Changes apply to everyone with that role.</span></div>
        <div className="table-wrap">
          <table className="t perm-grid">
            <thead>
              <tr>
                <th>Permission</th>
                {s.permRoles.map((r) => (
                  <th key={r.id} style={{ minWidth: 110 }}>
                    <input className="input small tight" style={{ textAlign: 'center', fontWeight: 600 }} id={`r-name-${r.id}`} aria-label="Role name" value={r.name} onChange={(e) => setRole({ ...r, name: e.target.value })} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMS.map((p) => (
                <tr key={p.id}>
                  <td style={{ minWidth: 220 }}><strong style={{ fontWeight: 500 }}>{p.label}</strong><div className="small muted">{p.help}</div></td>
                  {s.permRoles.map((r) => (
                    <td key={r.id}>
                      <input
                        type="checkbox"
                        id={`perm-${r.id}-${p.id}`}
                        aria-label={`${r.name}: ${p.label}`}
                        checked={r.perms[p.id]}
                        disabled={r.id === 'managing' && (p.id === 'users' || p.id === 'settings')}
                        onChange={(e) => setRole({ ...r, perms: { ...r.perms, [p.id as Perm]: e.target.checked } })}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="panel-body"><AddRow id="add-perm-role" placeholder="New role, e.g. Of Counsel" onAdd={(name) => actions.setPermRoles([...s.permRoles, { id: newId('pr'), name, perms: Object.fromEntries(PERMS.map((p) => [p.id, false])) as Record<Perm, boolean> }])} /></div>
      </section>
      <p className="small muted">Individual matters can also be locked to named people (an ethical wall) from the matter’s Access panel.</p>
    </div>
  );
}

export default function Settings() {
  const { s, actions, notify } = useStore();
  const { access } = useStore();
  const [section, setSection] = useState<Section>(access.can('settings') ? 'areas' : 'users');
  const [areaId, setAreaId] = useState(s.areas[0]?.id);
  const area = s.areas.find((a) => a.id === areaId) ?? s.areas[0];

  return (
    <>
      <PageHead title="Settings" sub="Your firm’s rules. Change them here and every matter, board and deadline follows. Settings are saved in this browser for the prototype." />
      <div className="tabs" role="tablist">
        {([['users', 'Users & permissions'], ['numbering', 'Matter numbering'], ['trust', 'Trust accounting'], ['areas', 'Practice areas'], ['roles', 'Contact roles'], ['intake', 'Intake cadences'], ['billing', 'Billing'], ['integrations', 'Integrations']] as [Section, string][]).filter(([k]) => (k === 'users' ? access.can('users') : k === 'trust' ? access.can('settings') && access.can('payments') : access.can('settings'))).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={section === k} onClick={() => setSection(k)}>{l}</button>
        ))}
      </div>

      {section === 'areas' && (
        <div className="grid settings-grid">
          <nav className="panel" aria-label="Practice areas">
            <ul className="list">
              {s.areas.map((a) => (
                <li key={a.id} style={{ padding: 0 }}>
                  <button className={`area-link ${a.id === area?.id ? 'on' : ''}`} onClick={() => setAreaId(a.id)}>
                    <span>{a.name}</span>
                    <span className="num small muted">{s.matters.filter((m) => m.areaId === a.id).length}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="panel-body stack" style={{ gap: 8, borderTop: '1px solid var(--line)' }}>
              <AddRow id="add-area" placeholder="New practice area" onAdd={(name) => { const id = actions.addArea(name); setAreaId(id); notify(`${name} added with starter stages. Edit them on the right.`); }} />
              <button className="btn sm ghost" onClick={() => { actions.resetAreas(); setAreaId('ep'); notify('Practice areas reset to the firm defaults'); }}>Reset to defaults</button>
            </div>
          </nav>
          {area ? <AreaEditor key={area.id} area={area} /> : <p className="muted">Add a practice area to start.</p>}
        </div>
      )}

      {section === 'users' && access.can('users') && <UsersEditor />}
      {section === 'numbering' && <NumberingEditor />}
      {section === 'trust' && (
        <div className="grid cols-2">
          <section className="panel">
            <div className="panel-head"><h2>Accounts</h2></div>
            <ul className="list">
              <li className="spread"><span><strong>{T.TRUST_ACCOUNT.name}</strong><div className="small muted">IOLTA · client funds only · ••{T.TRUST_ACCOUNT.last4}</div></span><span className="pill info">Read-only feed (planned)</span></li>
              <li className="spread"><span><strong>{T.OPERATING_ACCOUNT.name}</strong><div className="small muted">Earned fees, firm costs, bank and card fees · ••{T.OPERATING_ACCOUNT.last4}</div></span><span className="pill info">Read-only feed (planned)</span></li>
            </ul>
            <p className="panel-body small muted">The software records and approves; money moves at M&T. Initiating transfers from software can be added later with two-person approval, if M&T offers it for these accounts.</p>
          </section>
          <section className="panel">
            <div className="panel-head"><h2>Rules applied (Virginia)</h2></div>
            <ul className="list small">
              <li>Separate ledger for every client; no ledger can go below zero, counting pending outflows.</li>
              <li>Money out of trust requires approval by someone with “Record payments & trust”.</li>
              <li>Fixed-price and advance fees stay in trust until earned (see each practice area’s earning schedule).</li>
              <li>Monthly reconciliation of bank statement, trust journal and client ledgers; quarterly review of every client balance; both approved and signed by a lawyer.</li>
              <li>Cash receipts and disbursements journals kept for every transaction.</li>
              <li>Card processing and bank fees are charged to operating, never to trust.</li>
            </ul>
            <p className="panel-body small muted">Confirm each item against the current text of Virginia Rule 1.15 before relying on it.</p>
          </section>
        </div>
      )}
      {section === 'roles' && <RolesEditor />}
      {section === 'intake' && <CadenceEditor />}

      {section === 'billing' && (
        <section className="panel" style={{ maxWidth: 560 }}>
          <div className="panel-head"><h2>Billing increments</h2></div>
          <div className="panel-body stack">
            <div className="field">
              <label htmlFor="inc">Bill time in increments of</label>
              <select className="input" id="inc" value={s.billing.incrementMinutes} onChange={(e) => actions.setBilling({ incrementMinutes: Number(e.target.value) })}>
                {INCREMENT_OPTIONS.map((n) => <option key={n} value={n}>{n} minutes{n === 6 ? ' (tenth of an hour)' : n === 15 ? ' (quarter hour)' : ''}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="mode">Rounding</label>
              <select className="input" id="mode" value={s.billing.mode} onChange={(e) => actions.setBilling({ mode: e.target.value as RoundingMode })}>
                <option value="up">Always round up</option>
                <option value="nearest">Round to nearest</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="min">Minimum charge per entry</label>
              <select className="input" id="min" value={s.billing.minimumMinutes} onChange={(e) => actions.setBilling({ minimumMinutes: Number(e.target.value) })}>
                {[0, 6, 12, 15].map((n) => <option key={n} value={n}>{n === 0 ? 'None' : `${n} minutes`}</option>)}
              </select>
            </div>
          </div>
        </section>
      )}

      {section === 'integrations' && (
        <section className="panel">
          <ul className="list">
            {INTEGRATIONS.map((i) => (
              <li key={i.name} className="spread" style={{ alignItems: 'flex-start' }}>
                <span><strong>{i.name}</strong><div className="small muted">{i.detail}</div></span>
                <span className="pill info">{i.status}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
