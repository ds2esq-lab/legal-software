import { useState } from 'react';
import { useStore, type Target } from './store';
import { teamName, type ConflictCheck, type Party } from './data';
import { reason, searchConflicts, severity, summarize, type Hit, type Term } from './conflicts';
import { todayISO } from './practice';
import { fmtDate } from './ui';
import { HitList, SummaryBanner } from './screens/Conflicts';

/** Freeze a search result so the record doesn't change when data changes later. */
export function snapshotOf(hits: Hit[]) {
  return hits.map((h) => ({
    name: h.contact.name,
    strength: h.strength,
    reason: reason(h),
    severity: severity(h) as 0 | 1 | 2,
    on: h.links.map((l) => `${l.role.name} · ${l.title} · ${l.kind === 'pnc' ? 'PNC' : l.kind === 'open' ? 'Open matter' : 'Former matter'}`),
  }));
}

/** People on the matter who weren't part of the latest check. */
export function uncheckedParties(checks: ConflictCheck[], parties: Party[]) {
  const last = checks[0];
  if (!last?.partyIds) return [];
  return parties.filter((p) => !last.partyIds!.includes(p.contactId));
}

export function ConflictBadge({ checks, parties }: { checks: ConflictCheck[]; parties: Party[] }) {
  const last = checks[0];
  if (!last) return <span className="pill warn" title="No conflict check attached">Conflicts: none on file</span>;
  if (uncheckedParties(checks, parties).length) return <span className="pill warn" title="People were added after the last check">Conflicts: re-check needed</span>;
  const cls = last.result === 'conflict' ? 'danger' : last.result === 'waived' ? 'warn' : 'ok';
  const label = last.result === 'clear' ? `Cleared ${fmtDate(last.date)}` : last.result === 'waived' ? `Waived ${fmtDate(last.date)}` : 'Conflict';
  return <span className={`pill ${cls}`} title={`Checked by ${teamName(last.by)} on ${fmtDate(last.date)}, ${last.date.slice(0, 4)}`}>{last.result === 'conflict' ? '⚠ ' : '✓ '}{label}</span>;
}

export function ConflictPanel({ target, parties, checks, compact }: { target: Target; parties: Party[]; checks: ConflictCheck[]; compact?: boolean }) {
  const { s, lookup, actions, notify } = useStore();
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const terms: Term[] = parties.flatMap((party) => {
    const c = lookup.contact(party.contactId);
    if (!c) return [];
    const side = lookup.role(party.role).side;
    return [{ text: c.name, side }, ...(c.aka ? [{ text: c.aka.replace(/\(.*?\)/g, ''), side }] : []), ...(c.phone ? [{ text: c.phone, side }] : [])];
  });
  // Don't match the matter against itself.
  const hits = searchConflicts(terms, s.contacts, s.matters.filter((m) => !(target.kind === 'matter' && m.id === target.id)), s.pncs, s.roles, target.kind === 'pnc' ? target.id : undefined)
    .map((h) => ({ ...h, links: h.links.filter((l) => !(target.kind === 'matter' && l.id === lookup.matter(target.id)?.pncId)) }))
    // People on this matter only count if they also appear somewhere else.
    .filter((h) => h.links.length > 0 || !parties.some((x) => x.contactId === h.contact.id));
  const sum = summarize(hits);
  const missing = uncheckedParties(checks, parties);

  const record = (result: ConflictCheck['result']) => {
    actions.recordConflict(target, {
      date: todayISO(),
      by: 'me',
      terms: parties.map((x) => lookup.contact(x.contactId)?.name ?? ''),
      partyIds: parties.map((x) => x.contactId),
      hits: hits.length,
      snapshot: snapshotOf(hits),
      result,
      note: note.trim() || undefined,
    });
    setNote('');
    notify(result === 'conflict' ? (target.kind === 'pnc' ? 'Conflict recorded. PNC matter declined.' : 'Conflict recorded on the matter.') : `Conflict check attached to this ${target.kind === 'pnc' ? 'PNC' : 'Client'} matter: ${result}.`);
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Conflict check</h2>
        <ConflictBadge checks={checks} parties={parties} />
      </div>
      {missing.length > 0 && (
        <div className="panel-body" style={{ paddingBottom: 0 }}>
          <div className="banner warn small">
            Added since the last check: {missing.map((p) => lookup.contact(p.contactId)?.name).join(', ')}. Run the check again and record a decision.
          </div>
        </div>
      )}
      <div className="panel-body stack" style={{ gap: 8 }}>
        <SummaryBanner hits={hits} />
        <span className="small muted">Live search on everyone on this matter (names, former names, phones) across all PNC, open and former matters.</span>
      </div>
      {!compact && <HitList hits={hits} />}
      <div className="panel-body stack" style={{ gap: 8, borderTop: '1px solid var(--line)' }}>
        <input className="input small" id={`cc-note-${target.id}`} aria-label="Decision note" placeholder="Note for the record (optional), e.g. “Spoke with client; unrelated Brennan family”" value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="row">
          <span className="small">Attorney decision:</span>
          <button className="btn sm" onClick={() => record('clear')} disabled={sum.level === 'danger'} title={sum.level === 'danger' ? 'Opposite-side match: record a waiver or a conflict' : ''}>Clear</button>
          <button className="btn sm" onClick={() => record('waived')}>Waived (written consent)</button>
          <button className="btn sm danger" onClick={() => record('conflict')}>Conflict{target.kind === 'pnc' ? ': decline' : ''}</button>
        </div>
      </div>
      <div className="panel-head" style={{ borderTop: '1px solid var(--line)' }}>
        <h2 style={{ fontSize: 13.5 }}>Checks on file <span className="num small muted">{checks.length}</span></h2>
      </div>
      <ul className="list">
        {checks.length === 0 && <li className="muted small">No conflict check is attached to this matter yet.</li>}
        {checks.map((c) => (
          <li key={c.id} className="stack" style={{ display: 'flex', gap: 4 }}>
            <div className="spread" style={{ width: '100%', flexWrap: 'wrap' }}>
              <span className="small">
                <span className={`pill ${c.result === 'conflict' ? 'danger' : c.result === 'waived' ? 'warn' : 'ok'}`}>{c.result === 'clear' ? 'Cleared' : c.result === 'waived' ? 'Waived' : 'Conflict'}</span>{' '}
                <span className="num">{fmtDate(c.date)}, {c.date.slice(0, 4)}</span> · {teamName(c.by)} · {c.hits} match{c.hits === 1 ? '' : 'es'}
              </span>
              <button className="btn sm ghost" onClick={() => setOpenId(openId === c.id ? null : c.id)}>{openId === c.id ? 'Hide report' : 'View report'}</button>
            </div>
            {openId === c.id && (
              <div className="report small">
                <div><strong>Searched:</strong> {c.terms.filter(Boolean).join('; ') || '—'}</div>
                {c.note && <div><strong>Note:</strong> {c.note}</div>}
                {(c.snapshot ?? []).length === 0 ? (
                  <div className="muted">No matches at the time of the check.</div>
                ) : (
                  <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                    {c.snapshot!.map((h, i) => (
                      <li key={i} className={h.severity === 2 ? 'sev-text' : ''}>
                        {h.name} ({h.strength}): {h.reason}{h.on.length ? `. ${h.on.join('; ')}` : ''}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
