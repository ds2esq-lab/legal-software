import { useState } from 'react';
import { useStore } from '../store';
import { TEAM, type Matter } from '../data';
import { billedMinutes, formatHours, money } from '../billing';
import { entryValue, hourlyRate, nextActions } from '../calc';
import { dueFor, ruleText, todayISO, type PracticeArea } from '../practice';
import { BallSelect, billingLabel, ContactPill, DateField, DuePill, fmtDate, PageHead, Person, StagePill } from '../ui';
import Thread from '../Thread';
import { NotesPanel, PartiesPanel } from '../people';
import { ConflictBadge, ConflictPanel, uncheckedParties } from '../conflictPanel';
import { NewTaskForm, TaskRow } from './Tasks';
import { ExpensesTab, TrustTab } from './MatterMoney';
import { MatterDocs } from './MatterDocs';
import * as T from '../trust';

type Tab = 'timeline' | 'tasks' | 'notes' | 'conflicts' | 'trust' | 'expenses' | 'time' | 'billing' | 'messages' | 'documents';

export function InvoiceList({ m }: { m: Matter }) {
  const { s, actions, notify, access } = useStore();
  const canInv = access.can('invoices');
  const canPay = access.can('payments');
  const [open, setOpen] = useState<string | null>(null);
  const list = s.invoices.filter((i) => i.matterId === m.id);
  const VIA = { portal: 'client portal', email: 'email', mail: 'mail' } as const;
  return (
    <section className="panel">
      <div className="panel-head"><h2>Invoices <span className="num small muted">{list.length}</span></h2></div>
      <ul className="list">
        {list.length === 0 && <li className="muted small">No invoices yet.</li>}
        {list.map((i) => (
          <li key={i.id} className="stack" style={{ display: 'flex', gap: 6 }}>
            <div className="spread" style={{ width: '100%', flexWrap: 'wrap' }}>
              <span className="row" style={{ gap: 8 }}>
                <button className="link num" onClick={() => setOpen(open === i.id ? null : i.id)}>{i.number}</button>
                <span className="small muted num">{fmtDate(i.date)}</span>
                <strong className="num">{money(i.total)}</strong>
                <span className={`pill ${i.status === 'paid' ? 'ok' : i.status === 'sent' ? 'info' : 'warn'}`}>
                  {i.status === 'draft' ? 'Draft · not sent' : i.status === 'sent' ? `Sent by ${VIA[i.sentVia!]} ${fmtDate(i.sentAt!)}` : `Paid ${fmtDate(i.paidAt!)}`}
                </span>
              </span>
              <span className="row" style={{ gap: 4 }}>
                {i.status === 'draft' && canInv && (
                  <>
                    <button className="btn sm primary" onClick={() => { actions.sendInvoice(i.id, 'portal'); notify(`${i.number} posted to the client portal`); }}>Send to portal</button>
                    <button className="btn sm" onClick={() => { actions.sendInvoice(i.id, 'email'); notify(`${i.number} emailed to the client`); }}>Email</button>
                    <button className="btn sm" onClick={() => { actions.sendInvoice(i.id, 'mail'); notify(`${i.number} marked as mailed`); }}>Mark mailed</button>
                    <button className="btn sm ghost danger" onClick={() => { actions.deleteDraftInvoice(i.id); notify('Draft deleted. Its time and fees are unbilled again.'); }}>Delete draft</button>
                  </>
                )}
                {i.status === 'sent' && canInv && i.sentVia !== 'portal' && <button className="btn sm" onClick={() => { actions.sendInvoice(i.id, 'portal'); notify(`${i.number} also posted to the portal`); }}>Also post to portal</button>}
                {i.status === 'sent' && canInv && T.availableOf(m.id, s.trustTxns) >= i.total && !s.trustTxns.some((t) => t.invoiceId === i.id && t.status !== 'rejected') && (
                  <button className="btn sm primary" onClick={() => { const ok = actions.payInvoiceFromTrust(i.id); notify(ok ? `Payment of ${i.number} from trust requested. It needs approval.` : 'Not enough available in trust'); }}>Pay from trust ({money(T.availableOf(m.id, s.trustTxns))})</button>
                )}
                {s.trustTxns.some((t) => t.invoiceId === i.id && t.status === 'pending') && <span className="pill warn">Trust payment awaiting approval</span>}
                {i.status === 'sent' && canPay && <button className="btn sm" onClick={() => { actions.markInvoicePaid(i.id); notify(`${i.number} marked paid`); }}>Record outside payment</button>}
              </span>
            </div>
            {open === i.id && (
              <div className="table-wrap" style={{ width: '100%' }}>
                <table className="t">
                  <thead><tr><th>Date</th><th>Description</th><th className="r">Hours</th><th className="r">Rate</th><th className="r">Amount</th></tr></thead>
                  <tbody>
                    {i.lines.map((l, k) => (
                      <tr key={k}>
                        <td className="num">{l.date ? fmtDate(l.date) : 'Fixed price'}</td>
                        <td>{l.description}</td>
                        <td className="r num">{l.hours !== undefined ? formatHours(l.hours * 60, s.billing) : '—'}</td>
                        <td className="r num">{l.rate ? money(l.rate) : '—'}</td>
                        <td className="r num">{money(l.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function InvoicePreview({ m }: { m: Matter }) {
  const { s, actions, notify, access } = useStore();
  const fees = s.flatFees.filter((f) => f.matterId === m.id && f.status === 'unbilled');
  const entries = s.timeEntries.filter((t) => t.matterId === m.id && !t.invoiced && t.billable);
  const exps = s.expenses.filter((e) => e.matterId === m.id && e.billable && !e.invoiced && e.paidFrom === 'operating');
  const expTotal = exps.reduce((n, e) => n + T.round(e.amount * (1 + e.markupPct / 100)), 0);
  const hourlyApplies = hourlyRate(m) > 0;
  const hourlyTotal = hourlyApplies ? entries.reduce((n, t) => n + entryValue(t, m, s.billing), 0) : 0;
  const total = fees.reduce((n, f) => n + f.amount, 0) + hourlyTotal + expTotal;

  return (
    <div className="stack">
      <div className="table-wrap">
        <table className="t">
          <thead>
            <tr><th>Date</th><th>Description</th><th className="r">Hours</th><th className="r">Rate</th><th className="r">Amount</th></tr>
          </thead>
          <tbody>
            {fees.map((f) => (
              <tr key={f.id}><td className="muted">Fixed price</td><td>{f.description}</td><td className="r muted">—</td><td className="r muted">—</td><td className="r num">{money(f.amount)}</td></tr>
            ))}
            {hourlyApplies &&
              entries.map((t) => (
                <tr key={t.id}>
                  <td className="num">{fmtDate(t.date)}</td>
                  <td>{t.description}</td>
                  <td className="r num">{formatHours(billedMinutes(t.actualMinutes, s.billing), s.billing)}</td>
                  <td className="r num">{money(hourlyRate(m))}</td>
                  <td className="r num">{money(entryValue(t, m, s.billing))}</td>
                </tr>
              ))}
            {exps.map((e) => (
              <tr key={e.id}><td className="num">{fmtDate(e.date)}</td><td>Expense: {e.description}</td><td className="r muted">—</td><td className="r muted">—</td><td className="r num">{money(T.round(e.amount * (1 + e.markupPct / 100)))}</td></tr>
            ))}
            {!fees.length && !exps.length && (!hourlyApplies || !entries.length) && <tr><td colSpan={5} className="muted">Nothing unbilled on this matter.</td></tr>}
          </tbody>
        </table>
      </div>
      {!hourlyApplies && entries.length > 0 && (
        <p className="small muted">{entries.length} time {entries.length === 1 ? 'entry is' : 'entries are'} tracked on this fixed-price matter for profitability only. They won’t appear on the invoice.</p>
      )}
      <div className="spread" style={{ flexWrap: 'wrap' }}>
        <span><span className="label">Invoice total</span> <span className="num" style={{ fontSize: 20, marginLeft: 8 }}>{money(total)}</span></span>
        {access.can('invoices') ? <span className="row" style={{ gap: 6 }}>
          <button className="btn primary" disabled={total === 0} onClick={() => { actions.createInvoice(m.id); notify(`Draft invoice for ${money(total)} created. Nothing has been sent.`); }}>
            Create invoice
          </button>
          <button className="btn" disabled={total === 0} onClick={() => { actions.createInvoice(m.id, 'portal'); notify(`Invoice for ${money(total)} created and posted to the client portal`); }}>
            Create & send to portal
          </button>
        </span> : <span className="small muted">Your role can see billing but not create invoices.</span>}
      </div>
    </div>
  );
}

function Timeline({ m, area }: { m: Matter; area: PracticeArea }) {
  const { actions, notify } = useStore();
  const today = todayISO();
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Milestones</h2>
        <span className="small muted">Due dates come from the {area.name} rules in Settings. Type a date to override it for this matter only.</span>
      </div>
      <div className="table-wrap">
        <table className="t">
          <thead>
            <tr><th>Milestone</th><th>Completed</th><th>Due</th><th>Status</th></tr>
          </thead>
          <tbody>
            {area.milestones.map((ms) => {
              const st = m.milestones[ms.id] ?? {};
              const due = dueFor(ms, m.milestones);
              const late = !st.done && due.date && due.date < today;
              const waitingOn = due.waitingOn ? area.milestones.find((x) => x.id === due.waitingOn)?.name : undefined;
              return (
                <tr key={ms.id}>
                  <td style={{ minWidth: 170 }}>
                    <strong style={{ fontWeight: 500 }}>{ms.name}</strong>
                    {ms.rule && <div className="small muted">Rule: {ruleText(ms.rule, area)}</div>}
                  </td>
                  <td>
                    <div className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                      <DateField id={`done-${ms.id}`} label={`${ms.name} completed`} value={st.done} onChange={(v) => actions.setMilestone(m.id, ms.id, { done: v })} />
                      {!st.done && (
                        <button className="btn sm" onClick={() => { actions.setMilestone(m.id, ms.id, { done: today }); notify(`${ms.name} marked done today`); }}>Today</button>
                      )}
                    </div>
                  </td>
                  <td>
                    {st.done ? (
                      <span className="muted small">—</span>
                    ) : (
                      <div className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                        <input
                          className={`input small tight num ${due.source === 'manual' ? 'manual' : ''}`}
                          type="date"
                          id={`due-${ms.id}`}
                          aria-label={`${ms.name} due date`}
                          value={due.date ?? ''}
                          onChange={(e) => actions.setMilestone(m.id, ms.id, { due: e.target.value || undefined })}
                        />
                        {due.source === 'manual' && (
                          <button className="btn sm ghost" title={ms.rule ? 'Go back to the automatic due date' : 'Remove the due date'} onClick={() => actions.setMilestone(m.id, ms.id, { due: undefined })}>
                            {ms.rule ? 'Use rule' : 'Clear'}
                          </button>
                        )}
                      </div>
                    )}
                    {!st.done && due.source === 'manual' && <div className="small muted">Set by hand</div>}
                    {!st.done && waitingOn && !due.date && <div className="small muted">Starts when {waitingOn} is done</div>}
                  </td>
                  <td>
                    {st.done ? <span className="pill ok">Done {fmtDate(st.done)}</span> : late ? <span className="pill danger">Late</span> : due.date ? <DuePill iso={due.date} /> : <span className="pill">Open</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Closeout({ m }: { m: Matter }) {
  const { actions, notify, go } = useStore();
  const c = m.closeout ?? { financials: false };
  const set = (patch: Partial<NonNullable<Matter['closeout']>>) => actions.updateMatter(m.id, { closeout: { ...c, ...patch } });
  const done = c.financials && !!c.letterSent && (c.review === 'Hell No' || !!c.reviewRequested);
  return (
    <section className="panel" style={{ borderColor: 'var(--accent)' }}>
      <div className="panel-head">
        <h2>Closeout checklist</h2>
        <span className="row" style={{ gap: 6 }}>
          {done ? <span className="pill ok">Complete</span> : <span className="pill warn">In progress</span>}
          {m.status === 'open' && (
            <button
              className="btn sm primary"
              disabled={!done}
              title={done ? 'Move to Former clients' : 'Finish the checklist first'}
              onClick={() => { actions.closeMatter(m.id); notify(`${m.name} closed. It’s now under Client matters → Former clients.`); go('matters'); }}
            >
              Close matter
            </button>
          )}
        </span>
      </div>
      <ul className="list">
        <li className="spread">
          <label className="row"><input type="checkbox" id="co-fin" checked={c.financials} onChange={(e) => set({ financials: e.target.checked })} /> Financials closed (trust balance zero, final invoice paid)</label>
        </li>
        <li className="spread">
          <span>Closeout letter sent</span>
          <DateField id="co-letter" label="Closeout letter sent" value={c.letterSent} onChange={(v) => set({ letterSent: v })} />
        </li>
        <li className="spread" style={{ flexWrap: 'wrap' }}>
          <span>Ask for a review?</span>
          <div className="seg" role="group" aria-label="Review request">
            {(['Definitely', 'Ask First', 'Hell No'] as const).map((r) => (
              <button key={r} aria-pressed={c.review === r} onClick={() => set({ review: r })}>{r}</button>
            ))}
          </div>
        </li>
        {c.review && c.review !== 'Hell No' && (
          <li className="spread">
            <span>{c.review === 'Ask First' ? 'Checked with the attorney, then requested' : 'Review requested'}</span>
            <div className="row" style={{ gap: 4 }}>
              <DateField id="co-review" label="Review requested" value={c.reviewRequested} onChange={(v) => set({ reviewRequested: v })} />
              {!c.reviewRequested && <button className="btn sm" onClick={() => { set({ reviewRequested: todayISO() }); notify('Review request sent with your Google review link'); }}>Send request</button>}
            </div>
          </li>
        )}
      </ul>
    </section>
  );
}

function TimeTab({ m }: { m: Matter }) {
  const { s, actions, notify } = useStore();
  const [mins, setMins] = useState('7');
  const [desc, setDesc] = useState('');
  const entries = s.timeEntries.filter((t) => t.matterId === m.id);
  const n = Math.max(0, parseInt(mins, 10) || 0);
  const billed = billedMinutes(n, s.billing);

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="panel">
        <div className="panel-head">
          <h2>Add time</h2>
          <button className="btn sm" onClick={() => actions.startTimer(m.id, '')}>Start timer on this matter</button>
        </div>
        <div className="panel-body row" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ width: 110 }}>
            <label htmlFor="mins">Minutes worked</label>
            <input className="input num" id="mins" type="number" min={0} value={mins} onChange={(e) => setMins(e.target.value)} />
          </div>
          <div className="field" style={{ flex: '1 1 240px' }}>
            <label htmlFor="desc">Description (appears on invoice)</label>
            <input className="input" id="desc" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. Review and revise trust agreement" />
          </div>
          <button
            className="btn primary"
            disabled={n === 0}
            onClick={() => {
              actions.addTimeEntry({ matterId: m.id, date: todayISO(), actualMinutes: n, description: desc || 'Untitled work', user: 'me', billable: true, invoiced: false, source: 'manual' });
              setDesc('');
              notify(`Saved: ${n} min worked → ${formatHours(billed, s.billing)} hr billed`);
            }}
          >
            Save entry
          </button>
        </div>
        <div className="panel-body small" style={{ paddingTop: 0 }}>
          <span className="muted">Rounding: </span>
          <span className="num">{n} min</span> → <strong className="num">{formatHours(billed, s.billing)} hr</strong>
          <span className="muted"> ({s.billing.mode === 'up' ? 'round up' : 'round to nearest'} to {s.billing.incrementMinutes}-minute increments)</span>
        </div>
      </div>
      <div className="panel table-wrap">
        <table className="t">
          <thead>
            <tr><th>Date</th><th>Who</th><th>Description</th><th className="r">Actual</th><th className="r">Billed</th><th>Billable</th><th>Status</th></tr>
          </thead>
          <tbody>
            {entries.length === 0 && <tr><td colSpan={7} className="muted">No time yet.</td></tr>}
            {entries.map((t) => (
              <tr key={t.id}>
                <td className="num">{fmtDate(t.date)}</td>
                <td><Person id={t.user} /></td>
                <td style={{ minWidth: 220 }}>{t.description}</td>
                <td className="r num muted">{t.actualMinutes}m</td>
                <td className="r num">{formatHours(billedMinutes(t.actualMinutes, s.billing), s.billing)}</td>
                <td><input type="checkbox" id={`bill-${t.id}`} aria-label="Billable" checked={t.billable} disabled={t.invoiced} onChange={() => actions.toggleBillable(t.id)} /></td>
                <td>{t.invoiced ? <span className="pill ok">Invoiced</span> : <span className="pill">Unbilled</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AccessPanel({ m }: { m: Matter }) {
  const { s, actions, access, notify } = useStore();
  const walled = !!m.restrictedTo?.length;
  const whoCan = TEAM.filter((t) => {
    const u = s.users.find((x) => x.userId === t.id);
    const role = s.permRoles.find((r) => r.id === u?.roleId);
    if (!u || !role) return false;
    if (walled) return m.restrictedTo!.includes(t.id);
    return (role.perms.matters && (u.areas === 'all' || u.areas.includes(m.areaId))) || role.perms.billingView;
  });
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Access</h2>
        {walled ? <span className="pill danger">🔒 Restricted</span> : <span className="pill">Normal</span>}
      </div>
      <div className="panel-body stack" style={{ gap: 8 }}>
        <span className="small">Can see this matter: {whoCan.map((t) => (t.id === 'me' ? 'You' : t.name)).join(', ') || 'no one'}</span>
        {access.can('users') ? (
          <>
            <label className="row small" style={{ gap: 6 }}>
              <input type="checkbox" id="wall" checked={walled} onChange={(e) => { actions.setRestricted(m.id, e.target.checked ? [access.user] : undefined); notify(e.target.checked ? 'Ethical wall on. Only the people checked below can see this matter.' : 'Wall removed. Normal access rules apply.'); }} />
              Restrict to specific people (ethical wall)
            </label>
            {walled && (
              <div className="row" style={{ gap: 10 }}>
                {TEAM.map((t) => (
                  <label key={t.id} className="row small" style={{ gap: 4 }}>
                    <input
                      type="checkbox"
                      id={`wall-${t.id}`}
                      checked={m.restrictedTo!.includes(t.id)}
                      disabled={t.id === access.user}
                      onChange={(e) => actions.setRestricted(m.id, e.target.checked ? [...m.restrictedTo!, t.id] : m.restrictedTo!.filter((x) => x !== t.id))}
                    />
                    {t.id === 'me' ? 'You' : t.name}
                  </label>
                ))}
              </div>
            )}
            {walled && <span className="small muted">Conflict checks still search this matter but show it only as “Restricted matter”.</span>}
          </>
        ) : (
          <span className="small muted">Only someone with “Users & permissions” can change access.</span>
        )}
      </div>
    </section>
  );
}

export default function MatterDetail() {
  const { s, matterId, lookup, go, actions, notify, openTask, access } = useStore();
  const [tab, setTab] = useState<Tab>('timeline');
  const m = lookup.matter(matterId);
  if (!m) return <p>Matter not found.</p>;
  if (!access.canSee(m))
    return (
      <div className="panel panel-body stack" style={{ maxWidth: 560 }}>
        <h2>{access.walledOff(m) ? '🔒 Restricted matter' : 'No access'}</h2>
        <p className="muted">{access.walledOff(m) ? 'This matter is behind an ethical wall. Only the people it’s restricted to can open it.' : 'This matter is in a practice area your role can’t see.'}</p>
        <div><button className="btn" onClick={() => go('matters')}>Back to Client matters</button></div>
      </div>
    );
  const area = lookup.areaOf(m);
  const client = lookup.clientOf(m);
  const stageIdx = area.stages.findIndex((x) => x.id === m.stageId);
  const closing = stageIdx >= area.stages.length - 2;
  const upcoming = [...nextActions(m, area), ...s.tasks.filter((t) => t.matterId === m.id && !t.done).map((t) => ({ date: t.due.slice(0, 10), what: t.title, kind: 'task' as const, taskId: t.id }))].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
  const up = (patch: Partial<Matter>) => actions.updateMatter(m.id, patch);
  const openTasks = s.tasks.filter((t) => t.matterId === m.id && !t.done).sort((a, b) => a.due.localeCompare(b.due));
  const doneTasks = s.tasks.filter((t) => t.matterId === m.id && t.done);
  const moveTo = (stageId: string) => {
    const created = area.stageTasks.filter((t) => t.stageId === stageId).length;
    actions.moveStage(m.id, stageId);
    notify(`Moved to ${area.stages.find((x) => x.id === stageId)?.name}.${created ? ` ${created} task${created === 1 ? '' : 's'} created.` : ''}`);
  };

  return (
    <>
      <div className="small"><button className="link" onClick={() => go('matters')}>← Matters</button></div>
      <PageHead title={m.name} sub={`${client?.name} · ${area.name}${m.planType ? ` · ${m.planType}` : ''} · Matter ${m.number}`}>
        <StagePill m={m} />
        <button className="badge-btn" onClick={() => setTab('conflicts')} title="Open the conflict check"><ConflictBadge checks={m.conflicts} parties={m.parties} /></button>
        {m.stalled && <span className="pill warn">Stalled</span>}
        <button className="btn" onClick={() => go('portal', m.id)}>View client portal</button>
      </PageHead>

      <div className="stack" style={{ gap: 6 }}>
        <div className="stages" style={{ gridTemplateColumns: `repeat(${area.stages.length}, minmax(0, 1fr))` }} aria-label={`Stage ${stageIdx + 1} of ${area.stages.length}`}>
          {area.stages.map((x, i) => (
            <button key={x.id} className={i <= stageIdx ? 'on' : ''} title={`Move to ${x.name}`} aria-label={`Move to ${x.name}`} onClick={() => moveTo(x.id)} />
          ))}
        </div>
        <div className="small muted">{area.stages.map((x, i) => (i === stageIdx ? `▸ ${x.name}` : x.name)).join('  ·  ')}</div>
      </div>

      <div className="grid cols-main">
        <section className="panel">
          <div className="panel-head"><h2>Working this matter</h2></div>
          <div className="panel-body grid cols-2" style={{ gap: 12 }}>
            <div className="field">
              <label htmlFor="d-stage">Stage</label>
              <select className="input" id="d-stage" value={m.stageId} onChange={(e) => moveTo(e.target.value)}>
                {area.stages.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="d-ball">Whose Ball</label>
              <BallSelect id="d-ball" value={m.ball} onChange={(v) => up({ ball: v })} />
            </div>
            <div className="field">
              <label htmlFor="d-plan">{area.planLabel}</label>
              <select className="input" id="d-plan" value={m.planType ?? ''} onChange={(e) => up({ planType: e.target.value || undefined })}>
                <option value="">Not set</option>
                {area.planTypes.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="d-owner">Responsible attorney</label>
              <select className="input" id="d-owner" value={m.owner} onChange={(e) => up({ owner: e.target.value })}>
                {TEAM.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="d-lcd">Last client contact</label>
              <div className="row" style={{ gap: 6 }}>
                <DateField id="d-lcd" label="Last client contact" value={m.lastContact} onChange={(v) => up({ lastContact: v })} />
                <button className="btn sm" onClick={() => { actions.logContact(m.id); notify('Contact logged today'); }}>Today</button>
              </div>
              <div><ContactPill m={m} /></div>
            </div>
            <div className="field">
              <label htmlFor="d-susp">Suspense date</label>
              <DateField id="d-susp" label="Suspense date" value={m.suspense} onChange={(v) => up({ suspense: v })} />
              <input className="input small" id="d-susp-note" aria-label="Suspense note" placeholder="What’s the suspense for?" value={m.suspenseNote ?? ''} onChange={(e) => up({ suspenseNote: e.target.value || undefined })} />
            </div>
            <div className="field">
              <label htmlFor="d-orig">Originating attorney</label>
              <select className="input" id="d-orig" value={m.originator} onChange={(e) => up({ originator: e.target.value })} disabled={!access.can('reports')} title={access.can('reports') ? '' : 'Only someone with Firm performance can change credit'}>
                {TEAM.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="d-number">Matter number</label>
              <input className="input num" id="d-number" value={m.number} onChange={(e) => up({ number: e.target.value })} />
            </div>
            <label className="row small"><input type="checkbox" id="d-stalled" checked={m.stalled} onChange={(e) => up({ stalled: e.target.checked })} /> Stalled</label>
            <label className="row small"><input type="checkbox" id="d-prio" checked={m.priority} onChange={(e) => up({ priority: e.target.checked })} /> Priority</label>
          </div>
        </section>

        <div className="stack" style={{ gap: 16 }}>
          <section className="panel">
            <div className="panel-head"><h2>Coming up</h2></div>
            <ul className="list">
              {upcoming.length === 0 && <li className="muted">Nothing dated. Set a suspense date so this doesn’t go quiet.</li>}
              {upcoming.map((a, i) => (
                <li key={i} className="spread">
                  <span>{'taskId' in a ? <button className="link" onClick={() => openTask(a.taskId)}>{a.what}</button> : a.what}<div className="small muted">{a.kind === 'suspense' ? 'Suspense' : a.kind === 'milestone' ? 'Milestone' : a.kind === 'task' ? 'Task' : `Contact timer (${area.cadence.soon} days)`}</div></span>
                  <DuePill iso={a.date} />
                </li>
              ))}
            </ul>
          </section>
          {m.notes.some((n) => n.pinned) && (
            <section className="panel pinned-notes">
              <div className="panel-head"><h2>Pinned notes</h2><button className="btn sm ghost" onClick={() => setTab('notes')}>All notes →</button></div>
              <ul className="list">
                {m.notes.filter((n) => n.pinned).map((n) => <li key={n.id} className="small" style={{ display: 'block' }}>{n.text}</li>)}
              </ul>
            </section>
          )}
          <PartiesPanel target={{ kind: 'matter', id: m.id }} parties={m.parties} />
          <AccessPanel m={m} />
        </div>
      </div>

      {m.status === 'closed' && (
        <div className="banner warn row" style={{ justifyContent: 'space-between' }}>
          <span>Former client matter · closed {m.closedOn ? `${fmtDate(m.closedOn)}, ${m.closedOn.slice(0, 4)}` : ''}. It stays searchable in Contacts and conflict checks.</span>
          <button className="btn sm" onClick={() => { actions.reopenMatter(m.id); notify('Matter reopened'); }}>Reopen</button>
        </div>
      )}
      {m.pncId && (
        <div className="small muted">Came from PNC matter <button className="link" onClick={() => go('pnc', m.pncId)}>{lookup.pnc(m.pncId)?.title}</button></div>
      )}
      {(closing || m.status === 'closed') && <Closeout m={m} />}

      <div className="tabs" role="tablist">
        {(['timeline', 'tasks', 'notes', 'conflicts', 'time', 'expenses', 'billing', 'trust', 'messages', 'documents'] as Tab[]).filter((t) => (t !== 'time' || access.can('time')) && (t !== 'billing' || access.can('billingView')) && (t !== 'trust' || access.can('billingView')) && (t !== 'expenses' || access.can('time') || access.can('billingView'))).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
            {t === 'documents' && s.docFiles.some((d) => d.matterId === m.id) && <span className="num muted"> {s.docFiles.filter((d) => d.matterId === m.id).length}</span>}
            {t === 'trust' && T.balanceOf(m.id, s.trustTxns) > 0 && <span className="num muted"> {money(T.balanceOf(m.id, s.trustTxns))}</span>}
            {t === 'tasks' && openTasks.length > 0 && <span className="num muted"> {openTasks.length}</span>}
            {t === 'notes' && m.notes.length > 0 && <span className="num muted"> {m.notes.length}</span>}
            {t === 'conflicts' && (m.conflicts.length === 0 || uncheckedParties(m.conflicts, m.parties).length > 0) && <span className="dot-warn" aria-label="needs attention" />}
          </button>
        ))}
      </div>

      {tab === 'timeline' && <Timeline m={m} area={area} />}
      {tab === 'conflicts' && <ConflictPanel target={{ kind: 'matter', id: m.id }} parties={m.parties} checks={m.conflicts} />}
      {tab === 'tasks' && (
        <section className="panel">
          <div className="panel-head"><h2>Tasks</h2><span className="small muted">{openTasks.length} open · stage tasks are created automatically (Settings → Practice areas)</span></div>
          <div>{[...openTasks, ...doneTasks].map((t) => <TaskRow key={t.id} t={t} showMatter={false} />)}</div>
          {openTasks.length + doneTasks.length === 0 && <p className="panel-body muted">No tasks yet.</p>}
          <div style={{ borderTop: '1px solid var(--line)' }}><NewTaskForm matterId={m.id} /></div>
        </section>
      )}
      {tab === 'trust' && <TrustTab m={m} />}
      {tab === 'expenses' && <ExpensesTab m={m} />}
      {tab === 'notes' && <NotesPanel target={{ kind: 'matter', id: m.id }} notes={m.notes} />}
      {tab === 'time' && <TimeTab m={m} />}
      {tab === 'billing' && (
        <section className="panel">
          <div className="panel-head"><h2>Unbilled work</h2><span className="small muted">{billingLabel(m.billing)}</span></div>
          <div className="panel-body"><InvoicePreview m={m} /></div>
        </section>
      )}
      {tab === 'billing' && (
        <InvoiceList m={m} />
      )}
      {tab === 'messages' && <section className="panel"><Thread channel={m.id} allowClient clientName={client?.name} /></section>}
      {tab === 'documents' && <MatterDocs m={m} />}
      <p className="small muted">{s.timeEntries.filter((t) => t.matterId === m.id).length} time entries · opened {fmtDate(m.opened)}</p>
    </>
  );
}
