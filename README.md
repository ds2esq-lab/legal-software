# Docket (working name)

One system for running a law firm: the best parts of Clio, Lawmatics, Monday.com, Calendly and Slack, plus reminders that actually work. The matter is the center of everything; time, bills, tasks, messages, documents, calls and deadlines all hang off it.

This is a **clickable prototype** with sample data held in memory. There is no backend yet.

## What's in the prototype

| Area | What it shows |
|---|---|
| Today | One queue of everything dated: late milestones, suspense dates, contact follow-ups, deadlines |
| PNC matters | One record per prospect from first call to hired, with a recorded conflict check; the system schedules every follow-up touch |
| Contacts | Every person and organization stored once, attached to any number of PNC and Client matters with a role on each |
| Conflict check | Searches every contact on every PNC, open and former matter (names, former names, phones, emails) and flags opposite-side matches |
| Client matters | Open matters and former clients. A board per practice area with that area's own stages; table view with inline Whose Ball and suspense dates |
| Matter page | People and roles, notes, Whose Ball, last contact, suspense date, milestone timeline with editable due dates, closeout checklist |
| Time & billing | Hourly, fixed-price and hybrid matters; configurable rounding (6-minute default) |
| Scheduling | Calendly-style booking links; bookings create leads, events and conflict checks |
| Tasks | Owner, due date, checklist, nudges that escalate to a backup after three snoozes; court and statute deadlines can't be snoozed; stage tasks created automatically |
| Calendar | Meetings, consults and court deadlines in one week view |
| Messages | Firm channels plus a thread per matter; team-only vs client-visible |
| Phone | Simulated VoIP: caller matched to matter, calls turned into time entries |
| Client portal | What the client sees: status, messages, shared documents, invoices |

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
