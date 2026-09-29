// Conflict search: every contact on every PNC matter, open matter and former matter.
import type { Contact, Matter, Pnc, Role, RoleSide } from './data';

export type MatchStrength = 'exact' | 'likely' | 'possible';

export interface Term {
  text: string;
  side?: RoleSide; // which side this person would be on in the new matter
}

export interface Hit {
  contact: Contact;
  strength: MatchStrength;
  term: string;
  termSide?: RoleSide;
  why: string;
  links: {
    kind: 'pnc' | 'open' | 'former';
    id: string;
    title: string;
    role: Role;
    date?: string; // closed date for former matters
  }[];
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ,@.]/g, ' ').replace(/\s+/g, ' ').trim();

/** "Last, First" or "First Last" -> { first, last } */
function splitName(raw: string) {
  const s = norm(raw);
  if (s.includes(',')) {
    const [last, rest] = s.split(',', 2);
    return { first: rest.trim().split(' ')[0] ?? '', last: last.trim() };
  }
  const parts = s.split(' ').filter(Boolean);
  return { first: parts[0] ?? '', last: parts[parts.length - 1] ?? '' };
}

function score(term: string, c: Contact): { strength: MatchStrength; why: string } | null {
  const t = norm(term);
  if (!t) return null;
  const digits = term.replace(/\D/g, '');
  if (digits.length >= 7 && c.phone.replace(/\D/g, '').endsWith(digits.slice(-7))) return { strength: 'exact', why: 'Same phone number' };
  if (t.includes('@') && norm(c.email) === t) return { strength: 'exact', why: 'Same email' };

  const names = [c.name, ...(c.aka ? [c.aka.replace(/\(.*?\)/g, '')] : [])];
  let best: { strength: MatchStrength; why: string } | null = null;
  for (const n of names) {
    const a = splitName(term);
    const b = splitName(n);
    if (c.kind === 'org' || !a.first) {
      if (norm(n).includes(t) || t.includes(norm(n))) return { strength: 'likely', why: 'Name contains the search' };
      continue;
    }
    if (a.last && a.last === b.last) {
      if (a.first === b.first) return { strength: 'exact', why: n === c.name ? 'Same name' : 'Matches a former name' };
      if (a.first[0] && a.first[0] === b.first[0]) best = { strength: 'likely', why: 'Same last name and first initial' };
      else if (!best) best = { strength: 'possible', why: 'Same last name' };
    }
  }
  return best;
}

export function searchConflicts(terms: Term[], contacts: Contact[], matters: Matter[], pncs: Pnc[], roles: Role[], excludePncId?: string): Hit[] {
  const roleOf = (id: string) => roles.find((r) => r.id === id) ?? { id, name: id, side: 'neutral' as const };
  const hits = new Map<string, Hit>();
  const rank: Record<MatchStrength, number> = { exact: 0, likely: 1, possible: 2 };

  for (const { text: term, side } of terms.map((x) => ({ ...x, text: x.text.trim() })).filter((x) => x.text)) {
    for (const c of contacts) {
      const s = score(term, c);
      if (!s) continue;
      const links: Hit['links'] = [];
      for (const p of pncs) {
        if (p.id === excludePncId) continue;
        for (const party of p.parties) if (party.contactId === c.id) links.push({ kind: 'pnc', id: p.id, title: p.title, role: roleOf(party.role) });
      }
      for (const m of matters) {
        for (const party of m.parties)
          if (party.contactId === c.id) links.push({ kind: m.status === 'open' ? 'open' : 'former', id: m.id, title: m.name, role: roleOf(party.role), date: m.closedOn });
      }
      // A contact attached only to the PNC being checked is not a hit.
      if (!links.length && pncs.some((p) => p.id === excludePncId && p.parties.some((x) => x.contactId === c.id))) continue;
      const prev = hits.get(c.id);
      if (!prev || rank[s.strength] < rank[prev.strength]) hits.set(c.id, { contact: c, strength: s.strength, term, termSide: side, why: s.why, links });
    }
  }
  return [...hits.values()].sort((a, b) => rank[a.strength] - rank[b.strength] || severity(b) - severity(a));
}

/**
 * 2 = conflict: the person would be on the opposite side from where they stand with the firm
 *     (adverse to someone we represent, or we'd represent someone we were adverse to).
 * 1 = existing relationship: current or former client, or on the same side before.
 * 0 = neutral mention (beneficiary, court, referral source).
 */
export function severity(h: Hit) {
  const wasClient = h.links.some((l) => l.kind !== 'pnc' && l.role.side === 'client');
  const wasAdverse = h.links.some((l) => l.role.side === 'adverse');
  if (h.termSide === 'adverse' && wasClient) return 2;
  if (h.termSide === 'client' && wasAdverse) return 2;
  if (!h.termSide && wasAdverse) return 2;
  if (wasClient || h.links.some((l) => l.role.side === 'client')) return 1;
  return 0;
}

export function reason(h: Hit) {
  const wasClient = h.links.some((l) => l.kind !== 'pnc' && l.role.side === 'client');
  if (h.termSide === 'adverse' && wasClient) return 'Would be adverse to someone the firm represents or represented';
  if (h.termSide === 'client' && h.links.some((l) => l.role.side === 'adverse')) return 'Was an adverse party in a firm matter';
  if (!h.termSide && h.links.some((l) => l.role.side === 'adverse')) return 'Has been an adverse party in a firm matter';
  if (wasClient) return 'Current or former client';
  return 'Appears on a firm matter';
}

export function summarize(hits: Hit[]) {
  const adverse = hits.filter((h) => severity(h) === 2 && h.strength !== 'possible').length;
  const represented = hits.filter((h) => severity(h) === 1 && h.strength !== 'possible').length;
  if (adverse) return { level: 'danger' as const, text: `Potential conflict: ${adverse} match${adverse === 1 ? '' : 'es'} on the opposite side` };
  if (represented) return { level: 'warn' as const, text: `Existing relationship: ${represented} current or former client match${represented === 1 ? '' : 'es'}` };
  if (hits.length) return { level: 'info' as const, text: `${hits.length} weak match${hits.length === 1 ? '' : 'es'} to review` };
  return { level: 'ok' as const, text: 'No matches found' };
}
