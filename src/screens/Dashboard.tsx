import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { TEAM, teamName, type UserAccess } from '../data';
import { recentQuarters, type Quarter } from '../metrics';
import * as S from '../scorecard';

const first = (id: string) => (id === 'me' ? 'there' : teamName(id).split(' ')[0]);
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };
const TONE_LABEL: Record<S.Tone, string> = { ok: 'On pace', warn: 'Slightly behind', danger: 'Behind pace', none: 'No goal' };

// ---------- Charts (plain SVG; one series each, so no legends) ----------

/** Progress ring: filled share of goal, with a tick where you should be by today. */
function Ring({ share, pace, tone, size = 132, children }: { share?: number; pace?: number; tone: S.Tone; size?: number; children?: React.ReactNode }) {
  const w = size >= 100 ? 12 : 6, r = (size - w) / 2, c = 2 * Math.PI * r;
  const fill = Math.max(0, Math.min(1, share ?? 0));
  const tick = pace !== undefined && pace < 1 ? pace : undefined;
  const angle = tick !== undefined ? tick * 2 * Math.PI - Math.PI / 2 : 0;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} style={{ fill: 'none', stroke: 'var(--line)' }} strokeWidth={w} />
        {share !== undefined && (
          <circle cx={size / 2} cy={size / 2} r={r} className={`ring-fill tone-${tone}`} strokeWidth={w} strokeLinecap="round"
            strokeDasharray={`${fill * c} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        )}
        {tick !== undefined && (
          <line x1={size / 2 + (r - w) * Math.cos(angle)} y1={size / 2 + (r - w) * Math.sin(angle)} x2={size / 2 + (r + w) * Math.cos(angle)} y2={size / 2 + (r + w) * Math.sin(angle)}
            style={{ stroke: 'var(--ink)' }} strokeWidth={2} />
        )}
      </svg>
      <div className="ring-label">{children}</div>
    </div>
  );
}

function Spark({ values }: { values: (number | undefined)[] }) {
  const v = values.map((x) => x ?? 0);
  const max = Math.max(1, ...v), min = Math.min(...v);
  const W = 96, H = 28;
  const pts = v.map((x, i) => `${(i / Math.max(1, v.length - 1)) * W},${H - 3 - ((x - min) / Math.max(1, max - min)) * (H - 6)}`);
  return (
    <svg className="spark" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden>
      <polyline points={pts.join(' ')} style={{ fill: 'none', stroke: 'var(--accent)' }} strokeWidth={1.6} strokeLinejoin="round" />
      <circle cx={W} cy={pts[pts.length - 1].split(',')[1]} r={2.6} style={{ fill: 'var(--accent)' }} />
    </svg>
  );
}

function QuarterBars({ values, quarters, unit, selected, onPick, goal }: { values: (number | undefined)[]; quarters: Quarter[]; unit: S.Unit; selected: string; onPick: (id: string) => void; goal?: number }) {
  const max = Math.max(1, goal ?? 0, ...values.map((x) => x ?? 0));
  const H = 96;
  return (
    <div className="qbars" role="img" aria-label={quarters.map((q, i) => `${q.label} ${S.fmt(unit, values[i])}`).join(', ')}>
      {goal !== undefined && <div className="qbars-goal" style={{ bottom: 20 + (goal / max) * H }} title={`Goal ${S.fmt(unit, goal)}`} />}
      {quarters.map((q, i) => (
        <button key={q.id} className={`trend-col ${q.id === selected ? 'on' : ''}`} onClick={() => onPick(q.id)} title={`${q.label}: ${S.fmt(unit, values[i])}`}>
          <span className="trend-val num">{S.fmt(unit, values[i], true)}</span>
          <span className="trend-bar" style={{ height: Math.max(2, ((values[i] ?? 0) / max) * H) }} />
          <span className="trend-q">{q.label}</span>
        </button>
      ))}
    </div>
  );
}

function HBars({ rows, unit, onPick, picked }: { rows: { key: string; label: string; value: number; sub?: string }[]; unit: S.Unit; onPick?: (key: string) => void; picked?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="small muted">Nothing recorded this quarter.</p>;
  return (
    <ul className="hbars">
      {rows.map((r) => (
        <li key={r.key}>
          <button className={`hbar ${picked === r.key ? 'on' : ''}`} disabled={!onPick} onClick={() => onPick?.(r.key)}>
            <span className="hbar-label">{r.label}{r.sub && <span className="small muted"> · {r.sub}</span>}</span>
            <span className="hbar-track"><span style={{ width: `${(r.value / max) * 100}%` }} /></span>
            <span className="num hbar-val">{S.fmt(unit, r.value)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

// ---------- Shared pieces ----------

interface Ctx {
  scores: S.Scores;
  quarters: Quarter[];
  q: Quarter;
  setQ: (id: string) => void;
  users: UserAccess[];
}

function trend(ctx: Ctx, id: string, people: string[]) {
  return ctx.quarters.map((qq) => ctx.scores.value(id, people, qq));
}

function Delta({ now, prev, def, q }: { now?: number; prev?: number; def: S.MetricDef; q: Quarter }) {
  if (now === undefined || !prev) return null;
  // Compare the quarter so far with the same share of last quarter, so a partial quarter isn't a false drop.
  const e = S.isRate(def) ? 1 : S.elapsed(q);
  const base = prev * (e || 1);
  const d = def.unit === 'pct' ? now - prev : ((now - base) / base) * 100;
  const up = d >= 0;
  const good = def.lowerIsBetter ? !up : up;
  return <span className={`delta ${good ? 'up' : 'down'}`}>{up ? '▲' : '▼'} {Math.abs(Math.round(d))}{def.unit === 'pct' ? ' pts' : '%'}<span className="muted"> vs {e < 1 ? 'same point last qtr' : 'last qtr'}</span></span>;
}

/** Rows behind a number: by practice area (chart) and by matter or person (table). */
function Detail({ ctx, id, people, onPerson, team }: { ctx: Ctx; id: string; people: string[]; onPerson?: (p: string) => void; team?: boolean }) {
  const { access, go, lookup } = useStore();
  const def = S.metric(id)!;
  const [area, setArea] = useState<string>('');
  const byArea = ctx.scores.breakdown(id, people, ctx.q, 'a').filter((r) => r.key).map((r) => ({ ...r, label: lookup.area(r.key)?.name ?? r.key }));
  const byPerson = team ? ctx.scores.breakdown(id, people, ctx.q, 'u').map((r) => ({ ...r, label: teamName(r.key) })) : [];
  const byMatter = ctx.scores.breakdown(id, people, ctx.q, 'm').filter((r) => r.key && (!area || lookup.matter(r.key)?.areaId === area)).slice(0, 12);
  const goal = !team && people.length === 1 ? S.goalOf(ctx.users.find((u) => u.userId === people[0])!, id) : undefined;
  return (
    <section className="panel" aria-label={`${def.label} details`}>
      <div className="panel-head">
        <h2>{def.label} <span className="small muted">· {ctx.q.label}</span></h2>
        <span className="small muted">{def.help}</span>
      </div>
      <div className="panel-body dash-detail">
        <div className="stack" style={{ gap: 6 }}>
          <span className="label">Last five quarters{goal !== undefined && <span className="muted"> · dashed line = goal {S.fmt(def.unit, goal)}</span>}</span>
          <QuarterBars values={trend(ctx, id, people)} quarters={ctx.quarters} unit={def.unit} selected={ctx.q.id} onPick={ctx.setQ} goal={goal} />
        </div>
        {team && (
          <div className="stack" style={{ gap: 6 }}>
            <span className="label">By person <span className="muted">· click to open their dashboard</span></span>
            <HBars rows={byPerson} unit={def.unit} onPick={onPerson} />
          </div>
        )}
        <div className="stack" style={{ gap: 6 }}>
          <span className="label">By practice area {byArea.length > 0 && <span className="muted">· click to filter the matters</span>}</span>
          <HBars rows={byArea} unit={def.unit} onPick={(k) => setArea(area === k ? '' : k)} picked={area} />
        </div>
      </div>
      {byMatter.length > 0 && (
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Matter{area && <span className="muted"> · {lookup.area(area)?.name} <button className="link" onClick={() => setArea('')}>show all</button></span>}</th><th>Area</th><th className="r">{def.label}</th>{def.field === 'ratio' && <th className="r">{def.src === 'hours' ? 'Hours' : 'Tasks'}</th>}</tr></thead>
            <tbody>
              {byMatter.map((r) => {
                const m = lookup.matter(r.key);
                return (
                  <tr key={r.key}>
                    <td>{m && access.canSee(m) ? <button className="link" onClick={() => go('matter', m.id)}>{m.name}</button> : <span className="muted">🔒 Restricted matter</span>}{m && <div className="small muted">{m.number} · {m.status === 'closed' ? 'Former' : 'Open'}</div>}</td>
                    <td className="small">{m ? lookup.areaOf(m).name : ''}</td>
                    <td className="r num">{S.fmt(def.unit, r.value)}</td>
                    {def.field === 'ratio' && <td className="r num small muted">{Math.round(r.items * 10) / 10}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {byMatter.length === 0 && (def.src === 'consult' || def.src === 'reply') && <p className="panel-body small muted">{def.src === 'reply' ? 'Replies' : 'Consults'} are with prospects, so they're counted by practice area rather than by matter.{def.lowerIsBetter ? ' Slowest first.' : ''}</p>}
    </section>
  );
}

// ---------- One person's dashboard ----------

function Tile({ ctx, id, u, on, onClick }: { ctx: Ctx; id: string; u: UserAccess; on: boolean; onClick: () => void }) {
  const def = S.metric(id)!;
  const vals = trend(ctx, id, [u.userId]);
  const i = ctx.quarters.findIndex((x) => x.id === ctx.q.id);
  const v = vals[i];
  const goal = S.goalOf(u, id);
  const t = S.toneFor(def, v, goal, ctx.q);
  return (
    <button className={`tile tone-${t.tone} ${on ? 'on' : ''}`} onClick={onClick} aria-pressed={on}>
      <span className="spread"><span className="label">{def.label}</span>{t.tone !== 'none' && <span className={`dot tone-${t.tone}`} title={TONE_LABEL[t.tone]} />}</span>
      <span className="spread" style={{ alignItems: 'flex-end' }}>
        <span className="num tile-v">{S.fmt(def.unit, v)}</span>
        <Spark values={vals} />
      </span>
      {goal ? (
        <span className="bullet" aria-label={`${Math.round((t.share ?? 0) * 100)}% of goal`}>
          <span className={`bullet-fill tone-${t.tone}`} style={{ width: `${Math.min(100, (t.share ?? 0) * 100)}%` }} />
          {t.pace !== undefined && t.pace < 1 && <span className="bullet-pace" style={{ left: `${t.pace * 100}%` }} />}
        </span>
      ) : <span className="bullet" />}
      <span className="small muted">{goal ? `Goal ${def.lowerIsBetter ? 'under ' : ''}${S.fmt(def.unit, goal)}` : 'No goal set'} · <Delta now={v} prev={vals[i - 1]} def={def} q={ctx.q} /></span>
    </button>
  );
}

function PersonView({ ctx, uid }: { ctx: Ctx; uid: string }) {
  const { s, go, access } = useStore();
  const u = ctx.users.find((x) => x.userId === uid)!;
  const card = S.scorecardOf(u);
  const [sel, setSel] = useState<string>(card[0]);
  const selected = card.includes(sel) ? sel : card[0];
  const head = card[0];
  const def = head ? S.metric(head)! : undefined;
  const v = head ? ctx.scores.value(head, [uid], ctx.q) : undefined;
  const goal = head ? S.goalOf(u, head) : undefined;
  const t = def ? S.toneFor(def, v, goal, ctx.q) : { tone: 'none' as S.Tone };
  const expected = goal && def && !S.isRate(def) ? goal * S.elapsed(ctx.q) : undefined;
  const mine = s.tasks.filter((x) => x.assignee === uid && !x.done);
  const overdue = mine.filter((x) => new Date(x.due).getTime() < Date.now()).length;
  const awaiting = s.pncs.filter((p) => p.owner === uid && p.receivedAt && !p.firstReplyAt && p.stage !== 'lost').length;
  const dueToday = mine.filter((x) => x.due.slice(0, 10) === new Date().toISOString().slice(0, 10)).length;

  if (!def) return <p className="muted">No scorecard is set up for {teamName(uid)}. Pick metrics in Settings → Scorecards & goals.</p>;
  return (
    <div className="stack" style={{ gap: 16 }}>
      <section className="panel dash-hero">
        <div className="dash-hero-ring">
          <Ring share={t.share} pace={t.pace} tone={t.tone}>
            <span className="num ring-v">{S.fmt(def.unit, v, true)}</span>
            <span className="small muted">{goal ? `${def.lowerIsBetter ? 'goal under' : 'of'} ${S.fmt(def.unit, goal, true)}` : 'no goal'}</span>
          </Ring>
          <div className="stack" style={{ gap: 4 }}>
            <span className="label">{def.label} · {ctx.q.label}</span>
            <span className="hero num">{S.fmt(def.unit, v)}</span>
            {t.tone !== 'none' && <span className={`pill tone-${t.tone}`}>{TONE_LABEL[t.tone]}</span>}
            {expected !== undefined && S.elapsed(ctx.q) < 1 && <span className="small muted">Where you'd be on pace today: {S.fmt(def.unit, expected)}. The tick on the ring marks it.</span>}
            {S.elapsed(ctx.q) < 1 && <span className="small muted">{Math.round(S.elapsed(ctx.q) * 100)}% of the quarter gone</span>}
          </div>
        </div>
        <div className="stack" style={{ gap: 6, minWidth: 0 }}>
          <span className="label">Last five quarters{goal !== undefined && <span className="muted"> · dashed line = goal</span>}</span>
          <QuarterBars values={trend(ctx, head, [uid])} quarters={ctx.quarters} unit={def.unit} selected={ctx.q.id} onPick={ctx.setQ} goal={goal} />
        </div>
      </section>

      {uid === access.user && (
        <div className="row now-strip">
          <span className="label">Right now</span>
          <button className={`pill ${overdue ? 'tone-danger' : 'tone-ok'}`} onClick={() => go('tasks')}>{overdue} overdue task{overdue === 1 ? '' : 's'}</button>
          <button className="pill" onClick={() => go('tasks')}>{dueToday} due today</button>
          {awaiting > 0 && <button className="pill tone-warn" onClick={() => go('intake')}>{awaiting} new prospect{awaiting === 1 ? '' : 's'} waiting for a first reply</button>}
          <button className="btn sm ghost" onClick={() => go('today')}>Open Today →</button>
        </div>
      )}

      <div className="tiles">
        {card.map((id) => <Tile key={id} ctx={ctx} id={id} u={u} on={id === selected} onClick={() => setSel(id)} />)}
      </div>

      <Detail key={selected + uid} ctx={ctx} id={selected} people={[uid]} />
    </div>
  );
}

// ---------- Organization ----------

function OrgNode({ ctx, uid, visible, onOpen }: { ctx: Ctx; uid: string; visible: string[]; onOpen: (p: string) => void }) {
  const u = ctx.users.find((x) => x.userId === uid);
  if (!u) return null;
  const kids = S.directReports(ctx.users, uid).filter((k) => visible.includes(k) || S.orgOf(ctx.users, k).some((x) => visible.includes(x)));
  const head = S.scorecardOf(u)[0];
  const def = head ? S.metric(head) : undefined;
  const v = head ? ctx.scores.value(head, [uid], ctx.q) : undefined;
  const t = def ? S.toneFor(def, v, S.goalOf(u, head), ctx.q) : { tone: 'none' as S.Tone, share: undefined, pace: undefined };
  const team = TEAM.find((x) => x.id === uid);
  const others = S.scorecardOf(u).slice(1, 3);
  return (
    <li>
      {visible.includes(uid) ? (
        <button className={`org-card tone-${t.tone}`} onClick={() => onOpen(uid)}>
          <Ring share={t.share} pace={t.pace} tone={t.tone} size={52}><span className="small" style={{ fontWeight: 600 }}>{team?.initials}</span></Ring>
          <span className="stack" style={{ gap: 1, minWidth: 0, textAlign: 'left' }}>
            <strong>{uid === 'me' ? 'You' : teamName(uid)}</strong>
            <span className="small muted">{team?.role}{kids.length ? ` · leads ${S.orgOf(ctx.users, uid).length}` : ''}</span>
            {def && <span className="small"><span className="muted">{def.label}:</span> <span className="num">{S.fmt(def.unit, v)}</span> {t.tone !== 'none' && <span className={`dot tone-${t.tone}`} />}</span>}
            {others.length > 0 && <span className="small muted">{others.map((id) => `${S.metric(id)!.label} ${S.fmt(S.metric(id)!.unit, ctx.scores.value(id, [uid], ctx.q), true)}`).join(' · ')}</span>}
          </span>
          <span className="muted" aria-hidden>›</span>
        </button>
      ) : <div className="org-card muted">{teamName(uid)}</div>}
      {kids.length > 0 && <ul className="org">{kids.map((k) => <OrgNode key={k} ctx={ctx} uid={k} visible={visible} onOpen={onOpen} />)}</ul>}
    </li>
  );
}

const TEAM_METRICS = ['fees', 'hours', 'tasksDone', 'onTime', 'hires', 'closed', 'response'];
const OPTIONAL = ['fees', 'hires', 'closed', 'response']; // team tiles shown only when someone on the team is measured on them

function TeamView({ ctx, people, title, onOpen, top }: { ctx: Ctx; people: string[]; title: string; onOpen: (p: string) => void; top: string[] }) {
  const [sel, setSel] = useState('fees');
  const i = ctx.quarters.findIndex((x) => x.id === ctx.q.id);
  const metrics = TEAM_METRICS.filter((id) => people.some((p) => S.scorecardOf(ctx.users.find((u) => u.userId === p)!).includes(id) || !OPTIONAL.includes(id)));
  const selected = metrics.includes(sel) ? sel : metrics[0];
  // Everyone's headline as a share of their own goal, so different jobs sit on one chart.
  const vsGoal = people.map((p) => {
    const u = ctx.users.find((x) => x.userId === p)!;
    const head = S.scorecardOf(u)[0];
    const def = head ? S.metric(head) : undefined;
    const v = head ? ctx.scores.value(head, [p], ctx.q) : undefined;
    const goal = head ? S.goalOf(u, head) : undefined;
    return { p, def, v, goal, ...(def ? S.toneFor(def, v, goal, ctx.q) : { tone: 'none' as S.Tone }) };
  });
  const pace = S.elapsed(ctx.q);
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="tiles">
        {metrics.map((id) => {
          const def = S.metric(id)!;
          const vals = trend(ctx, id, people);
          return (
            <button key={id} className={`tile ${id === selected ? 'on' : ''}`} aria-pressed={id === selected} onClick={() => setSel(id)}>
              <span className="label">{title} · {def.label}</span>
              <span className="spread" style={{ alignItems: 'flex-end' }}><span className="num tile-v">{S.fmt(def.unit, vals[i])}</span><Spark values={vals} /></span>
              <span className="small muted"><Delta now={vals[i]} prev={vals[i - 1]} def={def} q={ctx.q} /></span>
            </button>
          );
        })}
      </div>

      <div className="grid cols-2">
        <section className="panel">
          <div className="panel-head"><h2>Organization</h2><span className="small muted">Click anyone to open their dashboard</span></div>
          <div className="panel-body"><ul className="org org-root">{top.map((r) => <OrgNode key={r} ctx={ctx} uid={r} visible={people} onOpen={onOpen} />)}</ul></div>
        </section>
        <section className="panel">
          <div className="panel-head"><h2>Against goal</h2><span className="small muted">Each person’s headline number · the line is where they should be today</span></div>
          <ul className="list">
            {vsGoal.map((r) => (
              <li key={r.p}>
                <button className="goal-row" onClick={() => onOpen(r.p)}>
                  <span className="stack" style={{ gap: 0, minWidth: 0 }}><strong className="small">{r.p === 'me' ? 'You' : teamName(r.p)}</strong><span className="small muted">{r.def?.label ?? 'No scorecard'}</span></span>
                  <span className="bullet big">
                    <span className={`bullet-fill tone-${r.tone}`} style={{ width: `${Math.min(100, (r.share ?? 0) * 100)}%` }} />
                    {r.def && !S.isRate(r.def) && pace < 1 && <span className="bullet-pace" style={{ left: `${pace * 100}%` }} />}
                    {r.def && S.isRate(r.def) && <span className="bullet-pace" style={{ left: '100%' }} />}
                  </span>
                  <span className="num small" style={{ textAlign: 'right' }}>{r.def ? S.fmt(r.def.unit, r.v, true) : '—'}<span className="muted">{r.goal ? ` / ${S.fmt(r.def!.unit, r.goal, true)}` : ''}</span></span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <Detail key={selected} ctx={ctx} id={selected} people={people} team onPerson={onOpen} />
    </div>
  );
}

// ---------- Screen ----------

export default function Dashboard() {
  const { s, access } = useStore();
  const quarters = useMemo(() => recentQuarters(5).reverse(), []);
  const [qid, setQ] = useState(quarters[quarters.length - 1].id);
  const q = quarters.find((x) => x.id === qid)!;
  const scores = useMemo(
    () => S.makeScores({ users: s.users, matters: s.matters, tasks: s.tasks, timeEntries: s.timeEntries, trustTxns: s.trustTxns, invoices: s.invoices, pncs: s.pncs, areaIds: s.areas.map((a) => a.id) }),
    [s.users, s.matters, s.tasks, s.timeEntries, s.trustTxns, s.invoices, s.pncs, s.areas],
  );
  const ctx: Ctx = { scores, quarters, q, setQ, users: s.users };

  const me = access.user;
  const firmWide = access.can('reports');
  const org = firmWide ? s.users.map((u) => u.userId).filter((x) => x !== me) : S.orgOf(s.users, me);
  const leader = org.length > 0;
  const people = [me, ...org];
  const top = firmWide ? S.roots(s.users) : [me];
  const [view, setView] = useState<'me' | 'team'>(leader ? 'team' : 'me');
  const [who, setWho] = useState<string | null>(null);
  const mode = !leader ? 'me' : who ? 'person' : view;
  const teamTitle = firmWide ? 'Firm' : 'Team';

  const title = mode === 'person' ? (who === me ? 'Your dashboard' : `${teamName(who!)}’s dashboard`) : mode === 'team' ? `${greeting()}${me === 'me' ? '' : `, ${first(me)}`} · ${firmWide ? 'the firm' : 'your team'}` : `${greeting()}${me === 'me' ? '' : `, ${first(me)}`}`;
  const role = (id: string) => TEAM.find((t) => t.id === id)?.role;

  return (
    <>
      <div className="page-head dash-head">
        <div className="stack" style={{ gap: 2, minWidth: 0 }}>
          {mode === 'person' && (
            <nav className="crumbs small" aria-label="Drill-down">
              <button className="link" onClick={() => setWho(null)}>{teamTitle}</button><span className="muted">›</span><strong>{who === 'me' ? 'You' : teamName(who!)}</strong>
            </nav>
          )}
          <h1>{title}</h1>
          <p className="muted small">
            {mode === 'team' ? `${people.length} people · ${q.label}` : `${role(who ?? me) ?? ''} · ${q.label}`}
            {S.elapsed(q) < 1 ? ` · ${Math.round(S.elapsed(q) * 100)}% of the quarter gone` : ''}
          </p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {leader && (
            <div className="seg" role="group" aria-label="Dashboard view">
              <button aria-pressed={mode === 'me' || (mode === 'person' && who === me)} onClick={() => { setWho(null); setView('me'); }}>Mine</button>
              <button aria-pressed={mode === 'team' || (mode === 'person' && who !== me)} onClick={() => { setWho(null); setView('team'); }}>{teamTitle}</button>
            </div>
          )}
          <select className="input" style={{ width: 'auto' }} id="dash-q" aria-label="Quarter" value={qid} onChange={(e) => setQ(e.target.value)}>
            {[...quarters].reverse().map((x, i) => <option key={x.id} value={x.id}>{x.label}{i === 0 ? ' (to date)' : ''}</option>)}
          </select>
        </div>
      </div>

      {mode === 'me' && <PersonView key={me} ctx={ctx} uid={me} />}
      {mode === 'person' && <PersonView key={who!} ctx={ctx} uid={who!} />}
      {mode === 'team' && <TeamView ctx={ctx} people={people} title={teamTitle} top={top} onOpen={(p) => setWho(p)} />}

      <p className="small muted" style={{ marginTop: 16 }}>
        Earlier quarters use generated sample history, standing in for what an import from Monday and Clio would bring in. Fees are credited to the originating attorney when the client pays.
      </p>
    </>
  );
}
