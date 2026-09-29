import { useState } from 'react';
import { useStore } from '../store';
import { TEAM, teamName } from '../data';
import { money } from '../billing';
import { recentQuarters, statsFor, type Quarter, type Stats } from '../metrics';
import { PageHead } from '../ui';

type Measure = 'fixed' | 'hourly' | 'both';
const headline = (s: Stats, m: Measure) => (m === 'hourly' ? s.collected : m === 'fixed' ? s.paid : s.paid + s.collected);
const headlineLabel = (m: Measure) => (m === 'hourly' ? 'Collected' : m === 'fixed' ? 'Fees brought in (paid)' : 'Brought in + collected');
const k = (n: number) => (n >= 1000 ? `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : money(n));

/** Five-quarter trend of the headline number. One series, so one hue and no legend. */
function Trend({ values, quarters, selected, onPick }: { values: number[]; quarters: Quarter[]; selected: string; onPick: (id: string) => void }) {
  const max = Math.max(1, ...values);
  const H = 64;
  return (
    <div className="trend" role="img" aria-label={`Trend: ${quarters.map((q, i) => `${q.label} ${money(values[i])}`).join(', ')}`}>
      {quarters.map((q, i) => {
        const h = Math.max(2, Math.round((values[i] / max) * H));
        return (
          <button key={q.id} className={`trend-col ${q.id === selected ? 'on' : ''}`} onClick={() => onPick(q.id)} title={`${q.label}: ${money(values[i])}`}>
            <span className="trend-val num">{k(values[i])}</span>
            <span className="trend-bar" style={{ height: h }} />
            <span className="trend-q">{q.label.split(' ')[0]}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function Performance() {
  const { s, access, go } = useStore();
  const quarters = recentQuarters(5).reverse(); // oldest → newest
  const [qid, setQid] = useState(quarters[quarters.length - 1].id);
  const q = quarters.find((x) => x.id === qid)!;
  const attorneys = TEAM.filter((t) => s.users.find((u) => u.userId === t.id)?.measure).filter((t) => access.can('reports') || t.id === access.user);
  const [open, setOpen] = useState<string | null>(null);

  return (
    <>
      <PageHead title="Attorney performance" sub="Credited to the originating attorney. Fixed-price work is measured by fees brought in (paid is the headline; signed is shown alongside). Hourly work is measured by billed and collected.">
        <select className="input" style={{ width: 'auto' }} id="perf-q" aria-label="Quarter" value={qid} onChange={(e) => setQid(e.target.value)}>
          {[...quarters].reverse().map((x, i) => <option key={x.id} value={x.id}>{x.label}{i === 0 ? ' (to date)' : ''}</option>)}
        </select>
      </PageHead>

      {attorneys.length === 0 && <p className="muted">No attorneys are set up for performance tracking. Set “Measured on” in Settings → Users & permissions.</p>}

      {attorneys.map((t) => {
        const u = s.users.find((x) => x.userId === t.id)!;
        const measure = (u.measure ?? 'both') as Measure;
        const st = statsFor(t.id, q, s.matters, s.trustTxns, s.invoices);
        const trend = quarters.map((qq) => headline(statsFor(t.id, qq, s.matters, s.trustTxns, s.invoices), measure));
        const h = headline(st, measure);
        const pct = u.goal ? Math.min(100, Math.round((h / u.goal) * 100)) : 0;
        const rate = st.billed ? Math.round((st.collected / st.billed) * 100) : undefined;
        return (
          <section key={t.id} className="panel">
            <div className="panel-head">
              <h2>{t.id === 'me' ? 'You' : t.name} <span className="small muted">· {t.role} · measured on {measure === 'both' ? 'fixed-price and hourly' : measure === 'fixed' ? 'fixed-price fees' : 'hourly billing'}</span></h2>
              <span className="small muted">{q.label}</span>
            </div>
            <div className="panel-body perf">
              <div className="stack" style={{ gap: 6, minWidth: 0 }}>
                <span className="label">{headlineLabel(measure)}</span>
                <span className="hero num">{money(h)}</span>
                {u.goal ? (
                  <>
                    <div className="goal" aria-label={`${pct}% of goal`}><span style={{ width: `${pct}%` }} /></div>
                    <span className="small muted">{pct}% of the {money(u.goal)} quarterly goal</span>
                  </>
                ) : <span className="small muted">No goal set</span>}
              </div>
              <div className="perf-grid">
                {(measure !== 'hourly') && <div><span className="label">Paid</span><span className="num v2">{money(st.paid)}</span></div>}
                {(measure !== 'hourly') && <div><span className="label">Signed</span><span className="num v2">{money(st.signed)}</span></div>}
                {(measure !== 'fixed') && <div><span className="label">Billed</span><span className="num v2">{money(st.billed)}</span></div>}
                {(measure !== 'fixed') && <div><span className="label">Collected</span><span className="num v2">{money(st.collected)}{rate !== undefined && <span className="small muted"> · {rate}%</span>}</span></div>}
              </div>
              <Trend values={trend} quarters={quarters} selected={qid} onPick={setQid} />
            </div>
            <div className="panel-body" style={{ paddingTop: 0 }}>
              <button className="btn sm ghost" onClick={() => setOpen(open === t.id ? null : t.id)}>{open === t.id ? 'Hide' : 'Show'} the {st.matters.length} matter{st.matters.length === 1 ? '' : 's'} behind these numbers</button>
            </div>
            {open === t.id && (
              <div className="table-wrap">
                <table className="t">
                  <thead><tr><th>Matter</th><th className="r">Paid</th><th className="r">Signed</th><th className="r">Billed</th><th className="r">Collected</th></tr></thead>
                  <tbody>
                    {st.matters.map((r) => (
                      <tr key={r.matter.id}>
                        <td>{access.canSee(r.matter) ? <button className="link" onClick={() => go('matter', r.matter.id)}>{r.matter.name}</button> : <span className="muted">🔒 Restricted matter</span>}<div className="small muted">{r.matter.status === 'closed' ? 'Former' : 'Open'} · responsible: {teamName(r.matter.owner)}</div></td>
                        <td className="r num">{r.paid ? money(r.paid) : '—'}</td>
                        <td className="r num">{r.signed ? money(r.signed) : '—'}</td>
                        <td className="r num">{r.billed ? money(r.billed) : '—'}</td>
                        <td className="r num">{r.collected ? money(r.collected) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
      <p className="small muted">“Paid” counts money received for fixed-price matters, whether deposited to trust or paid directly. It’s credited when the client pays, not when the fee is drawn from trust.</p>
    </>
  );
}
