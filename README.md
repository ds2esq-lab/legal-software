# Docket (working name)

One system for running a law firm: the best parts of Clio, Lawmatics, Monday.com, Calendly and Slack, plus reminders that actually work. The matter is the center of everything; time, bills, tasks, messages, documents, calls and deadlines all hang off it.

This is a **clickable prototype** with sample data held in memory. There is no backend yet.

## What's in the prototype

| Area | What it shows |
|---|---|
| Dashboard | The first screen after sign-in. Each person's own scorecard (metrics chosen for their role, with goals, pace against the quarter and a five-quarter trend). Leaders also see their organization — org chart, team totals, everyone against goal — and drill from the firm to a person, to a metric, to the matters behind it. Metrics include matters closed and response time to new prospects (business hours from inquiry to first reply, skipping weekends, federal holidays, the day after Thanksgiving and other closed days set in Settings › Office hours). Set up in Settings › Scorecards & goals |
| Today | One queue of everything dated: late milestones, suspense dates, contact follow-ups, deadlines |
| PNC matters | One record per prospect from first call to hired, with a recorded conflict check; the system schedules every follow-up touch |
| Contacts | Every person and organization stored once, attached to any number of PNC and Client matters with a role on each |
| Conflict check | Searches every contact on every PNC, open and former matter (names, former names, phones, emails) and flags opposite-side matches |
| Client matters | Open matters and former clients. A board per practice area with that area's own stages; table view with inline Whose Ball and suspense dates |
| Matter page | People and roles, notes, Whose Ball, last contact, suspense date, milestone timeline with editable due dates, closeout checklist |
| Time & billing | Hourly, fixed-price and hybrid matters; configurable rounding (6-minute default) |
| Scheduling | Meeting types defined once for many hosts and locations; per-person availability schedules; routing form; bookings create PNC matters or attach to Client matters, and a held meeting completes its milestone |
| Documents | Each matter's SharePoint folder, created from a per-practice-area template and shown inside the matter; share to the portal, request e-signature, versions; matters grouped under a “Last, First” client folder like today's OneDrive; a OneDrive-to-SharePoint move plan in Settings › Documents |
| Tasks | Owner, due date, checklist, nudges that escalate to a backup after three snoozes; court and statute deadlines can't be snoozed; stage tasks created automatically |
| Calendar | Meetings, consults and court deadlines in one week view |
| Messages | Firm channels plus a thread per matter; team-only vs client-visible |
| Phone | Simulated VoIP: caller matched to matter, calls turned into time entries |
| Client portal | What the client sees: status, messages, shared documents, invoices |

## Trust accounting (IOLTA)

A ledger per client that can never go negative; money out of trust needs approval; fixed-price fees stay in trust and are drawn when the milestones in each practice area's earning schedule are done; hourly invoices can be paid from trust; evergreen retainers send replenishment requests automatically; expenses are billed when the firm advances them or paid from trust. A read-only bank feed (simulated M&T) is matched line by line, and the monthly three-way reconciliation and quarterly client-ledger review follow Virginia Rule 1.15(d). The software records and approves; money moves at the bank.

## Permissions

Roles (editable) grant permissions such as intake, Client matters, billing, invoices, payments and settings. Each person also gets the practice areas they can see, and any matter can be restricted to named people (an ethical wall). Conflict checks still search walled matters but show them only as "Restricted matter". Use **Viewing as** in the top bar to preview anyone's view.

## Configurable, not hard-coded

Practice areas, their stages, milestones, deadline rules ("Drafts due 5 workdays after questionnaire"), contact timers and intake cadences are all edited in **Settings**. Any matter can override a computed due date.

## Run it

```bash
npm install
npm run dev        # local dev server
npm run typecheck
npm run build      # produces a single self-contained dist/index.html
```

## Code layout

- `src/practice.ts`: practice-area configuration and the due-date engine
- `src/intake.ts`: intake follow-up cadences
- `src/data.ts`: domain model and sample data
- `src/billing.ts`: billing increment and rounding rules (pure functions)
- `src/store.tsx`: in-memory app state and actions
- `src/screens/`: one file per screen
