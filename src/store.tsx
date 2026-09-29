import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as seed from './data';
import type { CalEvent, CallLog, Cadences, ConflictCheck, Contact, Matter, Message, Note, Party, Pnc, Role, Task, TimeEntry } from './data';
import { DEFAULT_BILLING, type BillingSettings } from './billing';
import { addDays, addWorkdays, DEFAULT_AREAS, newId, slug, todayISO, type MilestoneState, type PracticeArea } from './practice';

export type Screen =
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
  timeEntries: TimeEntry[];
  flatFees: seed.FlatFee[];
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
const CONFIG_KEY = 'docket.config.v4';
function loadConfig(): Partial<Pick<State, 'areas' | 'cadences' | 'billing' | 'roles'>> {
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
    areas: (cfg.areas ?? DEFAULT_AREAS).map((a) => ({ ...a, stageTasks: a.stageTasks ?? [] })),
    cadences: cfg.cadences ?? seed.DEFAULT_CADENCES,
    billing: cfg.billing ?? DEFAULT_BILLING,
    matters: seed.matters,
    pncs: seed.pncs,
    contacts: seed.contacts,
    roles: cfg.roles ?? seed.DEFAULT_ROLES,
    timeEntries: seed.timeEntries,
    flatFees: seed.flatFees,
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
        done: false,
        snoozes: 0,
        log: [`Created automatically when the matter moved to ${area.stages.find((x) => x.id === stageId)?.name}`],
        checklist: t.checklist.map((text) => ({ text, done: false })),
        source: 'stage' as const,
        createdAt: new Date().toISOString(),
      };
    });
}

function useStoreValue() {
  const [s, setS] = useState<State>(initialState);
  const [screen, setScreen] = useState<Screen>('today');
  const [matterId, setMatterId] = useState<string>('m1');
  const [pncId, setPncId] = useState<string>('p1');
  const [contactId, setContactId] = useState<string>('c1');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify({ areas: s.areas, cadences: s.cadences, billing: s.billing, roles: s.roles }));
    } catch {
      /* storage unavailable: settings last for this visit only */
    }
  }, [s.areas, s.cadences, s.billing, s.roles]);

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
        setS((x) => ({ ...x, pncs: x.pncs.map((p) => (p.id === id ? { ...p, touches: { ...p.touches, [key]: todayISO() } } : p)) }));
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
          const pnc: Pnc = { ...p, id, touches: {}, notes: [], conflicts: [], parties: [{ contactId, role: 'client', primary: true }, ...others] };
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
          const matter: Matter = {
            id: matterId,
            number: `2026-${String(x.matters.filter((m) => m.status === 'open').length + 101).padStart(4, '0')}`,
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
      invoiceMatter(matterId: string) {
        setS((x) => ({
          ...x,
          timeEntries: x.timeEntries.map((t) => (t.matterId === matterId && t.billable ? { ...t, invoiced: true } : t)),
          flatFees: x.flatFees.map((f) => (f.matterId === matterId && f.status === 'unbilled' ? { ...f, status: 'invoiced' } : f)),
        }));
      },
      payFlatFee(id: string) {
        setS((x) => ({ ...x, flatFees: x.flatFees.map((f) => (f.id === id ? { ...f, status: 'paid' } : f)) }));
      },
      setBilling(b: Partial<BillingSettings>) {
        setS((x) => ({ ...x, billing: { ...x.billing, ...b } }));
      },

      // ----- Tasks -----
      setTaskDone(id: string, done: boolean) {
        setS((x) => ({
          ...x,
          tasks: x.tasks.map((t) => (t.id === id ? { ...t, done, doneAt: done ? new Date().toISOString() : undefined, log: [...t.log, done ? 'Marked done' : 'Reopened'] } : t)),
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
      addTask(t: Omit<Task, 'id' | 'done' | 'snoozes' | 'log' | 'source' | 'createdAt'>) {
        setS((x) => ({ ...x, tasks: [...x.tasks, { ...t, id: newId('task'), done: false, snoozes: 0, log: ['Created'], source: 'manual', createdAt: new Date().toISOString() }] }));
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

  return { s, actions, lookup, screen, matterId, pncId, contactId, go, toast, notify };
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
