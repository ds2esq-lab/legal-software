// Who hears about a client's portal message, and how. Alerts outside the app never carry the
// message or the client's name: an email or text can be seen by anyone near a phone, so it only
// says there's something to read and where.
import { teamName, type Matter } from './data';

export interface NotifySettings {
  also: string[]; // alerted on every portal message, besides the matter's responsible attorney
  replyTask: boolean; // create a "Reply to portal message" task
  replyWithin: number; // due within this many business hours
  channels: Record<string, { email: boolean; text: boolean }>; // per person, on top of the in-app alert
  firmName: string; // shown to clients
  myName: string; // the signed-in owner's real name (the app calls them "You")
  sender: 'person' | 'firm'; // clients see who wrote, or just the firm
}

export const DEFAULT_NOTIFY: NotifySettings = {
  also: ['dana'],
  replyTask: true,
  replyWithin: 4,
  firmName: 'Don Shaw Law',
  myName: 'Don Shaw',
  sender: 'person',
  channels: { me: { email: true, text: true }, marcus: { email: true, text: false }, dana: { email: true, text: false }, priya: { email: true, text: false }, lena: { email: false, text: false } },
};

export interface Alert {
  id: string;
  at: string;
  to: string;
  via: 'app' | 'email' | 'text';
  matterId: string;
  text: string;
}

export const alertText = (m: Matter, via: Alert['via']) =>
  via === 'app' ? `New portal message on ${m.name}` : `New client message on matter ${m.number}. Sign in to Docket to read it.`;

/** How a firm-side message is signed in the client portal. */
export function clientFacingName(author: string, n: NotifySettings) {
  if (author === 'system' || n.sender === 'firm') return n.firmName;
  return `${author === 'me' ? n.myName : teamName(author)} · ${n.firmName}`;
}
