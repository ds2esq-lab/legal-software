import { useState } from 'react';
import { useStore } from '../store';
import { PNC_STAGES, type Contact } from '../data';
import { CopyText, NotesPanel } from '../people';
import { fmtDate, PageHead, StagePill } from '../ui';

type Filter = 'all' | 'clients' | 'former' | 'pnc' | 'adverse';

function useLinks() {
  const { s, lookup, access } = useStore();
  return (c: Contact) => {
    const out: { kind: 'pnc' | 'open' | 'former'; id: string; title: string; role: string; side: string; status: string; date?: string }[] = [];
    for (const m of s.matters)
      for (const p of m.parties)
        if (p.contactId === c.id) {
          const r = lookup.role(p.role);
          out.push({ kind: m.status === 'open' ? 'open' : 'former', id: m.id, title: access.canSee(m) ? m.name : access.walledOff(m) ? '🔒 Restricted matter' : 'Matter in another practice area', role: r.name, side: r.side, status: m.status === 'open' ? lookup.areaOf(m).name : `Closed ${m.closedOn ? fmtDate(m.closedOn) + ', ' + m.closedOn.slice(0, 4) : ''}`, date: m.closedOn ?? m.opened });
        }
    for (const q of s.pncs)
      for (const p of q.parties)
        if (p.contactId === c.id) {
          const r = lookup.role(p.role);
          out.push({ kind: 'pnc', id: q.id, title: q.title, role: r.name, side: r.side, status: PNC_STAGES.find((x) => x.id === q.stage)!.label, date: q.firstContact });
        }
    return out;
  };
}

export function ContactDetail() {
  const { s, contactId, lookup, actions, go } = useStore();
  const linksOf = useLinks();
  const c = lookup.contact(contactId);
  if (!c) return <p>Contact not found.</p>;
  const links = linksOf(c);
  const up = (patch: Partial<Contact>) => actions.updateContact(c.id, patch);
  const groups: [string, typeof links][] = [
    ['Open Client matters', links.filter((l) => l.kind === 'open')],
    ['PNC matters', links.filter((l) => l.kind === 'pnc')],
    ['Former Client matters', links.filter((l) => l.kind === 'former')],
  ];

  return (
    <>
      <div className="small"><button className="link" onClick={() => go('contacts')}>← Contacts</button></div>
      <PageHead title={c.name} sub={`${c.kind === 'org' ? 'Organization' : 'Person'} · on ${links.length} matter${links.length === 1 ? '' : 's'}`}>
        <button className="btn" onClick={() => go('conflicts')}>Conflict check</button>
      </PageHead>
      <div className="grid cols-main">
        <div className="stack" style={{ gap: 16 }}>
          {groups.map(([label, items]) => (
            <section key={label} className="panel">
              <div className="panel-head"><h2>{label} <span className="num small muted">{items.length}</span></h2></div>
              <ul className="list">
                {items.length === 0 && <li className="muted small">None.</li>}
                {items.map((l) => {
                  const m = l.kind !== 'pnc' ? lookup.matter(l.id) : undefined;
                  return (
                    <li key={l.kind + l.id} className="spread">
                      <span>
                        {l.title.startsWith('🔒') || l.title.startsWith('Matter in another') ? <span className="muted">{l.title}</span> : <button className="link" onClick={() => go(l.kind === 'pnc' ? 'pnc' : 'matter', l.id)}>{l.title}</button>}
                        <div className="small muted">{l.status}</div>
                      </span>
                      <span className="row" style={{ gap: 6 }}>
                        <span className={`pill ${l.side === 'adverse' ? 'danger' : l.side === 'client' ? 'info' : ''}`}>{l.role}</span>
                        {m && m.status === 'open' && <StagePill m={m} />}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          <NotesPanel target={{ kind: 'contact', id: c.id }} notes={c.notes} title="Notes about this person" />
        </div>
        <section className="panel">
          <div className="panel-head"><h2>Contact information</h2></div>
          <div className="panel-body stack" style={{ gap: 10 }}>
            <div className="field"><label htmlFor="c-name">Name {c.kind === 'person' && <span className="muted">(Last, First)</span>}</label><input className="input" id="c-name" value={c.name} onChange={(e) => up({ name: e.target.value })} /></div>
            <div className="field"><label htmlFor="c-phone">Phone</label><input className="input num" id="c-phone" value={c.phone} onChange={(e) => up({ phone: e.target.value })} /></div>
            <div className="field"><label htmlFor="c-email">Email</label><input className="input" id="c-email" value={c.email} onChange={(e) => up({ email: e.target.value })} /></div>
            <div className="field"><label htmlFor="c-addr">Address</label><textarea className="input" id="c-addr" rows={2} value={c.address ?? ''} onChange={(e) => up({ address: e.target.value || undefined })} /></div>
            <div className="field"><label htmlFor="c-aka">Other names <span className="muted">(maiden, nicknames; conflict checks search these)</span></label><input className="input" id="c-aka" value={c.aka ?? ''} onChange={(e) => up({ aka: e.target.value || undefined })} /></div>
            <div className="row small" style={{ gap: 12 }}><CopyText text={c.phone} label="phone" /><CopyText text={c.email} label="email" /></div>
            <p className="small muted">Changes here update every matter this person is on.</p>
          </div>
        </section>
      </div>
      <p className="small muted">{s.contacts.length} contacts in the firm</p>
    </>
  );
}

export default function Contacts() {
  const { s, actions, go, notify } = useStore();
  const linksOf = useLinks();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [kind, setKind] = useState<Contact['kind']>('person');

  const term = q.trim().toLowerCase();
  const digits = term.replace(/\D/g, '');
  const rows = s.contacts
    .map((c) => ({ c, links: linksOf(c) }))
    .filter(({ c }) => !term || c.name.toLowerCase().includes(term) || (c.aka ?? '').toLowerCase().includes(term) || c.email.toLowerCase().includes(term) || (digits.length >= 3 && c.phone.replace(/\D/g, '').includes(digits)))
    .filter(({ links }) =>
      filter === 'all' ? true
      : filter === 'clients' ? links.some((l) => l.kind === 'open')
      : filter === 'former' ? links.some((l) => l.kind === 'former') && !links.some((l) => l.kind === 'open')
      : filter === 'pnc' ? links.some((l) => l.kind === 'pnc') && !links.some((l) => l.kind !== 'pnc')
      : links.some((l) => l.side === 'adverse'),
    )
    .sort((a, b) => a.c.name.localeCompare(b.c.name));

  return (
    <>
      <PageHead title="Contacts" sub="Every person and organization, stored once. A contact can be on any number of PNC matters and Client matters, with a different role on each.">
        <button className="btn primary" onClick={() => setAdding((a) => !a)}>{adding ? 'Cancel' : '+ New contact'}</button>
      </PageHead>

      {adding && (
        <form
          className="panel panel-body row"
          style={{ alignItems: 'flex-end' }}
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            const id = actions.addContact({ name: name.trim(), kind, phone, email });
            setName(''); setPhone(''); setEmail(''); setAdding(false);
            notify('Contact created');
            go('contact', id);
          }}
        >
          <div className="field" style={{ flex: '2 1 200px' }}><label htmlFor="nc-name">Name</label><input className="input" id="nc-name" placeholder="Last, First" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="field" style={{ flex: '1 1 140px' }}><label htmlFor="nc-phone">Phone</label><input className="input num" id="nc-phone" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <div className="field" style={{ flex: '1 1 180px' }}><label htmlFor="nc-email">Email</label><input className="input" id="nc-email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="field" style={{ flex: '0 1 140px' }}><label htmlFor="nc-kind">Type</label>
            <select className="input" id="nc-kind" value={kind} onChange={(e) => setKind(e.target.value as Contact['kind'])}><option value="person">Person</option><option value="org">Organization</option></select>
          </div>
          <button className="btn primary" type="submit">Create</button>
        </form>
      )}

      <div className="row">
        <input className="input" style={{ flex: '1 1 260px', maxWidth: 480 }} id="contact-search" aria-label="Search contacts" placeholder="Search name, former name, phone or email…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="seg" role="group" aria-label="Filter contacts">
          {([['all', 'All'], ['clients', 'Current clients'], ['former', 'Former clients'], ['pnc', 'Prospects'], ['adverse', 'Adverse parties']] as [Filter, string][]).map(([k, l]) => (
            <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
      </div>

      <section className="panel table-wrap">
        <table className="t">
          <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Matters</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={4} className="muted">No contacts match.</td></tr>}
            {rows.map(({ c, links }) => (
              <tr key={c.id}>
                <td style={{ minWidth: 180 }}>
                  <button className="link" onClick={() => go('contact', c.id)}>{c.name}</button>
                  {c.aka && <div className="small muted">aka {c.aka}</div>}
                </td>
                <td><CopyText text={c.phone} label="phone" /></td>
                <td style={{ minWidth: 180 }}><CopyText text={c.email} label="email" /></td>
                <td>
                  <div className="row" style={{ gap: 4 }}>
                    {links.length === 0 && <span className="muted small">None</span>}
                    {links.slice(0, 3).map((l) => (
                      <button key={l.kind + l.id} className={`pill link-pill ${l.side === 'adverse' ? 'danger' : l.kind === 'open' ? 'info' : ''}`} onClick={() => go(l.kind === 'pnc' ? 'pnc' : 'matter', l.id)}>
                        {l.kind === 'pnc' ? 'PNC' : l.kind === 'open' ? 'Open' : 'Former'} · {l.role}
                      </button>
                    ))}
                    {links.length > 3 && <span className="small muted">+{links.length - 3}</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
