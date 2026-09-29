import type { ReactNode } from 'react';
import type { BillingArrangement, Matter } from './data';
import { OUTSIDE_BALLS, TEAM, teamInitials, teamName, isOutside } from './data';
import { money } from './billing';
import { useStore } from './store';
import { CONTACT_LABEL, contactState, daysBetween, parseDate, todayISO } from './practice';

export function startOfToday() {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

const asDate = (iso: string) => (iso.length === 10 ? parseDate(iso) : new Date(iso));

export function fmtDate(iso: string) {
  return asDate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function daysFromToday(iso: string) {
  const d = asDate(iso);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - startOfToday().getTime()) / 86400000);
}

export function relDay(iso: string) {
  const n = daysFromToday(iso);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  if (n < 0) return `${-n}d ago`;
  if (n < 7) return asDate(iso).toLocaleDateString('en-US', { weekday: 'short' });
  return fmtDate(iso);
}

/** A date with urgency color: red when late or due within a day, amber within 3 days. */
export function DuePill({ iso, prefix = '' }: { iso?: string; prefix?: string }) {
  if (!iso) return <span className="pill">None</span>;
  const n = daysFromToday(iso);
  const cls = n <= 0 ? 'danger' : n <= 3 ? 'warn' : '';
  return (
    <span className={`pill ${cls}`} title={fmtDate(iso)}>
      {prefix}
      {n < 0 ? `${-n}d late` : relDay(iso)}
    </span>
  );
}

export function ContactPill({ m }: { m: Matter }) {
  const { lookup } = useStore();
  const area = lookup.areaOf(m);
  const st = contactState(m.lastContact, area);
  const cls = st === 'recent' ? 'ok' : st === 'soon' ? 'warn' : 'danger';
  const days = m.lastContact ? daysBetween(m.lastContact, todayISO()) : undefined;
  return (
    <span className={`pill ${cls}`} title={`Last contact ${m.lastContact ? fmtDate(m.lastContact) : 'never'} · ${area.name}: contact soon at ${area.cadence.soon}d, follow-up at ${area.cadence.followUp}d`}>
      {CONTACT_LABEL[st]}
      {days !== undefined && <span className="num" style={{ opacity: 0.75 }}> · {days}d</span>}
    </span>
  );
}

export function billingLabel(b: BillingArrangement) {
  if (b.kind === 'hourly') return `Hourly · ${money(b.rate)}/hr`;
  if (b.kind === 'flat') return b.amount ? `Fixed price · ${money(b.amount)}` : 'Fixed price · not set';
  return `Fixed ${money(b.amount)} + ${money(b.rate)}/hr`;
}

export function BillingPill({ b }: { b: BillingArrangement }) {
  const cls = b.kind === 'hourly' ? 'info' : b.kind === 'flat' ? 'accent' : 'warn';
  const label = b.kind === 'hourly' ? 'Hourly' : b.kind === 'flat' ? 'Fixed price' : 'Hybrid';
  return <span className={`pill ${cls}`}>{label}</span>;
}

export function StagePill({ m }: { m: Matter }) {
  const { lookup } = useStore();
  const area = lookup.areaOf(m);
  const idx = area.stages.findIndex((x) => x.id === m.stageId);
  const st = area.stages[idx];
  const last = idx === area.stages.length - 1;
  return <span className={`pill ${last ? 'ok' : 'accent'}`}>{st?.name ?? 'Unknown stage'}</span>;
}

export function Person({ id, showName = false }: { id: string; showName?: boolean }) {
  return (
    <span className="row" style={{ gap: 6, flexWrap: 'nowrap' }} title={teamName(id)}>
      <span className={`avatar ${isOutside(id) ? 'outside' : ''}`}>{teamInitials(id)}</span>
      {showName && <span style={{ whiteSpace: 'nowrap' }}>{teamName(id)}</span>}
    </span>
  );
}

/** "Whose Ball": a team member, or the client / a 3rd party / the court. */
export function BallSelect({ value, onChange, id, compact }: { value: string; onChange: (v: string) => void; id: string; compact?: boolean }) {
  return (
    <select className={`input ${compact ? 'small tight' : ''} ${isOutside(value) ? 'ball-out' : ''}`} id={id} aria-label="Whose ball" value={value} onChange={(e) => onChange(e.target.value)}>
      <optgroup label="Firm">
        {TEAM.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </optgroup>
      <optgroup label="Waiting on">
        {OUTSIDE_BALLS.map((b) => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </optgroup>
    </select>
  );
}

/** An editable date. Empty means "not set"; the clear button removes it. */
export function DateField({ value, onChange, id, label, placeholder }: { value?: string; onChange: (v: string | undefined) => void; id: string; label: string; placeholder?: string }) {
  return (
    <span className="datefield">
      <input className="input small tight num" type="date" id={id} aria-label={label} value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)} title={placeholder} />
      {value && (
        <button className="btn ghost sm icon" aria-label={`Clear ${label}`} onClick={() => onChange(undefined)}>
          ×
        </button>
      )}
    </span>
  );
}

export function MatterLink({ id }: { id?: string }) {
  const { lookup, go } = useStore();
  if (!id) return <span className="muted">Unassigned</span>;
  const m = lookup.matter(id);
  if (!m) return null;
  return (
    <button className="link" onClick={() => go('matter', id)}>
      {m.name}
    </button>
  );
}

export function PageHead({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {children && <div className="row">{children}</div>}
    </div>
  );
}
