import { useState } from "react";
import { DownloadIcon, FileIcon, PencilIcon, TrashIcon } from "./Icons.jsx";

export default function FileRow({ file, busy, onDownload, onRename, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(file.originalname);
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);

  const date = new Date(file.createdAt).toLocaleDateString(undefined, {
    day: "numeric", month: "short", year: "numeric",
  });

  async function save(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed === file.originalname) return setEditing(false);
    setWorking(true);
    try {
      await onRename(file, trimmed);
      setEditing(false);
    } catch {
      /* Home shows the error message */
    } finally {
      setWorking(false);
    }
  }

  async function remove() {
    setWorking(true);
    try {
      await onDelete(file);
    } catch {
      setWorking(false);
      setConfirming(false);
    }
  }

  if (editing) {
    return (
      <li className="file-row">
        <span className="file-icon"><FileIcon /></span>
        <form className="rename-form" onSubmit={save}>
          <input
            className="rename-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
            aria-label="New file name"
            maxLength={255}
            autoFocus
            onFocus={(e) => e.target.select()}
          />
          <button className="btn primary small" type="submit" disabled={working}>Save</button>
          <button className="btn ghost small" type="button" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </form>
      </li>
    );
  }

  if (confirming) {
    return (
      <li className="file-row">
        <span className="file-icon"><FileIcon /></span>
        <span className="file-name">Delete “{file.originalname}”?</span>
        <button className="btn danger small" onClick={remove} disabled={working}>
          {working ? "Deleting…" : "Delete"}
        </button>
        <button className="btn ghost small" onClick={() => setConfirming(false)} disabled={working}>
          Cancel
        </button>
      </li>
    );
  }

  return (
    <li className="file-row">
      <span className="file-icon"><FileIcon /></span>
      <span className="file-name" title={file.originalname}>{file.originalname}</span>
      <span className="file-date">{date}</span>
      <button className="icon-btn" onClick={() => { setName(file.originalname); setEditing(true); }}
        aria-label={`Rename ${file.originalname}`} title="Rename">
        <PencilIcon />
      </button>
      <button className="icon-btn" onClick={() => onDownload(file)} disabled={busy}
        aria-label={`Download ${file.originalname}`} title="Download">
        <DownloadIcon />
      </button>
      <button className="icon-btn" onClick={() => setConfirming(true)}
        aria-label={`Delete ${file.originalname}`} title="Delete">
        <TrashIcon />
      </button>
    </li>
  );
}