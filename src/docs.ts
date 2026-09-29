// Documents live in SharePoint; the app creates each matter's folder from a practice-area template
// and shows the folder's contents inside the matter. (Simulated here; the real version uses Microsoft Graph.)
import type { Matter } from './data';
import type { PracticeArea } from './practice';
import { addDays, todayISO } from './practice';

export interface DocSettings {
  site: string; // SharePoint site and library
  openRoot: string; // library folder for open matters
  closedRoot: string; // where former matters' folders move
  pattern: string; // folder name: {NUMBER} {CLIENT} {AREA} {YEAR}
  templates: Record<string, string[]>; // subfolders per practice area
  moveOnClose: boolean;
}

export const DEFAULT_DOC_SETTINGS: DocSettings = {
  site: 'Firm SharePoint › Client Files',
  openRoot: 'Open Matters',
  closedRoot: 'Closed Matters',
  pattern: '{NUMBER} {CLIENT} – {AREA}',
  moveOnClose: true,
  templates: {
    ep: ['01 Intake & Engagement', '02 Questionnaire & Info', '03 Drafts', '04 Signed Originals (scans)', '05 Funding', '06 Correspondence'],
    fpet: ['01 Intake & Engagement', '02 Court Filings', '03 Notices', '04 Inventory', '05 Accountings', '06 Asset Records', '07 Correspondence'],
    ipet: ['01 Intake & Engagement', '02 Court Filings', '03 Notices', '04 Asset Records', '05 Correspondence'],
    gc: ['01 Intake & Engagement', '02 Medical Evaluations', '03 Court Filings', '04 Hearing', '05 Reports', '06 Correspondence'],
    deed: ['01 Intake & Engagement', '02 Title & Vesting', '03 Drafts', '04 Recorded'],
    biz: ['01 Intake & Engagement', '02 Formation Documents', '03 Drafts', '04 Signed', '05 Correspondence'],
    fam: ['01 Intake & Engagement', '02 Financial Disclosures', '03 Drafts', '04 Signed', '05 Correspondence'],
  },
};

export interface DocFile {
  id: string;
  matterId: string;
  folder: string;
  name: string;
  sizeKb: number;
  modified: string;
  modifiedBy: string;
  version: number;
  shared: boolean; // visible in the client portal
  signature?: 'requested' | 'signed';
}

export function folderName(s: DocSettings, m: Matter, clientName: string, area: PracticeArea | undefined) {
  return s.pattern
    .replace(/\{NUMBER\}/g, m.number)
    .replace(/\{CLIENT\}/g, clientName.split(',')[0].trim())
    .replace(/\{AREA\}/g, area?.name ?? '')
    .replace(/\{YEAR\}/g, m.opened.slice(0, 4))
    .replace(/\s+/g, ' ')
    .trim();
}

export function subfolders(s: DocSettings, m: Matter, extra: Record<string, string[]>) {
  return [...(s.templates[m.areaId] ?? ['01 Documents']), ...(extra[m.id] ?? [])];
}

export const ext = (name: string) => (name.split('.').pop() ?? '').toUpperCase();

// ---------- Sample files ----------

let n = 0;
const f = (matterId: string, folder: string, name: string, ago: number, by: string, extra: Partial<DocFile> = {}): DocFile => ({
  id: `doc${++n}`, matterId, folder, name, sizeKb: 40 + ((n * 137) % 900), modified: addDays(todayISO(), -ago), modifiedBy: by, version: 1, shared: false, ...extra,
});

export const DOC_FILES: DocFile[] = [
  f('m1', '01 Intake & Engagement', 'Engagement Letter (signed).pdf', 40, 'dana', { shared: true, signature: 'signed' }),
  f('m1', '01 Intake & Engagement', 'Consult notes.docx', 41, 'me'),
  f('m1', '02 Questionnaire & Info', 'EP Questionnaire (completed).pdf', 25, 'dana', { shared: true }),
  f('m1', '02 Questionnaire & Info', 'Asset summary.xlsx', 24, 'dana'),
  f('m1', '03 Drafts', 'Whitford Joint Revocable Trust – DRAFT.docx', 17, 'me', { version: 2, shared: true }),
  f('m1', '03 Drafts', 'Pour-over Wills – DRAFT.docx', 17, 'me', { shared: true }),
  f('m1', '03 Drafts', 'Revision list.docx', 1, 'marcus'),
  f('m1', '06 Correspondence', 'Email – trustee order question.msg', 1, 'me'),
  f('m4', '01 Intake & Engagement', 'Engagement Letter (signed).pdf', 70, 'dana', { shared: true, signature: 'signed' }),
  f('m4', '03 Drafts', 'Brennan Trust – FINAL.docx', 30, 'me', { version: 4, shared: true }),
  f('m4', '03 Drafts', 'Signing instructions.pdf', 3, 'dana', { shared: true }),
  f('m8', '01 Intake & Engagement', 'Engagement Letter (signed).pdf', 120, 'priya', { shared: true, signature: 'signed' }),
  f('m8', '02 Court Filings', 'Petition for Probate (filed).pdf', 90, 'priya', { shared: true }),
  f('m8', '02 Court Filings', 'Letters of Administration.pdf', 52, 'priya', { shared: true }),
  f('m8', '03 Notices', 'Notice to Creditors (proof of publication).pdf', 44, 'priya'),
  f('m8', '04 Inventory', 'Inventory worksheet.xlsx', 5, 'priya', { version: 3 }),
  f('m8', '06 Asset Records', 'Bank statements – date of death.pdf', 60, 'priya'),
  f('m14', '03 Court Filings', 'Petition for Guardianship.pdf', 58, 'me', { shared: true }),
  f('m14', '02 Medical Evaluations', 'Physician evaluation.pdf', 70, 'dana'),
  f('m14', '04 Hearing', 'Notice of Hearing.pdf', 2, 'dana', { shared: true }),
  f('m17', '02 Title & Vesting', 'Current vesting deed.pdf', 5, 'dana'),
  f('m17', '03 Drafts', 'RTODD – DRAFT.docx', 1, 'dana'),
  f('m19', '04 Recorded', 'Deed of Gift (recorded).pdf', 2, 'dana', { shared: true }),
  f('m20', '01 Intake & Engagement', 'Engagement Letter.pdf', 15, 'marcus', { shared: true, signature: 'requested' }),
  f('m20', '03 Drafts', 'Operating Agreement – DRAFT.docx', 3, 'marcus'),
];
