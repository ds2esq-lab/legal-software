import { useState } from 'react';
import { useStore } from '../store';
import { PageHead } from '../ui';
import Thread from '../Thread';

export default function Messages() {
  const { s, lookup, go, access } = useStore();
  const [ch, setCh] = useState('general');
  const matterChannels = s.matters.filter((m) => access.canSee(m) && s.messages.some((x) => x.channel === m.id));
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
            <button key={x.id} aria-current={ch === x.id} onClick={() => setCh(x.id)} title={x.name}>{x.name}</button>
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
