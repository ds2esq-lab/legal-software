import { useState } from 'react';
import { useStore, type Target } from './store';
import type { Note, Party } from './data';
import { teamName } from './data';
import { fmtDate, fmtTime, relDay } from './ui';

export function CopyText({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  if (!text) return <span className="muted small">—</span>;
  return (
    <span className="copy">
      <span className="num sel">{text}</span>
      <button
        className="btn ghost sm icon"
        aria-label={`Copy ${label}`}
        onClick={() => {
          navigator.clipboard
            ?.writeText(text)
            .then(() => { setDone(true); window.setTimeout(() => setDone(false), 1200); })
            .catch(() => undefined);
        }}
      >
        {done ? '✓' : '⧉'}
      </button>
    </span>
  );
}

/** Pick an existing contact or create a new one. */
export function ContactPicker({ onPick, exclude = [], id, cta = 'Add' }: { onPick: (contactId: string, role: string) => void; exclude?: string[]; id: string; cta?: string }) {
  const { s, actions } = useStore();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('spouse');
  const [creating, setCreating] = useState(false);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const term = q.trim().toLowerCase();
  const matches = term.length < 2 ? [] : s.contacts.filter((c) => !exclude.includes(c.id) && (c.name.toLowerCase().includes(term) || c.phone.replace(/\D/g, '').includes(term.replace(/\D/g, '') || '§') || c.email.toLowerCase().includes(term))).slice(0, 6);

  const roleSelect = (
    <select className="input small tight" id={`${id}-role`} aria-label="Role" value={role} onChange={(e) => setRole(e.target.value)}>
      {s.roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
    </select>
  );

  return (
    <div className="stack picker" style={{ gap: 6 }}>
      <div className="row" style={{ gap: 6 }}>
        <input className="input small" style={{ flex: '1 1 180px' }} id={id} aria-label="Find a contact" placeholder="Find a contact by name, phone or email…" value={q} onChange={(e) => { setQ(e.target.value); setCreating(false); }} />
        {roleSelect}
      </div>
      {matches.length > 0 && (
        <ul className="list picker-list">
          {matches.map((c) => (
            <li key={c.id} className="spread">
              <span>{c.name}<span className="small muted num"> · {c.phone}</span></span>
              <button className="btn sm" onClick={() => { onPick(c.id, role); setQ(''); }}>{cta}</button>
            </li>
          ))}
        </ul>
      )}
      {term.length >= 2 && !creating && (
        <button className="link small" style={{ alignSelf: 'flex-start' }} onClick={() => setCreating(true)}>+ Create new contact “{q.trim()}”</button>
      )}
      {creating && (
        <form
          className="row"
          style={{ gap: 6 }}
          onSubmit={(e) => {
            e.preventDefault();
            const cid = actions.addContact({ name: q.trim(), kind: 'person', phone, email });
            onPick(cid, role);
            setQ(''); setPhone(''); setEmail(''); setCreating(false);
          }}
        >
          <input className="input small num" style={{ flex: '1 1 120px' }} id={`${id}-phone`} aria-label="Phone" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <input className="input small" style={{ flex: '1 1 160px' }} id={`${id}-email`} aria-label="Email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="btn sm primary" type="submit">Create & add</button>
        </form>
      )}
    </div>
  );
}

/** Everyone on a PNC matter or Client matter, with their role. */
export function PartiesPanel({ target, parties, title = 'People on this matter' }: { target: Target; parties: Party[]; title?: string }) {
  const { actions, lookup, go, notify } = useStore();
  const { s } = useStore();
  const [adding, setAdding] = useState(false);

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{title}</h2>
        <button className="btn sm" onClick={() => setAdding((a) => !a)}>{adding ? 'Done' : '+ Add person'}</button>
      </div>
      <ul className="list">
        {parties.map((p) => {
          const c = lookup.contact(p.contactId);
          if (!c) return null;
          const role = lookup.role(p.role);
          const other = s.matters.filter((m) => m.id !== target.id && m.parties.some((x) => x.contactId === c.id)).length + s.pncs.filter((q) => q.id !== target.id && q.parties.some((x) => x.contactId === c.id)).length;
          return (
            <li key={p.contactId} className="party">
              <div className="party-main">
                <div className="row" style={{ gap: 6 }}>
                  <button className="link" onClick={() => go('contact', c.id)}>{c.name}</button>
                  {p.primary && <span className="pill accent">Primary</span>}
                  <span className={`pill ${role.side === 'adverse' ? 'danger' : role.side === 'client' ? 'info' : ''}`}>{role.name}</span>
                  {other > 0 && <span className="small muted">· on {other} other matter{other === 1 ? '' : 's'}</span>}
                </div>
                <div className="row small" style={{ gap: 12 }}>
                  <CopyText text={c.phone} label="phone" />
                  <CopyText text={c.email} label="email" />
                </div>
              </div>
              <div className="row" style={{ gap: 4 }}>
                <select
                  className="input small tight"
                  id={`role-${target.id}-${c.id}`}
                  aria-label={`Role for ${c.name}`}
                  value={p.role}
                  onChange={(e) => actions.setParties(target, (ps) => ps.map((x) => (x.contactId === c.id ? { ...x, role: e.target.value } : x)))}
                >
                  {s.roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                {!p.primary && (
                  <button className="btn sm ghost" onClick={() => actions.setParties(target, (ps) => ps.map((x) => ({ ...x, primary: x.contactId === c.id })))}>Make primary</button>
                )}
                {!p.primary && (
                  <button className="btn sm ghost icon danger" aria-label={`Remove ${c.name}`} onClick={() => { actions.setParties(target, (ps) => ps.filter((x) => x.contactId !== c.id)); notify(`${c.name} removed from this matter. The contact is kept.`); }}>×</button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {adding && (
        <div className="panel-body" style={{ borderTop: '1px solid var(--line)' }}>
          <ContactPicker
            id={`pick-${target.id}`}
            exclude={parties.map((p) => p.contactId)}
            onPick={(cid, role) => { actions.setParties(target, (ps) => [...ps, { contactId: cid, role }]); notify('Added. Run a conflict check if this person is new to the firm.'); }}
          />
        </div>
      )}
    </section>
  );
}

export function NotesPanel({ target, notes, title = 'Notes' }: { target: Target | { kind: 'contact'; id: string }; notes: Note[]; title?: string }) {
  const { actions } = useStore();
  const [text, setText] = useState('');
  const sorted = [...notes].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.at.localeCompare(a.at));
  return (
    <section className="panel">
      <div className="panel-head"><h2>{title}</h2><span className="small muted">{notes.length} note{notes.length === 1 ? '' : 's'} · internal, never shown to clients</span></div>
      <form
        className="panel-body stack"
        style={{ gap: 6 }}
        onSubmit={(e) => { e.preventDefault(); if (text.trim()) { actions.addNote(target, text.trim()); setText(''); } }}
      >
        <textarea className="input" id={`note-${target.kind}-${target.id}`} aria-label="New note" rows={2} placeholder="Add a note…" value={text} onChange={(e) => setText(e.target.value)} />
        <div><button className="btn sm primary" type="submit" disabled={!text.trim()}>Add note</button></div>
      </form>
      <ul className="list">
        {sorted.length === 0 && <li className="muted small">No notes yet.</li>}
        {sorted.map((n) => (
          <li key={n.id} className={`note ${n.pinned ? 'pinned' : ''}`}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="small muted">
                <strong style={{ color: 'var(--ink)' }}>{teamName(n.author)}</strong> · {relDay(n.at)} {fmtTime(n.at)}
                <span className="num"> · {fmtDate(n.at)}</span>
              </div>
              <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{n.text}</div>
            </div>
            <button className="btn sm ghost" aria-pressed={!!n.pinned} onClick={() => actions.togglePin(target, n.id)}>{n.pinned ? 'Unpin' : 'Pin'}</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
