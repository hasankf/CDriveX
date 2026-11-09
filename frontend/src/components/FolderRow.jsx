import { useState } from "react";
import { Link } from "react-router-dom";
import { FolderIcon, TrashIcon } from "./Icons.jsx";

export default function FolderRow({ folder, onDelete }) {
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);

  async function remove() {
    setWorking(true);
    try {
      await onDelete(folder);
    } catch {
      setWorking(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <li className="file-row">
        <span className="folder-icon"><FolderIcon /></span>
        <span className="file-name">Delete “{folder.name}” and everything inside it?</span>
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
      <span className="folder-icon"><FolderIcon /></span>
      <Link className="file-name folder-link" to={`/home?folder=${folder.id}`}>
        {folder.name}
      </Link>
      <button className="icon-btn" onClick={() => setConfirming(true)}
        aria-label={`Delete folder ${folder.name}`} title="Delete folder">
        <TrashIcon />
      </button>
    </li>
  );
}