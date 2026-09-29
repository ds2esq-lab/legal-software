# Docket (working name)

One system for running a law firm: the best parts of Clio, Lawmatics, Monday.com, Calendly and Slack, plus reminders that actually work. The matter is the center of everything; time, bills, tasks, messages, documents, calls and deadlines all hang off it.

This is a **clickable prototype** with sample data held in memory. There is no backend yet.

## What's in the prototype

| Area | What it shows |
|---|---|
| Today | Overdue and upcoming deadlines, today's schedule, unbilled work |
| Matters | Kanban board by stage (drag to move) that switches to a Monday-style table |
| Matter page | Stage progress, deadlines, activity, time, draft invoice, messages, documents |
| Time & billing | Hourly, flat-fee and hybrid matters; configurable rounding (6-minute default) |
| Scheduling | Calendly-style booking links; bookings create leads, events and conflict checks |
| Reminders | Owner, nudge schedule, limited snoozes, escalation to a backup person |
| Calendar | Meetings, consults and court deadlines in one week view |
| Messages | Firm channels plus a thread per matter; team-only vs client-visible |
| Phone | Simulated VoIP: caller matched to matter, calls turned into time entries |
| Client portal | What the client sees: status, messages, shared documents, invoices |

## Run it

```bash
npm install
npm run dev        # local dev server
npm run typecheck
npm run build      # produces a single self-contained dist/index.html
```

## Code layout

- `src/data.ts`: domain model and sample data
- `src/billing.ts`: billing increment and rounding rules (pure functions)
- `src/store.tsx`: in-memory app state and actions
- `src/screens/`: one file per screen
