import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../auth/AuthContext.jsx";
import FileRow from "../components/FileRow.jsx";
import FolderRow from "../components/FolderRow.jsx";
import UploadModal from "../components/UploadModal.jsx";

const byName = (a, b) =>
  a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });

const SORTERS = {
  newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
  oldest: (a, b) => a.createdAt.localeCompare(b.createdAt),
  nameAsc: (a, b) => byName(a.originalname, b.originalname),
  nameDesc: (a, b) => byName(b.originalname, a.originalname),
};

export default function Home() {
  const { user, logout } = useAuth();
  const [params] = useSearchParams();
  const folderId = params.get("folder"); // null = top level; also makes back/refresh work

  const [data, setData] = useState({ folders: [], files: [], breadcrumbs: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("newest");
  const [creating, setCreating] = useState(false);
  const [folderName, setFolderName] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    setNotice(null);
    setQuery("");
    setCreating(false);
    api.browse(folderId)
      .then((res) => { if (!cancelled) setData(res); })
      .catch((err) => { if (!cancelled) setLoadError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [folderId]);

  const { folders, files, breadcrumbs } = data;
  const currentName = breadcrumbs.length ? breadcrumbs[breadcrumbs.length - 1].name : "Your files";

  const visibleFolders = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? folders.filter((f) => f.name.toLowerCase().includes(q)) : folders;
    return [...list].sort((a, b) => byName(a.name, b.name));
  }, [folders, query]);

  const visibleFiles = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? files.filter((f) => f.originalname.toLowerCase().includes(q)) : files;
    return [...list].sort(SORTERS[sort]);
  }, [files, query, sort]);

  const closeUpload = useCallback(() => setUploadOpen(false), []);
  const isEmpty = folders.length === 0 && files.length === 0;

  function handleUploaded(saved) {
    setData((d) => ({ ...d, files: [saved, ...d.files] }));
    setUploadOpen(false);
    setNotice({ kind: "ok", text: `Uploaded ${saved.originalname}.` });
  }

  async function handleCreateFolder(e) {
    e.preventDefault();
    const name = folderName.trim();
    if (!name) return;
    try {
      const { folder } = await api.createFolder(name, folderId);
      setData((d) => ({ ...d, folders: [...d.folders, folder] }));
      setFolderName("");
      setCreating(false);
      setNotice({ kind: "ok", text: `Created folder ${folder.name}.` });
    } catch (err) {
      setNotice({ kind: "error", text: err.message });
    }
  }

  async function handleDeleteFolder(folder) {
    try {
      await api.deleteFolder(folder.id);
      setData((d) => ({ ...d, folders: d.folders.filter((f) => f.id !== folder.id) }));
      setNotice({ kind: "ok", text: `Deleted folder ${folder.name}.` });
    } catch (err) {
      setNotice({ kind: "error", text: err.message });
      throw err;
    }
  }

  async function handleDownload(file) {
    setDownloadingId(file.id);
    setNotice(null);
    try {
      const { url } = await api.fileUrl(file.id);
      const a = document.createElement("a");
      a.href = url;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      setNotice({ kind: "error", text: err.message });
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleRename(file, name) {
    setNotice(null);
    try {
      const { file: updated } = await api.renameFile(file.id, name);
      setData((d) => ({ ...d, files: d.files.map((f) => (f.id === updated.id ? updated : f)) }));
      setNotice({ kind: "ok", text: "Renamed." });
    } catch (err) {
      setNotice({ kind: "error", text: err.message });
      throw err;
    }
  }

  async function handleDelete(file) {
    setNotice(null);
    try {
      await api.deleteFile(file.id);
      setData((d) => ({ ...d, files: d.files.filter((f) => f.id !== file.id) }));
      setNotice({ kind: "ok", text: `Deleted ${file.originalname}.` });
    } catch (err) {
      setNotice({ kind: "error", text: err.message });
      throw err;
    }
  }

  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const countText = query.trim()
    ? `${visibleFolders.length + visibleFiles.length} matches`
    : `${plural(folders.length, "folder")}, ${plural(files.length, "file")}`;

  return (
    <>
      <header className="topbar">
        <span className="brand">Cloud Drive</span>
        <div className="topbar-right">
          <span className="who">{user?.username}</span>
          <button type="button" className="btn ghost small" onClick={logout}>Log out</button>
        </div>
      </header>

      <main className="page">
        {breadcrumbs.length > 0 && (
          <nav className="crumbs" aria-label="Folder path">
            <Link to="/home">Your files</Link>
            {breadcrumbs.map((c, i) => (
              <span key={c.id}>
                <span className="crumb-sep" aria-hidden="true">/</span>
                {i === breadcrumbs.length - 1
                  ? <span aria-current="page">{c.name}</span>
                  : <Link to={`/home?folder=${c.id}`}>{c.name}</Link>}
              </span>
            ))}
          </nav>
        )}

        <div className="page-head">
          <div>
            <h1>{currentName}</h1>
            {!loading && !loadError && <p className="muted">{countText}</p>}
          </div>
          <div className="head-actions">
            <button type="button" className="btn ghost" onClick={() => setCreating(true)}>
              New folder
            </button>
            <button type="button" className="btn primary" onClick={() => setUploadOpen(true)}>
              Upload file
            </button>
          </div>
        </div>

        {creating && (
          <form className="new-folder" onSubmit={handleCreateFolder}>
            <input
              className="rename-input"
              placeholder="Folder name"
              aria-label="Folder name"
              value={folderName}
              maxLength={100}
              autoFocus
              onChange={(e) => setFolderName(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setCreating(false)}
            />
            <button className="btn primary small" type="submit">Create</button>
            <button className="btn ghost small" type="button" onClick={() => setCreating(false)}>
              Cancel
            </button>
          </form>
        )}

        {!isEmpty && (
          <div className="toolbar">
            <input
              type="search"
              className="search"
              placeholder="Search this folder"
              aria-label="Search this folder"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select className="select" aria-label="Sort files" value={sort}
              onChange={(e) => setSort(e.target.value)}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="nameAsc">Name A to Z</option>
              <option value="nameDesc">Name Z to A</option>
            </select>
          </div>
        )}

        {notice && (
          <p className={`notice ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>
            {notice.text}
          </p>
        )}

        {loading && <p className="muted" role="status">Loading…</p>}
        {loadError && <p className="notice error" role="alert">{loadError}</p>}

        {!loading && !loadError && isEmpty && (
          <div className="empty">
            <p>{folderId ? "This folder is empty." : "No files yet."}</p>
            <button type="button" className="btn primary" onClick={() => setUploadOpen(true)}>
              Upload a file
            </button>
          </div>
        )}

        {!isEmpty && visibleFolders.length + visibleFiles.length === 0 && (
          <p className="muted">Nothing matches “{query}”.</p>
        )}

        {!loading && visibleFolders.length + visibleFiles.length > 0 && (
          <ul className="file-list">
            {visibleFolders.map((folder) => (
              <FolderRow key={folder.id} folder={folder} onDelete={handleDeleteFolder} />
            ))}
            {visibleFiles.map((file) => (
              <FileRow
                key={file.id}
                file={file}
                busy={downloadingId === file.id}
                onDownload={handleDownload}
                onRename={handleRename}
                onDelete={handleDelete}
              />
            ))}
          </ul>
        )}
      </main>

      {uploadOpen && (
        <UploadModal folderId={folderId} onClose={closeUpload} onUploaded={handleUploaded} />
      )}
    </>
  );
}