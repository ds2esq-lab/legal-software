import { useState } from 'react';
import { useStore } from './store';
import { teamInitials, teamName } from './data';
import { fmtTime, relDay } from './ui';

/**
 * One conversation. On a matter, internal notes and client messages live side by side;
 * `mode` decides which the composer writes and which are shown.
 */
export default function Thread({ channel, allowClient, clientName }: { channel: string; allowClient: boolean; clientName?: string }) {
  const { s, actions } = useStore();
  const [mode, setMode] = useState<'internal' | 'client' | 'all'>(allowClient ? 'all' : 'internal');
  const [text, setText] = useState('');
  const msgs = s.messages
    .filter((m) => m.channel === channel)
    .filter((m) => mode === 'all' || (mode === 'client' ? m.clientVisible : !m.clientVisible))
    .sort((a, b) => a.at.localeCompare(b.at));

  const send = () => {
    if (!text.trim()) return;
    actions.postMessage(channel, text.trim(), allowClient && mode === 'client');
    setText('');
  };

  return (
    <div className="thread">
      {allowClient && (
        <div className="panel-head" style={{ borderBottom: '1px solid var(--line)' }}>
          <div className="seg" role="group" aria-label="Which messages">
            <button aria-pressed={mode === 'all'} onClick={() => setMode('all')}>All</button>
            <button aria-pressed={mode === 'internal'} onClick={() => setMode('internal')}>Team only</button>
            <button aria-pressed={mode === 'client'} onClick={() => setMode('client')}>With client</button>
          </div>
          <span className="small muted">Team notes never appear in the client portal.</span>
        </div>
      )}
      <div className="msgs">
        {msgs.length === 0 && <p className="muted">No messages yet.</p>}
        {msgs.map((m) => {
          const who = m.author === 'client' ? clientName ?? 'Client' : m.author === 'system' ? 'Docket' : teamName(m.author);
          const initials = m.author === 'client' ? (clientName ?? 'C').slice(0, 2).toUpperCase() : m.author === 'system' ? '◆' : teamInitials(m.author);
          return (
            <div key={m.id} className={`msg ${m.author === 'client' ? 'client' : m.author === 'system' ? 'system' : ''}`}>
              <span className="avatar">{initials}</span>
              <div style={{ minWidth: 0 }}>
                <div className="row" style={{ gap: 6 }}>
                  <strong>{who}</strong>
                  <span className="small muted">{relDay(m.at)} {fmtTime(m.at)}</span>
                  {allowClient && (m.clientVisible ? <span className="pill info">Client can see</span> : <span className="pill">Team only</span>)}
                </div>
                <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.text}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="compose">
        <textarea
          className="input"
          id={`compose-${channel}`}
          aria-label="Message"
          placeholder={allowClient && mode === 'client' ? `Message ${clientName ?? 'the client'} (visible in their portal)` : 'Write a note to your team…'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={2}
        />
        {allowClient && mode === 'all' && (
          <span className="small muted" style={{ flexBasis: '100%', order: 3 }}>Choose “Team only” or “With client” to decide who sees your message. In “All”, messages go to the team.</span>
        )}
        <button className="btn primary" onClick={send}>
          {allowClient && mode === 'client' ? 'Send to client' : 'Post'}
        </button>
      </div>
    </div>
  );
}
