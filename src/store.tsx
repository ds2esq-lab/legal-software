import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as seed from './data';
import type { Invoice, InvoiceLine, Perm, PermRole, UserAccess } from './data';
import * as trust from './trust';
import * as sched from './sched';
import * as docs from './docs';
import type { DocFile, DocSettings } from './docs';
import type { Booking, MeetingType, RoutingForm, Schedule } from './sched';
import type { BankTxn, Expense, Reconciliation, Replenishment, TrustTxn } from './trust';
import type { CalEvent, CallLog, Cadences, ConflictCheck, Contact, Matter, Message, Note, Party, Pnc, Role, Task, TimeEntry } from './data';
import { billedMinutes, DEFAULT_BILLING, type BillingSettings } from './billing';
import { addDays, addWorkdays, DEFAULT_AREAS, DEFAULT_NUMBERING, nextNumber, type Numbering, newId, slug, todayISO, type MilestoneState, type PracticeArea } from './practice';

export type Screen =
  | 'home'
  | 'today'
  | 'intake'
  | 'matters'
  | 'matter'
  | 'pnc'
  | 'contacts'
  | 'contact'
  | 'conflicts'
  | 'time'
  | 'calendar'
  | 'scheduling'
  | 'tasks'
  | 'trust'
  | 'messages'
  | 'phone'
  | 'portal'
  | 'settings';

interface Timer {
  matterId: string;
  description: string;
  startedAt: number;
}

interface ActiveCall {
  contact: string;
  number: string;
  matterId?: string;
  startedAt: number;
}

interface State {
  areas: PracticeArea[];
  cadences: Cadences;
  matters: Matter[];
  pncs: Pnc[];
  contacts: Contact[];
  roles: Role[];
  permRoles: PermRole[];
  users: UserAccess[];
  viewAs: string;
  numbering: Numbering;
  trustTxns: TrustTxn[];
  bankTxns: BankTxn[];
  replenishments: Replenishment[];
  expenses: Expense[];
  reconciliations: Reconciliation[];
  meetingTypes: MeetingType[];
  schedules: Schedule[];
  routing: RoutingForm;
  bookings: Booking[];
  docSettings: DocSettings;
  docFiles: DocFile[];
  docFolders: Record<string, string[]>; // extra folders added per matter
  timeEntries: TimeEntry[];
  flatFees: seed.FlatFee[];
  invoices: Invoice[];
  tasks: Task[];
  events: CalEvent[];
  messages: Message[];
  calls: CallLog[];
  eventTypes: seed.EventType[];
  billing: BillingSettings;
  timer: Timer | null;
  activeCall: ActiveCall | null;
}

// Firm settings survive a reload in this browser. Matter data is sample data and resets.
const CONFIG_KEY = 'docket.config.v11';
function loadConfig(): Partial<Pick<State, 'areas' | 'cadences' | 'billing' | 'roles' | 'permRoles' | 'users' | 'numbering' | 'meetingTypes' | 'schedules' | 'routing' | 'docSettings'>> {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function initialState(): State {
  const cfg = loadConfig();
  return {
    areas: (cfg.areas ?? DEFAULT_AREAS).map((a) => ({ ...a, stageTasks: a.stageTasks ?? [], feeSchedule: a.feeSchedule ?? [] })),
    cadences: cfg.cadences ?? seed.DEFAULT_CADENCES,
    billing: cfg.billing ?? DEFAULT_BILLING,
    matters: seed.matters,
    pncs: seed.pncs,
    contacts: seed.contacts,
    roles: cfg.roles ?? seed.DEFAULT_ROLES,
    permRoles: cfg.permRoles ?? seed.DEFAULT_PERM_ROLES,
    users: cfg.users ?? seed.DEFAULT_USERS,
    viewAs: 'me',
    numbering: cfg.numbering ?? DEFAULT_NUMBERING,
    trustTxns: trust.trustTxns,
    bankTxns: trust.bankTxns,
    replenishments: trust.replenishments,
    expenses: trust.expenses,
    reconciliations: trust.reconciliations,
    meetingTypes: cfg.meetingTypes ?? sched.MEETING_TYPES,
    schedules: cfg.schedules ?? sched.SCHEDULES,
    routing: cfg.routing ?? sched.ROUTING,
    bookings: [],
    docSettings: { ...docs.DEFAULT_DOC_SETTINGS, ...cfg.docSettings },
    docFiles: docs.DOC_FILES,
    docFolders: {},
    timeEntries: seed.timeEntries,
    flatFees: seed.flatFees,
    invoices: seed.invoices,
    tasks: seed.tasks,
    events: seed.events,
    messages: seed.messages,
    calls: seed.calls,
    eventTypes: seed.eventTypes,
    timer: null,
    activeCall: null,
  };
}

export type Target = { kind: 'matter' | 'pnc'; id: string };

/** Tasks a practice area creates when a matter enters a stage. Skips ones already open on the matter. */
function stageTasksFor(m: Matter, area: PracticeArea, stageId: string, existing: Task[]): Task[] {
  const today = todayISO();
  return area.stageTasks
    .filter((t) => t.stageId === stageId)
    .filter((t) => !existing.some((e) => e.matterId === m.id && !e.done && e.title === t.title))
    .map((t) => {
      const assignee = t.assignTo === 'owner' ? m.owner : t.assignTo === 'ball' ? (['client', 'third', 'court'].includes(m.ball) ? m.owner : m.ball) : t.assignTo;
      const dueDay = t.dueUnit === 'workdays' ? addWorkdays(today, t.dueIn) : addDays(today, t.dueIn);
      return {
        id: newId('task'),
        title: t.title,
        matterId: m.id,
        due: new Date(dueDay + 'T17:00:00').toISOString(),
        assignee,
        escalateTo: assignee === 'me' ? undefined : 'me',
        kind: t.kind,
        status: 'todo' as const,
        done: false,
        snoozes: 0,
        log: [`Created automatically when the matter moved to ${area.stages.find((x) => x.id === stageId)?.name}`],
        checklist: t.checklist.map((text) => ({ text, done: false })),
        source: 'stage' as const,
        createdAt: new Date().toISOString(),
      };
    });
}

/** Outflow request, refused if it would take the client below zero (counting pending outflows). */
function requestOut(x: State, t: Omit<TrustTxn, 'id' | 'status' | 'date'> & { date?: string }): { x: State; ok: boolean } {
  if (t.amount <= 0 || t.amount > trust.availableOf(t.matterId, x.trustTxns) + 0.001) return { x, ok: false };
  const txn: TrustTxn = { ...t, id: newId('tt'), date: t.date ?? todayISO(), status: 'pending' };
  return { x: { ...x, trustTxns: [...x.trustTxns, txn] }, ok: true };
}

/** After money leaves trust on an evergreen retainer, ask the client to top it back up. */
function maybeReplenish(x: State, matterId: string): State {
  const m = x.matters.find((q) => q.id === matterId);
  if (!m?.retainer) return x;
  const bal = trust.balanceOf(matterId, x.trustTxns);
  if (bal >= m.retainer.minimum || x.replenishments.some((r) => r.matterId === matterId && r.status === 'sent')) return x;
  const req: Replenishment = { id: newId('rp'), matterId, date: todayISO(), amount: trust.round(m.retainer.target - bal), status: 'sent' };
  return { ...x, replenishments: [...x.replenishments, req] };
}

/** Fixed-price matter: a milestone that earns part of the fee queues a draw for approval. */
function maybeDraw(x: State, matterId: string, milestoneId: string, by: string): State {
  const m = x.matters.find((q) => q.id === matterId);
  const area = m && x.areas.find((a) => a.id === m.areaId);
  if (!m || !area || m.billing.kind === 'hourly') return x;
  const rule = area.feeSchedule.find((f) => f.milestoneId === milestoneId);
  if (!rule) return x;
  if (x.trustTxns.some((t) => t.matterId === matterId && t.milestoneId === milestoneId && t.status !== 'rejected')) return x;
  const fee = m.billing.amount;
  const amount = Math.min(trust.round((fee * rule.percent) / 100), trust.availableOf(matterId, x.trustTxns));
  if (amount <= 0) return x;
  const msName = area.milestones.find((q) => q.id === milestoneId)?.name ?? milestoneId;
  return requestOut(x, { matterId, kind: 'draw', amount, memo: `Earned ${rule.percent}% on ${msName}`, method: 'transfer', requestedBy: by, milestoneId }).x;
}

function useStoreValue() {
  const [s, setS] = useState<State>(initialState);
  const [screen, setScreen] = useState<Screen>('home');
  const [matterId, setMatterId] = useState<string>('m1');
  const [pncId, setPncId] = useState<string>('p1');
  const [contactId, setContactId] = useState<string>('c1');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify({ areas: s.areas, cadences: s.cadences, billing: s.billing, roles: s.roles, permRoles: s.permRoles, users: s.users, numbering: s.numbering, meetingTypes: s.meetingTypes, schedules: s.schedules, routing: s.routing, docSettings: s.docSettings }));
    } catch {
      /* storage unavailable: settings last for this visit only */
    }
  }, [s.areas, s.cadences, s.billing, s.roles, s.permRoles, s.users, s.numbering, s.meetingTypes, s.schedules, s.routing, s.docSettings]);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 3400);
  }, []);

  /** Navigate. The id is a matter, PNC or contact id depending on the screen. */
  const go = useCallback((sc: Screen, id?: string) => {
    if (id && (sc === 'matter' || sc === 'portal')) setMatterId(id);
    if (id && sc === 'pnc') setPncId(id);
    if (id && sc === 'contact') setContactId(id);
    setScreen(sc);
    window.scrollTo({ top: 0 });
  }, []);

  const actions = useMemo(() => {
    const patchMatter = (id: string, f: (m: Matter) => Matter) =>
      setS((x) => ({ ...x, matters: x.matters.map((m) => (m.id === id ? f(m) : m)) }));

    return {
      // ----- Matters -----
      updateMatter(id: string, patch: Partial<Matter>) {
        patchMatter(id, (m) => ({ ...m, ...patch }));
      },
      /** Change stage and create that stage's tasks. Returns via state; the count is reported by the caller. */
      moveStage(id: string, stageId: string) {
        setS((x) => {
          const m = x.matters.find((q) => q.id === id);
          const area = m && x.areas.find((a) => a.id === m.areaId);
          if (!m || !area || m.stageId === stageId) return x;
          const moved = { ...m, stageId };
          return { ...x, matters: x.matters.map((q) => (q.id === id ? moved : q)), tasks: [...x.tasks, ...stageTasksFor(moved, area, stageId, x.tasks)] };
        });
      },
      setMilestone(id: string, milestoneId: string, patch: Partial<MilestoneState>) {
        if (patch.done) setS((x) => maybeDraw(x, id, milestoneId, x.viewAs));
        patchMatter(id, (m) => {
          const cur: MilestoneState = { ...m.milestones[milestoneId], ...patch };
          if (!cur.done) delete cur.done;
          if (!cur.due) delete cur.due;
          return { ...m, milestones: { ...m.milestones, [milestoneId]: cur } };
        });
      },
      logContact(id: string) {
        patchMatter(id, (m) => ({ ...m, lastContact: todayISO() }));
      },
      /** Former clients: the matter leaves the active board but stays searchable forever. */
      closeMatter(id: string) {
        setS((x) => ({
          ...x,
          matters: x.matters.map((m) => {
            if (m.id !== id) return m;
            const area = x.areas.find((a) => a.id === m.areaId);
            const closedMs = area?.milestones[area.milestones.length - 1];
            const milestones = closedMs && !m.milestones[closedMs.id]?.done ? { ...m.milestones, [closedMs.id]: { done: todayISO() } } : m.milestones;
            return { ...m, status: 'closed', closedOn: todayISO(), milestones, stageId: area?.stages[area.stages.length - 1].id ?? m.stageId };
          }),
        }));
      },
      reopenMatter(id: string) {
        patchMatter(id, (m) => ({ ...m, status: 'open', closedOn: undefined }));
      },

      // ----- Contacts, parties, notes -----
      addContact(c: Omit<Contact, 'id' | 'notes'>): string {
        const id = newId('ct');
        setS((x) => ({ ...x, contacts: [...x.contacts, { ...c, id, notes: [] }] }));
        return id;
      },
      updateContact(id: string, patch: Partial<Contact>) {
        setS((x) => ({ ...x, contacts: x.contacts.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
      },
      setParties(target: Target, f: (p: Party[]) => Party[]) {
        setS((x) =>
          target.kind === 'matter'
            ? { ...x, matters: x.matters.map((m) => (m.id === target.id ? { ...m, parties: f(m.parties) } : m)) }
            : { ...x, pncs: x.pncs.map((p) => (p.id === target.id ? { ...p, parties: f(p.parties) } : p)) },
        );
      },
      addNote(target: Target | { kind: 'contact'; id: string }, text: string, author = 'me') {
        const n: Note = { id: newId('n'), at: new Date().toISOString(), author, text };
        const add = <T extends { id: string; notes: Note[] }>(arr: T[]) => arr.map((e) => (e.id === target.id ? { ...e, notes: [n, ...e.notes] } : e));
        setS((x) =>
          target.kind === 'matter' ? { ...x, matters: add(x.matters) } : target.kind === 'pnc' ? { ...x, pncs: add(x.pncs) } : { ...x, contacts: add(x.contacts) },
        );
      },
      togglePin(target: Target | { kind: 'contact'; id: string }, noteId: string) {
        const flip = <T extends { id: string; notes: Note[] }>(arr: T[]) =>
          arr.map((e) => (e.id === target.id ? { ...e, notes: e.notes.map((n) => (n.id === noteId ? { ...n, pinned: !n.pinned } : n)) } : e));
        setS((x) =>
          target.kind === 'matter' ? { ...x, matters: flip(x.matters) } : target.kind === 'pnc' ? { ...x, pncs: flip(x.pncs) } : { ...x, contacts: flip(x.contacts) },
        );
      },
      /** Attach a conflict check report to a PNC matter or Client matter (newest first). */
      recordConflict(target: Target, check: Omit<ConflictCheck, 'id'>) {
        const c: ConflictCheck = { ...check, id: newId('cc') };
        setS((x) =>
          target.kind === 'pnc'
            ? { ...x, pncs: x.pncs.map((p) => (p.id === target.id ? { ...p, conflicts: [c, ...p.conflicts], stage: c.result === 'conflict' ? 'declined' : p.stage } : p)) }
            : { ...x, matters: x.matters.map((m) => (m.id === target.id ? { ...m, conflicts: [c, ...m.conflicts] } : m)) },
        );
      },
      setNumbering(numbering: Numbering) {
        setS((x) => ({ ...x, numbering }));
      },
      setViewAs(userId: string) {
        setS((x) => ({ ...x, viewAs: userId }));
      },
      setPermRoles(permRoles: PermRole[]) {
        setS((x) => ({ ...x, permRoles }));
      },
      setUsers(users: UserAccess[]) {
        setS((x) => ({ ...x, users }));
      },
      setRestricted(matterId: string, restrictedTo: string[] | undefined) {
        setS((x) => ({ ...x, matters: x.matters.map((m) => (m.id === matterId ? { ...m, restrictedTo } : m)) }));
      },
      setRoles(roles: Role[]) {
        setS((x) => ({ ...x, roles }));
      },

      // ----- Practice areas (settings) -----
      saveArea(area: PracticeArea) {
        setS((x) => ({ ...x, areas: x.areas.map((a) => (a.id === area.id ? area : a)) }));
      },
      addArea(name: string): string {
        const id = `${slug(name)}-${Date.now().toString(36)}`;
        const area: PracticeArea = {
          id,
          name,
          planLabel: 'Type',
          planTypes: [],
          stages: [
            { id: 'info-gathering', name: 'Info Gathering' },
            { id: 'in-progress', name: 'In Progress' },
            { id: 'ready-to-close', name: 'Ready to Close' },
            { id: 'closeout', name: 'Closeout' },
          ],
          milestones: [
            { id: 'engaged', name: 'Engaged' },
            { id: 'closed', name: 'Closed' },
          ],
          cadence: { soon: 10, followUp: 14 },
          stageTasks: [],
          feeSchedule: [],
        };
        setS((x) => ({ ...x, areas: [...x.areas, area] }));
        return id;
      },
      deleteArea(id: string) {
        setS((x) => (x.matters.some((m) => m.areaId === id) ? x : { ...x, areas: x.areas.filter((a) => a.id !== id) }));
      },
      resetAreas() {
        setS((x) => ({ ...x, areas: DEFAULT_AREAS, cadences: seed.DEFAULT_CADENCES }));
      },
      setCadences(c: Cadences) {
        setS((x) => ({ ...x, cadences: c }));
      },

      // ----- Intake -----
      updatePnc(id: string, patch: Partial<Pnc>) {
        setS((x) => ({ ...x, pncs: x.pncs.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
      },
      markTouch(id: string, key: string) {
        setS((x) => ({ ...x, pncs: x.pncs.map((p) => (p.id === id ? { ...p, touches: { ...p.touches, [key]: todayISO() }, firstReplyAt: p.firstReplyAt ?? (p.receivedAt ? new Date().toISOString() : undefined) } : p)) }));
      },
      /** New PNC matter. Pass an existing contact id, or new contact details to create one. */
      addPnc(p: Omit<Pnc, 'id' | 'touches' | 'parties' | 'notes' | 'conflicts'>, who: { contactId: string } | Omit<Contact, 'id' | 'notes'>, others: Party[] = []): string {
        const id = newId('p');
        setS((x) => {
          let contacts = x.contacts;
          let contactId: string;
          if ('contactId' in who) contactId = who.contactId;
          else {
            contactId = newId('ct');
            contacts = [...contacts, { ...who, id: contactId, notes: [] }];
          }
          const pnc: Pnc = { receivedAt: new Date().toISOString(), ...p, id, touches: {}, notes: [], conflicts: [], parties: [{ contactId, role: 'client', primary: true }, ...others] };
          return { ...x, contacts, pncs: [pnc, ...x.pncs] };
        });
        return id;
      },
      /** Hired: the prospect becomes a client and a matter, with nothing retyped. */
      hirePnc(id: string, areaId: string, planType: string | undefined, matterId: string) {
        setS((x) => {
          const p = x.pncs.find((q) => q.id === id);
          const area = x.areas.find((a) => a.id === areaId);
          if (!p || !area) return x;
          const engaged = area.milestones[0];
          const primary = x.contacts.find((c) => c.id === (p.parties.find((q) => q.primary) ?? p.parties[0])?.contactId);
          // With the sample data's 2026-01xx numbers, start after the highest one already used this year.
          const existingMax = Math.max(0, ...x.matters.filter((q) => q.number.startsWith(todayISO().slice(0, 4))).map((q) => Number(q.number.split('-').pop()) || 0));
          const num = nextNumber(x.numbering, area, (primary?.name ?? 'X').split(',')[0], x.numbering.format === '{YYYY}-{SEQ}' && x.numbering.scope === 'year' ? existingMax : 0);
          const matter: Matter = {
            id: matterId,
            number: num.number,
            name: `${primary?.name.split(',')[0] ?? 'New'} ${area.name}`,
            parties: p.parties,
            notes: [],
            conflicts: p.conflicts,
            status: 'open',
            pncId: p.id,
            areaId,
            stageId: area.stages[0].id,
            planType,
            owner: p.owner === 'dana' || p.owner === 'priya' ? 'me' : p.owner,
            originator: p.owner === 'marcus' ? 'marcus' : 'me',
            ball: 'client',
            billing: { kind: 'flat', amount: 0 },
            priority: false,
            lastContact: todayISO(),
            milestones: engaged ? { [engaged.id]: { done: todayISO() } } : {},
            stalled: false,
            opened: todayISO(),
          };
          return {
            ...x,
            numbering: { ...x.numbering, counters: num.counters },
            tasks: [...x.tasks, ...stageTasksFor(matter, area, matter.stageId, x.tasks)],
            matters: [...x.matters, matter],
            pncs: x.pncs.map((q) => (q.id === id ? { ...q, stage: 'hired', matterId } : q)),
          };
        });
      },

      // ----- Time & billing -----
      startTimer(matterId: string, description = '') {
        setS((x) => ({ ...x, timer: { matterId, description, startedAt: Date.now() } }));
      },
      stopTimer(demoMinutes?: number) {
        setS((x) => {
          if (!x.timer) return x;
          const actual = demoMinutes ?? Math.max(1, Math.round((Date.now() - x.timer.startedAt) / 60000));
          const entry: TimeEntry = {
            id: newId('t'),
            matterId: x.timer.matterId,
            date: todayISO(),
            actualMinutes: actual,
            description: x.timer.description || 'Untitled work',
            user: 'me',
            billable: true,
            invoiced: false,
            source: 'timer',
          };
          return { ...x, timer: null, timeEntries: [entry, ...x.timeEntries] };
        });
      },
      addTimeEntry(e: Omit<TimeEntry, 'id'>) {
        setS((x) => ({ ...x, timeEntries: [{ ...e, id: newId('t') }, ...x.timeEntries] }));
      },
      toggleBillable(id: string) {
        setS((x) => ({ ...x, timeEntries: x.timeEntries.map((t) => (t.id === id ? { ...t, billable: !t.billable } : t)) }));
      },
      /** Create an invoice from everything unbilled on the matter. It starts as a draft; sending is a separate step. */
      createInvoice(matterId: string, sendVia?: Invoice['sentVia']): string {
        const id = newId('inv');
        setS((x) => {
          const m = x.matters.find((q) => q.id === matterId);
          if (!m) return x;
          const rate = m.billing.kind === 'flat' ? 0 : m.billing.rate;
          const fees = x.flatFees.filter((f) => f.matterId === matterId && f.status === 'unbilled');
          const entries = rate ? x.timeEntries.filter((t) => t.matterId === matterId && !t.invoiced && t.billable) : [];
          const exps = x.expenses.filter((e) => e.matterId === matterId && e.billable && !e.invoiced && e.paidFrom === 'operating');
          const lines: InvoiceLine[] = [
            ...fees.map((f) => ({ description: f.description, amount: f.amount })),
            ...exps.map((e) => ({ date: e.date, description: `Expense: ${e.description}`, amount: trust.round(e.amount * (1 + e.markupPct / 100)) })),
            ...entries.map((t) => {
              const hours = billedMinutes(t.actualMinutes, x.billing) / 60;
              return { date: t.date, description: t.description, hours, rate, amount: Math.round(hours * rate * 100) / 100 };
            }),
          ];
          if (!lines.length) return x;
          const nums = x.invoices.map((i) => Number(i.number.replace(/\D/g, ''))).filter(Boolean);
          const inv: Invoice = {
            id,
            number: `INV-${Math.max(1041, ...nums) + 1}`,
            matterId,
            date: todayISO(),
            lines,
            total: lines.reduce((n, l) => n + l.amount, 0),
            status: sendVia ? 'sent' : 'draft',
            sentVia: sendVia,
            sentAt: sendVia ? todayISO() : undefined,
            timeEntryIds: entries.map((t) => t.id),
            flatFeeIds: fees.map((f) => f.id),
            expenseIds: exps.map((e) => e.id),
          };
          return {
            ...x,
            invoices: [inv, ...x.invoices],
            timeEntries: x.timeEntries.map((t) => (inv.timeEntryIds.includes(t.id) ? { ...t, invoiced: true } : t)),
            flatFees: x.flatFees.map((f) => (inv.flatFeeIds.includes(f.id) ? { ...f, status: 'invoiced' } : f)),
            expenses: x.expenses.map((e) => (inv.expenseIds?.includes(e.id) ? { ...e, invoiced: true } : e)),
          };
        });
        return id;
      },
      sendInvoice(id: string, via: NonNullable<Invoice['sentVia']>) {
        setS((x) => ({ ...x, invoices: x.invoices.map((i) => (i.id === id ? { ...i, status: i.status === 'paid' ? 'paid' : 'sent', sentVia: via, sentAt: todayISO() } : i)) }));
      },
      markInvoicePaid(id: string) {
        setS((x) => {
          const inv = x.invoices.find((i) => i.id === id);
          if (!inv) return x;
          return {
            ...x,
            invoices: x.invoices.map((i) => (i.id === id ? { ...i, status: 'paid', paidAt: todayISO() } : i)),
            flatFees: x.flatFees.map((f) => (inv.flatFeeIds.includes(f.id) ? { ...f, status: 'paid' } : f)),
          };
        });
      },
      /** Deleting a draft puts its time and fees back into "unbilled". Sent invoices can't be deleted. */
      deleteDraftInvoice(id: string) {
        setS((x) => {
          const inv = x.invoices.find((i) => i.id === id);
          if (!inv || inv.status !== 'draft') return x;
          return {
            ...x,
            invoices: x.invoices.filter((i) => i.id !== id),
            timeEntries: x.timeEntries.map((t) => (inv.timeEntryIds.includes(t.id) ? { ...t, invoiced: false } : t)),
            flatFees: x.flatFees.map((f) => (inv.flatFeeIds.includes(f.id) ? { ...f, status: 'unbilled' } : f)),
            expenses: x.expenses.map((e) => (inv.expenseIds?.includes(e.id) ? { ...e, invoiced: false } : e)),
          };
        });
      },
      payFlatFee(id: string) {
        setS((x) => ({ ...x, flatFees: x.flatFees.map((f) => (f.id === id ? { ...f, status: 'paid' } : f)) }));
      },
      setBilling(b: Partial<BillingSettings>) {
        setS((x) => ({ ...x, billing: { ...x.billing, ...b } }));
      },

      // ----- Tasks -----
      setTaskStatus(id: string, status: Task['status']) {
        setS((x) => ({
          ...x,
          tasks: x.tasks.map((t) => {
            if (t.id !== id || t.status === status) return t;
            const label = seed.TASK_STATUSES.find((q) => q.id === status)!.label;
            const extra = status === 'stuck' && t.escalateTo ? [`${t.escalateTo === 'me' ? 'You were' : `${seed.teamName(t.escalateTo)} was`} notified that this is stuck`] : [];
            return { ...t, status, done: status === 'done', doneAt: status === 'done' ? new Date().toISOString() : undefined, log: [...t.log, `Status: ${label}`, ...extra] };
          }),
        }));
      },
      setTaskDone(id: string, done: boolean) {
        setS((x) => ({
          ...x,
          tasks: x.tasks.map((t) => (t.id === id ? { ...t, done, status: done ? 'done' : 'todo', doneAt: done ? new Date().toISOString() : undefined, log: [...t.log, done ? 'Status: Done' : 'Reopened'] } : t)),
        }));
      },
      updateTask(id: string, patch: Partial<Task>, logLine?: string) {
        setS((x) => ({ ...x, tasks: x.tasks.map((t) => (t.id === id ? { ...t, ...patch, log: logLine ? [...t.log, logLine] : t.log } : t)) }));
      },
      toggleChecklist(id: string, index: number) {
        setS((x) => ({
          ...x,
          tasks: x.tasks.map((t) => (t.id === id ? { ...t, checklist: t.checklist.map((c, i) => (i === index ? { ...c, done: !c.done } : c)) } : t)),
        }));
      },
      snoozeTask(id: string, label: string, hours: number) {
        setS((x) => ({
          ...x,
          tasks: x.tasks.map((r) =>
            r.id === id
              ? {
                  ...r,
                  snoozes: r.snoozes + 1,
                  log: [...r.log, `Snoozed ${label}`, ...(r.snoozes + 1 >= 3 && r.escalateTo ? [`Escalated to ${seed.teamName(r.escalateTo)}`] : [])],
                  // Court and statute deadlines never move; only the next nudge does.
                  due: r.kind === 'court' || r.kind === 'statute' ? r.due : new Date(new Date(r.due).getTime() + hours * 3600000).toISOString(),
                }
              : r,
          ),
        }));
      },
      deleteTask(id: string) {
        setS((x) => ({ ...x, tasks: x.tasks.filter((t) => t.id !== id) }));
      },
      addChecklistItem(id: string, text: string) {
        setS((x) => ({ ...x, tasks: x.tasks.map((t) => (t.id === id ? { ...t, checklist: [...t.checklist, { text, done: false }] } : t)) }));
      },
      removeChecklistItem(id: string, index: number) {
        setS((x) => ({ ...x, tasks: x.tasks.map((t) => (t.id === id ? { ...t, checklist: t.checklist.filter((_, i) => i !== index) } : t)) }));
      },
      addTaskComment(id: string, text: string) {
        const n: Note = { id: newId('n'), at: new Date().toISOString(), author: 'me', text };
        setS((x) => ({ ...x, tasks: x.tasks.map((t) => (t.id === id ? { ...t, comments: [n, ...(t.comments ?? [])] } : t)) }));
      },
      addTask(t: Omit<Task, 'id' | 'done' | 'status' | 'snoozes' | 'log' | 'source' | 'createdAt'>) {
        setS((x) => ({ ...x, tasks: [...x.tasks, { ...t, id: newId('task'), done: false, status: 'todo', snoozes: 0, log: ['Created'], source: 'manual', createdAt: new Date().toISOString() }] }));
      },

      // ----- Trust accounting -----
      recordDeposit(matterId: string, amount: number, memo: string, method: TrustTxn['method'], payee?: string) {
        setS((x) => {
          const txn: TrustTxn = { id: newId('tt'), date: todayISO(), matterId, kind: 'deposit', amount: trust.round(amount), memo, method, payee, status: 'approved', requestedBy: x.viewAs, approvedBy: x.viewAs };
          return { ...x, trustTxns: [...x.trustTxns, txn] };
        });
      },
      /** Returns false if the client's available trust balance can't cover it. */
      requestTrustOut(t: Omit<TrustTxn, 'id' | 'status' | 'date' | 'requestedBy'>): boolean {
        let ok = false;
        setS((x) => {
          const r = requestOut(x, { ...t, requestedBy: x.viewAs });
          ok = r.ok;
          return r.x;
        });
        return ok;
      },
      approveTrust(id: string) {
        setS((x) => {
          const t = x.trustTxns.find((q) => q.id === id);
          if (!t || t.status !== 'pending') return x;
          let next: State = { ...x, trustTxns: x.trustTxns.map((q) => (q.id === id ? { ...q, status: 'approved', approvedBy: x.viewAs, date: todayISO() } : q)) };
          if (t.invoiceId) next = { ...next, invoices: next.invoices.map((i) => (i.id === t.invoiceId ? { ...i, status: 'paid', paidAt: todayISO() } : i)) };
          return maybeReplenish(next, t.matterId);
        });
      },
      rejectTrust(id: string) {
        setS((x) => ({ ...x, trustTxns: x.trustTxns.map((q) => (q.id === id ? { ...q, status: 'rejected' } : q)) }));
      },
      payInvoiceFromTrust(invoiceId: string): boolean {
        let ok = false;
        setS((x) => {
          const inv = x.invoices.find((i) => i.id === invoiceId);
          if (!inv || x.trustTxns.some((t) => t.invoiceId === invoiceId && t.status !== 'rejected')) return x;
          const r = requestOut(x, { matterId: inv.matterId, kind: 'draw', amount: inv.total, memo: `Payment of ${inv.number}`, method: 'transfer', requestedBy: x.viewAs, invoiceId });
          ok = r.ok;
          return r.x;
        });
        return ok;
      },
      /** Simulates the next M&T sync: approved items not yet at the bank post there, then everything auto-matches. */
      syncBank() {
        setS((x) => {
          const posted: BankTxn[] = x.trustTxns
            .filter((t) => t.status === 'approved' && !t.bankTxnId && !(t.kind !== 'deposit' && t.method === 'check' && t.date >= addDays(todayISO(), -3)))
            .map((t) => ({ id: newId('bk'), date: todayISO(), amount: trust.sign(t), matchedId: t.id, description: t.kind === 'deposit' ? `DEPOSIT ${t.ref ?? ''}` : t.kind === 'draw' ? 'ONLINE TRANSFER TO XXXXXX1177' : `CHECK ${(t.ref ?? '').replace(/\D/g, '')}` }));
          // Lines posted by this sync are already linked to the entry that caused them; older unmatched lines try an automatic match.
          const bank = [...x.bankTxns, ...posted];
          const linked = x.trustTxns.map((t) => { const b = posted.find((q) => q.matchedId === t.id); return b ? { ...t, bankTxnId: b.id } : t; });
          const pairs = trust.autoMatch(linked, bank);
          return {
            ...x,
            bankTxns: bank.map((b) => { const p = pairs.find(([bid]) => bid === b.id); return p ? { ...b, matchedId: p[1] } : b; }),
            trustTxns: linked.map((t) => { const p = pairs.find(([, tid]) => tid === t.id); return p ? { ...t, bankTxnId: p[0] } : t; }),
          };
        });
      },
      matchBank(bankId: string, txnId: string) {
        setS((x) => ({
          ...x,
          bankTxns: x.bankTxns.map((b) => (b.id === bankId ? { ...b, matchedId: txnId } : b)),
          trustTxns: x.trustTxns.map((t) => (t.id === txnId ? { ...t, bankTxnId: bankId } : t)),
        }));
      },
      /** A bank charge taken from IOLTA: the firm reimburses it from operating, recorded as a firm deposit. */
      reimburseBankFee(bankId: string) {
        setS((x) => {
          const b = x.bankTxns.find((q) => q.id === bankId);
          if (!b) return x;
          const out: BankTxn = { ...b, matchedId: 'firm' };
          const back: BankTxn = { id: newId('bk'), date: todayISO(), amount: -b.amount, description: 'ONLINE TRANSFER FROM XXXXXX1177', matchedId: 'firm' };
          return { ...x, bankTxns: [...x.bankTxns.map((q) => (q.id === bankId ? out : q)), back] };
        });
      },
      setRetainer(matterId: string, retainer: Matter['retainer']) {
        setS((x) => ({ ...x, matters: x.matters.map((m) => (m.id === matterId ? { ...m, retainer } : m)) }));
      },
      requestReplenishment(matterId: string, amount: number) {
        setS((x) => ({ ...x, replenishments: [...x.replenishments.filter((r) => !(r.matterId === matterId && r.status === 'sent')), { id: newId('rp'), matterId, date: todayISO(), amount: trust.round(amount), status: 'sent' }] }));
      },
      /** Client pays a replenishment request (LawPay, simulated): money lands in trust. */
      payReplenishment(id: string) {
        setS((x) => {
          const r = x.replenishments.find((q) => q.id === id);
          if (!r || r.status !== 'sent') return x;
          const txn: TrustTxn = { id: newId('tt'), date: todayISO(), matterId: r.matterId, kind: 'deposit', amount: r.amount, memo: 'Retainer replenishment', method: 'lawpay', ref: `LP-${Math.floor(Math.random() * 90000 + 10000)}`, status: 'approved', requestedBy: 'client', approvedBy: 'client' };
          return { ...x, trustTxns: [...x.trustTxns, txn], replenishments: x.replenishments.map((q) => (q.id === id ? { ...q, status: 'paid', paidAt: todayISO() } : q)) };
        });
      },
      addExpense(e: Omit<Expense, 'id' | 'invoiced' | 'trustTxnId'>): boolean {
        let ok = true;
        setS((x) => {
          const id = newId('ex');
          if (e.paidFrom === 'trust') {
            const r = requestOut(x, { matterId: e.matterId, kind: 'disbursement', amount: e.amount, memo: e.description, payee: e.category === 'Filing fee' || e.category === 'Recording fee' ? 'Clerk of Circuit Court' : e.category, method: 'check', requestedBy: x.viewAs, expenseId: id });
            if (!r.ok) { ok = false; return x; }
            const txnId = r.x.trustTxns[r.x.trustTxns.length - 1].id;
            return { ...r.x, expenses: [...r.x.expenses, { ...e, id, invoiced: false, trustTxnId: txnId }] };
          }
          return { ...x, expenses: [...x.expenses, { ...e, id, invoiced: false }] };
        });
        return ok;
      },
      signReconciliation(rec: Omit<Reconciliation, 'id' | 'signedAt' | 'signedBy'>) {
        setS((x) => ({ ...x, reconciliations: [{ ...rec, id: newId('rc'), signedAt: todayISO(), signedBy: x.viewAs }, ...x.reconciliations.filter((r) => !(r.kind === rec.kind && r.period === rec.period))] }));
      },

      // ----- Messages -----
      postMessage(channel: string, text: string, clientVisible: boolean, author = 'me') {
        setS((x) => ({
          ...x,
          messages: [...x.messages, { id: newId('msg'), channel, author, text, at: new Date().toISOString(), clientVisible }],
        }));
      },

      // ----- Scheduling -----
      /** A public booking. Prospects land in Intake with the consult on the calendar. */
      book(typeId: string, start: string, name: string, phone: string, answers: string[]) {
        setS((x) => {
          const type = x.eventTypes.find((t) => t.id === typeId)!;
          const isProspect = type.who === 'prospects';
          const pncId = newId('p');
          const contactId = newId('ct');
          const contacts = isProspect ? [...x.contacts, { id: contactId, name, kind: 'person' as const, phone, email: '', notes: [] }] : x.contacts;
          const pncs: Pnc[] = isProspect
            ? [{ id: pncId, title: answers[0] || 'Consultation', parties: [{ contactId, role: 'client', primary: true }], source: 'Online booking', stage: 'scheduled', firstContact: todayISO(), consultAt: start, touches: {}, owner: 'me', conflicts: [], notes: answers[1] ? [{ id: newId('n'), at: new Date().toISOString(), author: 'system', text: `Others named at booking: ${answers[1]}` }] : [] }, ...x.pncs]
            : x.pncs;
          const ev: CalEvent = { id: newId('e'), title: `${isProspect ? 'Consult' : type.name}: ${name.split(',')[0]}`, start, minutes: type.minutes, pncId: isProspect ? pncId : undefined, kind: 'consult' };
          const msg: Message = {
            id: newId('msg'),
            channel: 'intake',
            author: 'system',
            text: `${name} booked "${type.name}". ${isProspect ? 'Added to Intake as Consult scheduled; conflict check queued' : 'Added to calendar'}.${answers[1] ? ` Others named: ${answers[1]}.` : ''}`,
            at: new Date().toISOString(),
            clientVisible: false,
          };
          return { ...x, contacts, pncs, events: [...x.events, ev], messages: [...x.messages, msg] };
        });
      },
      toggleEventType(id: string) {
        setS((x) => ({ ...x, eventTypes: x.eventTypes.map((t) => (t.id === id ? { ...t, active: !t.active } : t)) }));
      },
      updateEventType(id: string, patch: Partial<seed.EventType>) {
        setS((x) => ({ ...x, eventTypes: x.eventTypes.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
      },

      // ----- Scheduling (v2) -----
      saveMeetingType(m: MeetingType) {
        setS((x) => ({ ...x, meetingTypes: x.meetingTypes.some((q) => q.id === m.id) ? x.meetingTypes.map((q) => (q.id === m.id ? m : q)) : [...x.meetingTypes, m] }));
      },
      deleteMeetingType(id: string) {
        setS((x) => ({ ...x, meetingTypes: x.meetingTypes.filter((q) => q.id !== id) }));
      },
      saveSchedule(sc: Schedule) {
        setS((x) => ({ ...x, schedules: x.schedules.some((q) => q.id === sc.id) ? x.schedules.map((q) => (q.id === sc.id ? sc : q)) : [...x.schedules, sc] }));
      },
      deleteSchedule(id: string) {
        setS((x) => ({ ...x, schedules: x.schedules.filter((q) => q.id !== id) }));
      },
      saveRouting(r: RoutingForm) {
        setS((x) => ({ ...x, routing: r }));
      },
      /** A booking. Prospects become a PNC matter (with contact); clients attach to their matter. */
      bookMeeting(b: Omit<Booking, 'id' | 'status' | 'eventId' | 'pncId'> & { phone?: string; email?: string }) {
        setS((x) => {
          const mt = x.meetingTypes.find((q) => q.id === b.meetingTypeId)!;
          const id = newId('bk');
          const eventId = newId('e');
          let contacts = x.contacts;
          let pncs = x.pncs;
          let pncId: string | undefined;
          if (mt.audience === 'prospects' && !b.matterId) {
            const contactId = newId('ct');
            pncId = newId('p');
            contacts = [...contacts, { id: contactId, name: b.who, kind: 'person', phone: b.phone ?? '', email: b.email ?? '', notes: [] }];
            const others = Object.entries(b.answers).filter(([k, v]) => v && k === 'q-others').map(([, v]) => v).join('; ');
            pncs = [
              { id: pncId, title: `${mt.name}${b.answers.need ? `: ${b.answers.need}` : ''}`, parties: [{ contactId, role: 'client', primary: true }], source: 'Online booking', stage: 'scheduled', firstContact: todayISO(), consultAt: b.start, touches: {}, owner: b.host, notes: others ? [{ id: newId('n'), at: new Date().toISOString(), author: 'system', text: `Others named at booking (for conflict check): ${others}` }] : [], conflicts: [] },
              ...pncs,
            ];
          }
          const place = sched.PLACES.find((p) => p.id === b.place);
          const ev: CalEvent = { id: eventId, title: `${mt.name}: ${b.who.split(',')[0]}`, start: b.start, minutes: b.minutes, matterId: b.matterId, pncId, kind: mt.audience === 'prospects' ? 'consult' : place?.kind === 'phone-out' || place?.kind === 'phone-in' ? 'call' : 'meeting', host: b.host };
          const booking: Booking = { ...b, id, status: 'booked', eventId, pncId };
          const msg: Message = { id: newId('msg'), channel: mt.audience === 'prospects' ? 'intake' : b.matterId ?? 'general', author: 'system', text: `${b.who} booked ${mt.name} with ${seed.teamName(b.host)} (${place?.name}).`, at: new Date().toISOString(), clientVisible: false };
          return { ...x, contacts, pncs, bookings: [booking, ...x.bookings], events: [...x.events, ev], messages: [...x.messages, msg] };
        });
      },
      /** Held: marks the linked milestone done and counts as client contact. No-show: logged for show-rate. */
      setBookingStatus(id: string, status: Booking['status']) {
        setS((x) => {
          const b = x.bookings.find((q) => q.id === id);
          if (!b) return x;
          let next: State = { ...x, bookings: x.bookings.map((q) => (q.id === id ? { ...q, status } : q)) };
          if (status === 'cancelled') next = { ...next, events: next.events.filter((e) => e.id !== b.eventId) };
          const mt = x.meetingTypes.find((q) => q.id === b.meetingTypeId);
          if (status === 'held' && b.matterId) {
            const m = x.matters.find((q) => q.id === b.matterId);
            const area = m && x.areas.find((a) => a.id === m.areaId);
            const ms = mt?.completesMilestone && area?.milestones.find((q) => q.name.toLowerCase() === mt.completesMilestone!.toLowerCase());
            next = {
              ...next,
              matters: next.matters.map((q) => (q.id === b.matterId ? { ...q, lastContact: b.start.slice(0, 10), milestones: ms && !q.milestones[ms.id]?.done ? { ...q.milestones, [ms.id]: { ...q.milestones[ms.id], done: b.start.slice(0, 10) } } : q.milestones } : q)),
            };
            if (ms) next = maybeDraw(next, b.matterId, ms.id, x.viewAs);
          }
          if (status === 'held' && b.pncId) next = { ...next, pncs: next.pncs.map((p) => (p.id === b.pncId && p.stage === 'scheduled' ? { ...p, stage: 'notes' } : p)) };
          return next;
        });
      },

      // ----- Documents -----
      setDocSettings(d: DocSettings) {
        setS((x) => ({ ...x, docSettings: d }));
      },
      uploadDocs(matterId: string, folder: string, files: { name: string; sizeKb: number }[]) {
        setS((x) => {
          const next = [...x.docFiles];
          for (const f of files) {
            const existing = next.find((d) => d.matterId === matterId && d.folder === folder && d.name === f.name);
            if (existing) Object.assign(existing, { version: existing.version + 1, modified: todayISO(), modifiedBy: x.viewAs, sizeKb: f.sizeKb });
            else next.push({ id: newId('doc'), matterId, folder, name: f.name, sizeKb: f.sizeKb, modified: todayISO(), modifiedBy: x.viewAs, version: 1, shared: false });
          }
          return { ...x, docFiles: next.map((d) => ({ ...d })) };
        });
      },
      updateDoc(id: string, patch: Partial<DocFile>) {
        setS((x) => ({ ...x, docFiles: x.docFiles.map((d) => (d.id === id ? { ...d, ...patch } : d)) }));
      },
      deleteDoc(id: string) {
        setS((x) => ({ ...x, docFiles: x.docFiles.filter((d) => d.id !== id) }));
      },
      addFolder(matterId: string, name: string) {
        setS((x) => ({ ...x, docFolders: { ...x.docFolders, [matterId]: [...(x.docFolders[matterId] ?? []), name] } }));
      },

      // ----- Phone -----
      simulateIncomingCall() {
        setS((x) => {
          const m = x.matters.find((q) => q.id === 'm8') ?? x.matters[0];
          const c = x.contacts.find((q) => q.id === (m.parties.find((p) => p.primary) ?? m.parties[0]).contactId)!;
          return { ...x, activeCall: { contact: c.name, number: c.phone, matterId: m.id, startedAt: Date.now() } };
        });
      },
      /** Ends the call, logs it, drafts a time entry and counts as client contact. */
      endCall(demoSeconds = 440) {
        setS((x) => {
          if (!x.activeCall) return x;
          const c = x.activeCall;
          const log: CallLog = { id: newId('c'), matterId: c.matterId, contact: c.contact, number: c.number, direction: 'in', at: new Date().toISOString(), seconds: demoSeconds, logged: !!c.matterId };
          const entries: TimeEntry[] = c.matterId
            ? [{ id: newId('t'), matterId: c.matterId, date: todayISO(), actualMinutes: Math.ceil(demoSeconds / 60), description: `Phone call with ${c.contact}`, user: 'me', billable: true, invoiced: false, source: 'call' }, ...x.timeEntries]
            : x.timeEntries;
          const matters = c.matterId ? x.matters.map((m) => (m.id === c.matterId ? { ...m, lastContact: todayISO() } : m)) : x.matters;
          return { ...x, activeCall: null, calls: [log, ...x.calls], timeEntries: entries, matters };
        });
      },
      logCall(id: string, matterId: string) {
        setS((x) => {
          const call = x.calls.find((c) => c.id === id);
          if (!call) return x;
          const entry: TimeEntry = { id: newId('t'), matterId, date: call.at.slice(0, 10), actualMinutes: Math.ceil(call.seconds / 60), description: `Phone call with ${call.contact}`, user: 'me', billable: true, invoiced: false, source: 'call' };
          return { ...x, calls: x.calls.map((c) => (c.id === id ? { ...c, matterId, logged: true } : c)), timeEntries: [entry, ...x.timeEntries] };
        });
      },
    };
  }, []);

  const lookup = useMemo(
    () => ({
      matter: (id: string) => s.matters.find((m) => m.id === id),
      contact: (id: string) => s.contacts.find((c) => c.id === id),
      /** Primary contact on a matter or PNC matter. */
      clientOf: (m: { parties: Party[] }) => s.contacts.find((c) => c.id === (m.parties.find((p) => p.primary) ?? m.parties[0])?.contactId),
      pnc: (id: string) => s.pncs.find((p) => p.id === id),
      role: (id: string) => s.roles.find((r) => r.id === id) ?? { id, name: id, side: 'neutral' as const },
      area: (id: string) => s.areas.find((a) => a.id === id),
      areaOf: (m: Matter) => s.areas.find((a) => a.id === m.areaId) ?? s.areas[0],
    }),
    [s.matters, s.contacts, s.areas, s.pncs, s.roles],
  );

  // What the person being viewed as is allowed to do and see.
  const access = useMemo(() => {
    const u = s.users.find((x) => x.userId === s.viewAs) ?? s.users[0];
    const role = s.permRoles.find((r) => r.id === u?.roleId);
    const can = (p: Perm) => !!role?.perms[p];
    const areaOk = (areaId: string) => !!u && (u.areas === 'all' || u.areas.includes(areaId));
    const walledOff = (m: Matter) => !!m.restrictedTo?.length && !m.restrictedTo.includes(s.viewAs);
    /** Can open the matter at all. People with Client matters access are limited to their practice areas;
     *  billing-only roles (bookkeeper) see every matter for billing. Nobody gets past an ethical wall. */
    const canSee = (m: Matter) => !walledOff(m) && (can('matters') ? areaOk(m.areaId) : can('billingView'));
    return { user: s.viewAs, roleName: role?.name ?? 'No role', can, areaOk, canSee, walledOff };
  }, [s.users, s.permRoles, s.viewAs]);

  return { s, actions, lookup, access, screen, matterId, pncId, contactId, go, toast, notify, taskId, openTask: setTaskId };
}

type Store = ReturnType<typeof useStoreValue>;
const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const value = useStoreValue();
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore outside StoreProvider');
  return v;
}
