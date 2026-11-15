import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api.js";
import {
  CloseIcon,
  FileIcon,
  FolderIcon,
  SendIcon,
  SparklesIcon,
} from "./Icons.jsx";

const STARTER_PROMPTS = [
  "Summarize the key points in the selected documents.",
  "What are the most important skills, dates, or numbers mentioned?",
  "Compare the details across the selected files.",
];

export default function AskAIDrawer({
  open,
  onClose,
  targetFile,
  onOpenSource,
}) {
  const [library, setLibrary] = useState({ folders: [], files: [] });
  const [loadingLib, setLoadingLib] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(true);
  const [pickerSearch, setPickerSearch] = useState("");

  // Multi-select arrays of folder IDs and file IDs
  const [selectedFolderIds, setSelectedFolderIds] = useState([]);
  const [selectedFileIds, setSelectedFileIds] = useState([]);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Load entire Drive file/folder library whenever drawer opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingLib(true);
    setError("");
    setPickerSearch("");

    if (targetFile) {
      setSelectedFileIds([targetFile.id]);
      setSelectedFolderIds([]);
      setPickerOpen(false);
    } else {
      setPickerOpen(true);
    }

    api
      .ragLibrary()
      .then((res) => {
        if (!cancelled) setLibrary(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoadingLib(false);
      });

    setTimeout(() => inputRef.current?.focus(), 60);
    return () => {
      cancelled = true;
    };
  }, [open, targetFile]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const filteredFolders = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    if (!q) return library.folders;
    return library.folders.filter(
      (f) =>
        f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q)
    );
  }, [library.folders, pickerSearch]);

  const filteredFiles = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    if (!q) return library.files;
    return library.files.filter(
      (f) =>
        f.originalname.toLowerCase().includes(q) ||
        f.folderPath.toLowerCase().includes(q)
    );
  }, [library.files, pickerSearch]);

  if (!open) return null;

  function toggleFolder(id) {
    setSelectedFolderIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleFile(id) {
    setSelectedFileIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function clearSelection() {
    setSelectedFolderIds([]);
    setSelectedFileIds([]);
  }

  async function sendQuestion(rawText) {
    const question = rawText.trim();
    if (!question || loading) return;

    setError("");
    setInput("");
    setPickerOpen(false);
    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setLoading(true);

    try {
      const res = await api.askAi({
        question,
        fileIds: selectedFileIds,
        folderIds: selectedFolderIds,
      });
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: res.answer, sources: res.sources || [] },
      ]);
    } catch (err) {
      setError(err.message || "Could not get an answer.");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    sendQuestion(input);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendQuestion(input);
    }
  }

  const totalSelected = selectedFolderIds.length + selectedFileIds.length;
  const folderNameMap = new Map(library.folders.map((f) => [f.id, f.name]));
  const fileNameMap = new Map(library.files.map((f) => [f.id, f.originalname]));

  return (
    <div className="ai-drawer-backdrop" onClick={onClose}>
      <aside
        className="ai-drawer"
        role="dialog"
        aria-label="Ask CDriveX AI"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ai-drawer-head">
          <div className="ai-title">
            <SparklesIcon />
            <h2>Ask CDriveX AI</h2>
          </div>
          <div className="ai-head-actions">
            {messages.length > 0 && (
              <button
                type="button"
                className="btn ghost small"
                onClick={() => setMessages([])}
              >
                Clear chat
              </button>
            )}
            <button
              type="button"
              className="icon-btn"
              onClick={onClose}
              aria-label="Close AI drawer"
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* Upfront File & Folder Selector */}
        <div className="ai-picker-section">
          <div className="ai-picker-header">
            <span className="ai-picker-summary">
              {totalSelected === 0
                ? "Asking across: All Drive Files"
                : `Selected: ${totalSelected} source${totalSelected === 1 ? "" : "s"}`}
            </span>
            <div className="ai-picker-actions">
              {totalSelected > 0 && (
                <button
                  type="button"
                  className="ai-link-btn"
                  onClick={clearSelection}
                >
                  All files
                </button>
              )}
              <button
                type="button"
                className="btn ghost small"
                onClick={() => setPickerOpen((v) => !v)}
              >
                {pickerOpen ? "Done" : "Choose files / folders"}
              </button>
            </div>
          </div>

          {/* Selected Chips */}
          {totalSelected > 0 && (
            <div className="ai-selected-chips">
              {selectedFolderIds.map((id) => (
                <button
                  key={id}
                  type="button"
                  className="ai-scope-pill is-active"
                  onClick={() => toggleFolder(id)}
                  title="Click to remove folder"
                >
                  Folder: {folderNameMap.get(id) || "Folder"} ×
                </button>
              ))}
              {selectedFileIds.map((id) => (
                <button
                  key={id}
                  type="button"
                  className="ai-scope-pill is-active"
                  onClick={() => toggleFile(id)}
                  title="Click to remove file"
                >
                  {fileNameMap.get(id) || "File"} ×
                </button>
              ))}
            </div>
          )}

          {/* Expandable Checklist of All Folders & Files */}
          {pickerOpen && (
            <div className="ai-picker-box">
              <input
                type="search"
                className="ai-picker-search"
                placeholder="Filter folders or files…"
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
              />

              {loadingLib ? (
                <p className="muted ai-picker-empty">Loading your files…</p>
              ) : filteredFolders.length === 0 && filteredFiles.length === 0 ? (
                <p className="muted ai-picker-empty">
                  No PDF, TXT, MD, or CSV files found in your Drive.
                </p>
              ) : (
                <div className="ai-picker-list">
                  {filteredFolders.map((folder) => {
                    const checked = selectedFolderIds.includes(folder.id);
                    return (
                      <label key={folder.id} className="ai-picker-item">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleFolder(folder.id)}
                        />
                        <span className="folder-icon">
                          <FolderIcon width={16} height={16} />
                        </span>
                        <span className="ai-picker-item-main">
                          <span className="ai-picker-name">{folder.name}</span>
                          <span className="ai-picker-path">
                            Folder (+ subfolders) · {folder.path}
                          </span>
                        </span>
                      </label>
                    );
                  })}

                  {filteredFiles.map((file) => {
                    const checked = selectedFileIds.includes(file.id);
                    return (
                      <label key={file.id} className="ai-picker-item">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleFile(file.id)}
                        />
                        <span className="file-icon">
                          <FileIcon width={16} height={16} />
                        </span>
                        <span className="ai-picker-item-main">
                          <span className="ai-picker-name">
                            {file.originalname}
                          </span>
                          <span className="ai-picker-path">
                            {file.folderPath}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Chat Messages */}
        <div className="ai-messages">
          {messages.length === 0 && !loading && (
            <div className="ai-empty">
              <p className="muted">
                Pick specific files or folders above (or leave empty to search
                your whole Drive), then ask a question below.
              </p>
              <div className="ai-suggestions">
                {STARTER_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className="ai-suggestion-btn"
                    onClick={() => sendQuestion(prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={`ai-msg ai-msg-${msg.role}`}>
              <div className="ai-msg-bubble">{msg.text}</div>

              {msg.sources?.length > 0 && (
                <div className="ai-sources">
                  <span className="ai-sources-label">Sources:</span>
                  {msg.sources.map((src) => (
                    <button
                      key={src.fileId}
                      type="button"
                      className="ai-source-chip"
                      title={src.snippet}
                      onClick={() =>
                        onOpenSource?.({
                          id: src.fileId,
                          originalname: src.fileName,
                        })
                      }
                    >
                      <FileIcon width={14} height={14} />
                      <span>{src.fileName}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="ai-msg ai-msg-ai">
              <div className="ai-msg-bubble ai-typing">
                Indexing &amp; searching selected documents…
              </div>
            </div>
          )}

          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input Form */}
        <form className="ai-input-form" onSubmit={handleSubmit}>
          <textarea
            ref={inputRef}
            className="ai-textarea"
            rows={2}
            placeholder="Ask a question about your documents… (Enter to send)"
            value={input}
            maxLength={1000}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />
          <button
            type="submit"
            className="btn primary ai-send-btn"
            disabled={loading || !input.trim()}
            aria-label="Send question"
          >
            <SendIcon />
          </button>
        </form>
      </aside>
    </div>
  );
}
