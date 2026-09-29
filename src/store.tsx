import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import * as seed from './data';
import type { CalEvent, CallLog, Matter, Message, Reminder, Stage, TimeEntry } from './data';
import { DEFAULT_BILLING, type BillingSettings } from './billing';

export type Screen =
  | 'today'
  | 'matters'
  | 'matter'
  | 'time'
  | 'calendar'
  | 'scheduling'
  | 'reminders'
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
  matters: Matter[];
  clients: seed.Client[];
  timeEntries: TimeEntry[];
  flatFees: seed.FlatFee[];
  reminders: Reminder[];
  events: CalEvent[];
  messages: Message[];
  calls: CallLog[];
  eventTypes: seed.EventType[];
  billing: BillingSettings;
  timer: Timer | null;
  activeCall: ActiveCall | null;
}

const initial: State = {
  matters: seed.matters,
  clients: seed.clients,
  timeEntries: seed.timeEntries,
  flatFees: seed.flatFees,
  reminders: seed.reminders,
  events: seed.events,
  messages: seed.messages,
  calls: seed.calls,
  eventTypes: seed.eventTypes,
  billing: DEFAULT_BILLING,
  timer: null,
  activeCall: null,
};

let idCounter = 1000;
const newId = (p: string) => `${p}${++idCounter}`;

function useStoreValue() {
  const [s, setS] = useState<State>(initial);
  const [screen, setScreen] = useState<Screen>('today');
  const [matterId, setMatterId] = useState<string>('m4');
  const [toast, setToast] = useState<string | null>(null);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 3200);
  }, []);

  const go = useCallback((sc: Screen, mId?: string) => {
    if (mId) setMatterId(mId);
    setScreen(sc);
    window.scrollTo({ top: 0 });
  }, []);

  const actions = useMemo(
    () => ({
      moveMatter(id: string, stage: Stage) {
        setS((x) => ({ ...x, matters: x.matters.map((m) => (m.id === id ? { ...m, stage } : m)) }));
      },
      startTimer(matterId: string, description = '') {
        setS((x) => ({ ...x, timer: { matterId, description, startedAt: Date.now() } }));
      },
      setTimerDescription(description: string) {
        setS((x) => (x.timer ? { ...x, timer: { ...x.timer, description } } : x));
      },
      /** Stops the timer and saves an entry. `demoMinutes` fast-forwards the clock for the prototype. */
      stopTimer(demoMinutes?: number) {
        setS((x) => {
          if (!x.timer) return x;
          const actual = demoMinutes ?? Math.max(1, Math.round((Date.now() - x.timer.startedAt) / 60000));
          const entry: TimeEntry = {
            id: newId('t'),
            matterId: x.timer.matterId,
            date: new Date().toISOString().slice(0, 10),
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
      completeReminder(id: string) {
        setS((x) => ({ ...x, reminders: x.reminders.map((r) => (r.id === id ? { ...r, done: true, log: [...r.log, 'Marked done'] } : r)) }));
      },
      snoozeReminder(id: string, label: string, hours: number) {
        setS((x) => ({
          ...x,
          reminders: x.reminders.map((r) =>
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
      addReminder(r: Omit<Reminder, 'id' | 'done' | 'snoozes' | 'log'>) {
        setS((x) => ({ ...x, reminders: [...x.reminders, { ...r, id: newId('r'), done: false, snoozes: 0, log: [] }] }));
      },
      postMessage(channel: string, text: string, clientVisible: boolean, author = 'me') {
        setS((x) => ({
          ...x,
          messages: [...x.messages, { id: newId('msg'), channel, author, text, at: new Date().toISOString(), clientVisible }],
        }));
      },
      /** A public booking from the scheduling page. Prospects become leads in Intake. */
      book(typeId: string, start: string, name: string, answers: string[]) {
        setS((x) => {
          const type = x.eventTypes.find((t) => t.id === typeId)!;
          const clientId = newId('c');
          const matterId = newId('m');
          const isProspect = type.who === 'prospects';
          const clients = isProspect ? [...x.clients, { id: clientId, name, email: '', phone: '' }] : x.clients;
          const matters: Matter[] = isProspect
            ? [
                ...x.matters,
                {
                  id: matterId,
                  number: '—',
                  name: `${name}: ${answers[0] || 'new inquiry'}`,
                  clientId,
                  area: 'Unassigned',
                  stage: 'consult',
                  owner: 'me',
                  billing: { kind: 'hourly', rate: 350 },
                  priority: 'normal',
                  nextDeadline: start.slice(0, 10),
                  opened: new Date().toISOString().slice(0, 10),
                },
              ]
            : x.matters;
          const ev: CalEvent = {
            id: newId('e'),
            title: `${isProspect ? 'Consult' : type.name}: ${name}`,
            start,
            minutes: type.minutes,
            matterId: isProspect ? matterId : undefined,
            kind: 'consult',
          };
          const msg: Message = {
            id: newId('msg'),
            channel: 'intake',
            author: 'system',
            text: `${name} booked "${type.name}". ${isProspect ? 'Lead created in Intake; conflict check queued' : 'Added to calendar'}.${answers[1] ? ` Parties named: ${answers[1]}.` : ''}`,
            at: new Date().toISOString(),
            clientVisible: false,
          };
          return { ...x, clients, matters, events: [...x.events, ev], messages: [...x.messages, msg] };
        });
      },
      toggleEventType(id: string) {
        setS((x) => ({ ...x, eventTypes: x.eventTypes.map((t) => (t.id === id ? { ...t, active: !t.active } : t)) }));
      },
      updateEventType(id: string, patch: Partial<seed.EventType>) {
        setS((x) => ({ ...x, eventTypes: x.eventTypes.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
      },
      simulateIncomingCall() {
        setS((x) => ({
          ...x,
          activeCall: { contact: 'Coastal Roofing Co.', number: '(555) 602-7731', matterId: 'm4', startedAt: Date.now() },
        }));
      },
      /** Ends the call, logs it and drafts a time entry. `demoSeconds` stands in for real call length. */
      endCall(demoSeconds = 440) {
        setS((x) => {
          if (!x.activeCall) return x;
          const c = x.activeCall;
          const log: CallLog = { id: newId('p'), matterId: c.matterId, contact: c.contact, number: c.number, direction: 'in', at: new Date().toISOString(), seconds: demoSeconds, logged: !!c.matterId };
          const entries = c.matterId
            ? [
                {
                  id: newId('t'),
                  matterId: c.matterId,
                  date: new Date().toISOString().slice(0, 10),
                  actualMinutes: Math.ceil(demoSeconds / 60),
                  description: `Phone call with ${c.contact}`,
                  user: 'me',
                  billable: true,
                  invoiced: false,
                  source: 'call' as const,
                },
                ...x.timeEntries,
              ]
            : x.timeEntries;
          return { ...x, activeCall: null, calls: [log, ...x.calls], timeEntries: entries };
        });
      },
      logCall(id: string, matterId: string) {
        setS((x) => {
          const call = x.calls.find((c) => c.id === id);
          if (!call) return x;
          const entry: TimeEntry = {
            id: newId('t'),
            matterId,
            date: call.at.slice(0, 10),
            actualMinutes: Math.ceil(call.seconds / 60),
            description: `Phone call with ${call.contact}`,
            user: 'me',
            billable: true,
            invoiced: false,
            source: 'call',
          };
          return { ...x, calls: x.calls.map((c) => (c.id === id ? { ...c, matterId, logged: true } : c)), timeEntries: [entry, ...x.timeEntries] };
        });
      },
    }),
    [],
  );

  const lookup = useMemo(
    () => ({
      matter: (id: string) => s.matters.find((m) => m.id === id),
      client: (id: string) => s.clients.find((c) => c.id === id),
      clientOf: (m: Matter) => s.clients.find((c) => c.id === m.clientId),
    }),
    [s.matters, s.clients],
  );

  return { s, actions, lookup, screen, matterId, go, toast, notify };
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
