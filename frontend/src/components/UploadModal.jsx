import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { CloseIcon, UploadCloudIcon } from "./Icons.jsx";

import { ACCEPT, MAX_BYTES, isAllowed } from "../fileTypes.js";

  function checkFile(file) {
    if (!isAllowed(file.name)) return "That file type isn’t supported.";
    if (file.size > MAX_BYTES) return "That file is larger than 10 MB.";
    return "";
  }

export default function UploadModal({ folderId, onClose, onUploaded }) {
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0) ;
  const closeRef = useRef(null);
  const inputRef = useRef(null);

  // Focus the dialog on open, close on Escape.
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  function pick(candidate) {
    if (!candidate) return;
    const problem = checkFile(candidate);
    setError(problem);
    setFile(problem ? null : candidate);
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    pick(e.dataTransfer.files?.[0]);
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!file) {
      setError("Choose a PDF to upload.");
      return;
    }
    setError("");
    setBusy(true);
    setProgress(0)
    try {
      const { file: saved } = await api.uploadFile(file, folderId, setProgress);
      onUploaded(saved);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-title"
      >
        <div className="modal-head">
          <h2 id="upload-title">Upload a file</h2>
          <button
            ref={closeRef}
            type="button"
            className="icon-btn"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <label
            className={`dropzone${dragging ? " is-dragging" : ""}${file ? " has-file" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <UploadCloudIcon width={32} height={32} />
            {file ? (
              <>
                <span className="dz-main">{file.name}</span>
                <span className="dz-sub">Click to choose a different file</span>
              </>
            ) : (
              <>
                <span className="dz-main">
                  <strong>Click to upload</strong> or drag and drop
                </span>
                <span className="dz-sub">PDF, up to 10 MB</span>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              name="file"
              accept="application/pdf"
              onChange={(e) => pick(e.target.files?.[0])}
            />
          </label>

          {busy && (
          <div className="progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <div className="progress-bar" style={{ width: `${progress}%` }} />
            <span className="progress-text">
              {progress < 100 ? `Uploading… ${progress}%` : "Finishing up…"}
            </span>
          </div>
        )}

          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}

          <div className="modal-actions">
            <button
              type="button"
              className="btn ghost"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={busy || !file}>
              {busy ? "Uploading…" : "Upload file"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
