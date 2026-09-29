import type { ReactNode } from 'react';
import type { BillingArrangement, Matter } from './data';
import { STAGES, teamInitials, teamName } from './data';
import { money } from './billing';
import { useStore } from './store';

const DAY = 86400000;

export function startOfToday() {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

export function fmtDate(iso: string) {
  return new Date(iso.length === 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function daysFromToday(iso: string) {
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - startOfToday().getTime()) / DAY);
}

export function relDay(iso: string) {
  const n = daysFromToday(iso);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  if (n < 0) return `${-n}d ago`;
  if (n < 7) return new Date(iso.length === 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('en-US', { weekday: 'short' });
  return fmtDate(iso);
}

export function DuePill({ iso }: { iso?: string }) {
  if (!iso) return <span className="pill">No deadline</span>;
  const n = daysFromToday(iso);
  const cls = n < 0 ? 'danger' : n <= 1 ? 'danger' : n <= 3 ? 'warn' : '';
  return <span className={`pill ${cls}`}>{n < 0 ? 'Overdue · ' : ''}{relDay(iso)}</span>;
}

export function billingLabel(b: BillingArrangement) {
  if (b.kind === 'hourly') return `Hourly · ${money(b.rate)}/hr`;
  if (b.kind === 'flat') return `Flat fee · ${money(b.amount)}`;
  return `Flat ${money(b.amount)} + ${money(b.rate)}/hr`;
}

export function BillingPill({ b }: { b: BillingArrangement }) {
  const cls = b.kind === 'hourly' ? 'info' : b.kind === 'flat' ? 'accent' : 'warn';
  const label = b.kind === 'hourly' ? 'Hourly' : b.kind === 'flat' ? 'Flat fee' : 'Hybrid';
  return <span className={`pill ${cls}`}>{label}</span>;
}

export function StagePill({ stage }: { stage: Matter['stage'] }) {
  const s = STAGES.find((x) => x.id === stage)!;
  const cls = stage === 'waiting' ? 'warn' : stage === 'intake' || stage === 'consult' ? 'info' : stage === 'wrapup' ? 'ok' : 'accent';
  return <span className={`pill ${cls}`}>{s.label}</span>;
}

export function Person({ id, showName = false }: { id: string; showName?: boolean }) {
  return (
    <span className="row" style={{ gap: 6 }} title={teamName(id)}>
      <span className="avatar">{teamInitials(id)}</span>
      {showName && <span>{teamName(id)}</span>}
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
