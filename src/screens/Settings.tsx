import { useStore } from '../store';
import { INCREMENT_OPTIONS, type RoundingMode } from '../billing';
import { PageHead } from '../ui';

const INTEGRATIONS = [
  { name: 'Phone system (VoIP)', detail: 'RingCentral, Zoom Phone, 8x8, Dialpad. Caller ID matched to clients, click-to-call, calls logged as time.', status: 'Planned' },
  { name: 'Calendar', detail: 'Google and Microsoft 365, two-way sync. Your availability for booking links comes from here.', status: 'Planned' },
  { name: 'Email', detail: 'Gmail and Outlook. File an email thread to a matter in one click.', status: 'Planned' },
  { name: 'Payments', detail: 'Card and ACH with trust vs. operating account separation (IOLTA-safe).', status: 'Planned' },
  { name: 'E-signature', detail: 'Engagement letters and documents signed inside the client portal.', status: 'Planned' },
  { name: 'Accounting', detail: 'QuickBooks Online sync for invoices and payments.', status: 'Later' },
];

export default function Settings() {
  const { s, actions } = useStore();
  return (
    <>
      <PageHead title="Settings" sub="Firm-wide rules. Change them here and every screen follows." />
      <div className="grid cols-2">
        <section className="panel">
          <div className="panel-head"><h2>Billing increments</h2></div>
          <div className="panel-body stack">
            <div className="field">
              <label htmlFor="inc">Bill time in increments of</label>
              <select className="input" id="inc" value={s.billing.incrementMinutes} onChange={(e) => actions.setBilling({ incrementMinutes: Number(e.target.value) })}>
                {INCREMENT_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n} minutes{n === 6 ? ' (tenth of an hour)' : n === 15 ? ' (quarter hour)' : ''}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="mode">Rounding</label>
              <select className="input" id="mode" value={s.billing.mode} onChange={(e) => actions.setBilling({ mode: e.target.value as RoundingMode })}>
                <option value="up">Always round up</option>
                <option value="nearest">Round to nearest</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="min">Minimum charge per entry</label>
              <select className="input" id="min" value={s.billing.minimumMinutes} onChange={(e) => actions.setBilling({ minimumMinutes: Number(e.target.value) })}>
                {[0, 6, 12, 15].map((n) => <option key={n} value={n}>{n === 0 ? 'None' : `${n} minutes`}</option>)}
              </select>
            </div>
            <p className="small muted">Later, these can be overridden per client or per matter, for example when an engagement letter specifies quarter-hour billing.</p>
          </div>
        </section>
        <section className="panel">
          <div className="panel-head"><h2>Integrations</h2></div>
          <ul className="list">
            {INTEGRATIONS.map((i) => (
              <li key={i.name} className="spread" style={{ alignItems: 'flex-start' }}>
                <span><strong>{i.name}</strong><div className="small muted">{i.detail}</div></span>
                <span className={`pill ${i.status === 'Planned' ? 'info' : ''}`}>{i.status}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
