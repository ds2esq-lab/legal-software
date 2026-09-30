import { useState } from 'react';
import { unreadFor, useStore } from '../store';
import { PageHead } from '../ui';
import Thread from '../Thread';

export default function Messages() {
  const { s, lookup, go, access } = useStore();
  const unread = unreadFor(s.messages, access.user);
  const count = (id: string) => unread.filter((x) => x.channel === id).length;
  // Unread client messages first, then everything else with a thread.
  const matterChannels = s.matters.filter((m) => access.canSee(m) && s.messages.some((x) => x.channel === m.id)).sort((a, b) => count(b.id) - count(a.id));
  const [ch, setCh] = useState(() => (unread.length && matterChannels[0] && count(matterChannels[0].id) ? matterChannels[0].id : 'general'));
  const m = lookup.matter(ch);

  return (
    <>
      <PageHead title="Messages" sub="Team chat where every matter has its own thread, so the conversation stays with the file instead of in someone’s DMs." />
      <section className="panel chat">
        <nav className="channels" aria-label="Channels">
          <div className="label" style={{ padding: '4px 10px' }}>Firm</div>
          {['general', 'intake'].map((c) => (
            <button key={c} aria-current={ch === c} onClick={() => setCh(c)}># {c}</button>
          ))}
          <div className="label" style={{ padding: '10px 10px 4px' }}>Matters</div>
          {matterChannels.map((x) => (
            <button key={x.id} aria-current={ch === x.id} onClick={() => setCh(x.id)} title={x.name} className={count(x.id) ? 'unread' : ''}>
              <span>{x.name}</span>{count(x.id) > 0 && <span className="count" aria-label={`${count(x.id)} unread client message${count(x.id) === 1 ? '' : 's'}`}>{count(x.id)}</span>}
            </button>
          ))}
        </nav>
        <div className="thread">
          {m && (
            <div className="panel-head">
              <span><strong>{m.name}</strong> <span className="small muted">· {lookup.clientOf(m)?.name}</span></span>
              <button className="btn sm" onClick={() => go('matter', m.id)}>Open matter</button>
            </div>
          )}
          <Thread key={ch} channel={ch} allowClient={!!m} clientName={m ? lookup.clientOf(m)?.name : undefined} />
        </div>
      </section>
    </>
  );
}
