import { useState } from 'react';
import { useStore } from '../store';
import { teamName, type Matter } from '../data';
import * as D from '../docs';
import { fmtDate } from '../ui';

const ICON: Record<string, string> = { PDF: '📕', DOCX: '📘', DOC: '📘', XLSX: '📗', XLS: '📗', MSG: '✉️', EML: '✉️', JPG: '🖼️', PNG: '🖼️' };

export function MatterDocs({ m }: { m: Matter }) {
  const { s, actions, lookup, notify } = useStore();
  const [folder, setFolder] = useState<string>('');
  const [newFolder, setNewFolder] = useState('');
  const [q, setQ] = useState('');
  const [over, setOver] = useState(false);
  const area = lookup.areaOf(m);
  const client = lookup.clientOf(m);
  const name = D.folderName(s.docSettings, m, client?.name ?? 'Client', area);
  const root = m.status === 'closed' && s.docSettings.moveOnClose ? s.docSettings.closedRoot : s.docSettings.openRoot;
  const folders = D.subfolders(s.docSettings, m, s.docFolders);
  const files = s.docFiles.filter((d) => d.matterId === m.id);
  const term = q.trim().toLowerCase();
  const shown = files
    .filter((d) => (term ? d.name.toLowerCase().includes(term) : folder ? d.folder === folder : true))
    .sort((a, b) => b.modified.localeCompare(a.modified));
  const target = folder || folders[0];

  const upload = (list: FileList | null) => {
    if (!list?.length) return;
    actions.uploadDocs(m.id, target, [...list].map((f) => ({ name: f.name, sizeKb: Math.max(1, Math.round(f.size / 1024)) })));
    notify(`${list.length} file${list.length === 1 ? '' : 's'} saved to SharePoint › ${target}`);
  };

  return (
    <section className="panel">
      <div className="panel-head" style={{ flexWrap: 'wrap' }}>
        <div className="crumbs small" aria-label="SharePoint location">
          <span className="muted">{s.docSettings.site} › {root} ›</span>
          <button className="link" onClick={() => { setFolder(''); setQ(''); }}>{name}</button>
          {folder && <><span className="muted">›</span><strong>{folder}</strong></>}
        </div>
        <span className="row" style={{ gap: 6 }}>
          <span className="pill ok" title="Simulated: the real version syncs with SharePoint through Microsoft Graph">✓ In sync with SharePoint</span>
          <button className="btn sm" onClick={() => notify('Opens this folder in SharePoint (after the Microsoft 365 connection is set up)')}>Open in SharePoint</button>
        </span>
      </div>
      <div className="docs">
        <nav className="doc-folders" aria-label="Folders">
          <button className={!folder && !term ? 'on' : ''} onClick={() => { setFolder(''); setQ(''); }}>
            <span>📂 All files</span><span className="num small muted">{files.length}</span>
          </button>
          {folders.map((f) => (
            <button key={f} className={folder === f && !term ? 'on' : ''} onClick={() => { setFolder(f); setQ(''); }}>
              <span>📁 {f}</span><span className="num small muted">{files.filter((d) => d.folder === f).length || ''}</span>
            </button>
          ))}
          <form className="row" style={{ gap: 4, padding: '6px 8px' }} onSubmit={(e) => { e.preventDefault(); if (newFolder.trim()) { actions.addFolder(m.id, newFolder.trim()); setFolder(newFolder.trim()); setNewFolder(''); } }}>
            <input className="input small" style={{ flex: 1, minWidth: 0 }} id="new-folder" aria-label="New folder" placeholder="New folder" value={newFolder} onChange={(e) => setNewFolder(e.target.value)} />
            <button className="btn sm" type="submit">Add</button>
          </form>
        </nav>
        <div className="doc-main">
          <div className="row" style={{ padding: '10px 12px', gap: 8 }}>
            <input className="input small" style={{ flex: '1 1 200px' }} id="doc-search" aria-label="Search this matter's files" placeholder="Search this matter’s files…" value={q} onChange={(e) => setQ(e.target.value)} />
            <label className="btn sm primary" style={{ cursor: 'pointer' }}>
              Upload to {target}
              <input type="file" multiple style={{ display: 'none' }} id="doc-upload" onChange={(e) => { upload(e.target.files); e.target.value = ''; }} />
            </label>
          </div>
          <div
            className={`dropzone ${over ? 'over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); upload(e.dataTransfer.files); }}
          >
            <div className="table-wrap">
              <table className="t">
                <thead><tr><th>Name</th>{(!folder || term) && <th>Folder</th>}<th>Modified</th><th>Version</th><th>Client portal</th><th /></tr></thead>
                <tbody>
                  {shown.length === 0 && <tr><td colSpan={6} className="muted">{term ? 'No files match.' : 'Empty folder. Drop files here or use Upload.'}</td></tr>}
                  {shown.map((d) => (
                    <tr key={d.id}>
                      <td style={{ minWidth: 220 }}>
                        <button className="link" onClick={() => notify(`Opens ${d.name} in ${D.ext(d.name) === 'DOCX' ? 'Word' : D.ext(d.name) === 'XLSX' ? 'Excel' : 'the viewer'} for the web`)}>{ICON[D.ext(d.name)] ?? '📄'} {d.name}</button>
                        <div className="small muted num">{d.sizeKb >= 1024 ? `${(d.sizeKb / 1024).toFixed(1)} MB` : `${d.sizeKb} KB`}</div>
                      </td>
                      {(!folder || term) && <td className="small">{d.folder}</td>}
                      <td className="small">{fmtDate(d.modified)} · {teamName(d.modifiedBy)}</td>
                      <td className="num small">v{d.version}</td>
                      <td>
                        <label className="row small" style={{ gap: 4 }}>
                          <input type="checkbox" id={`share-${d.id}`} checked={d.shared} onChange={(e) => { actions.updateDoc(d.id, { shared: e.target.checked }); notify(e.target.checked ? `${d.name} is now visible in the client portal` : 'Removed from the client portal'); }} />
                          {d.shared ? 'Shared' : 'Internal'}
                        </label>
                        {d.signature && <span className={`pill ${d.signature === 'signed' ? 'ok' : 'warn'}`}>{d.signature === 'signed' ? 'Signed' : 'Awaiting signature'}</span>}
                      </td>
                      <td className="r" style={{ whiteSpace: 'nowrap' }}>
                        {!d.signature && D.ext(d.name) === 'PDF' && (
                          <button className="btn sm ghost" onClick={() => { actions.updateDoc(d.id, { signature: 'requested', shared: true }); notify('Sent for e-signature through the client portal'); }}>Request signature</button>
                        )}
                        <button className="btn sm ghost icon danger" aria-label={`Delete ${d.name}`} onClick={() => { actions.deleteDoc(d.id); notify('Moved to the SharePoint recycle bin'); }}>×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
