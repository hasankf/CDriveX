import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import Logo from "../components/Logo.jsx";
import FileBadge from "../components/FileBadge.jsx";
import { FolderIcon } from "../components/Icons.jsx";

const FEATURES = [
  {
    title: "Ask AI across your files",
    text: "Query specific PDFs, entire folder trees, or your whole Drive using hybrid vector + keyword search with inline source citations.",
  },
  {
    title: "Folders that nest",
    text: "Organise files the way you already think: folders inside folders, with a path you can click back through.",
  },
  {
    title: "Private to your account",
    text: "Only you can open your files. Every download uses a link that expires after a minute.",
  },
];

const PREVIEW_FOLDERS = ["Resumes", "Invoices"];
const PREVIEW_FILES = [
  ["Resume 2026.pdf", "212 KB", "10 Nov 2026"],
  ["Trip to Goa.jpg", "3.4 MB", "8 Nov 2026"],
  ["Budget.xlsx", "48 KB", "2 Nov 2026"],
];

export default function Landing() {
  const { status } = useAuth();
  const isAuthed = status === "authed";

  return (
    <div className="landing">
      <header className="land-nav">
        <Logo size={34} to="/" />
        <nav className="land-nav-actions" aria-label="Account">
          {isAuthed ? (
            <Link className="btn primary small" to="/home">Open Drive</Link>
          ) : (
            <>
              <Link className="btn ghost small" to="/login">Log in</Link>
              <Link className="btn primary small" to="/register">Get started</Link>
            </>
          )}
        </nav>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <h1>Keep every file within reach.</h1>
            <p className="hero-lead">
              CDriveX stores your documents, images and more in private
              folders, lets you ask AI questions across them, and hands you a
              fresh download link whenever you need one.
            </p>
            <div className="hero-cta">
              {isAuthed ? (
                <Link className="btn primary big" to="/home">Go to your files</Link>
              ) : (
                <>
                  <Link className="btn primary big" to="/register">Create your account</Link>
                  <Link className="btn ghost big" to="/login">Log in</Link>
                </>
              )}
            </div>
            <p className="hero-note">PDFs, images, Office files and more, up to 10 MB each.</p>
          </div>

          <div className="hero-preview" aria-hidden="true">
            <div className="preview-window">
              <div className="preview-head">
                <span className="preview-path">
                  Your files <i>/</i> <b>Documents</b>
                </span>
                <span className="preview-pill">Upload file</span>
              </div>
              <ul className="file-list preview-list">
                {PREVIEW_FOLDERS.map((name) => (
                  <li className="file-row" key={name}>
                    <span className="folder-icon"><FolderIcon /></span>
                    <span className="file-name">{name}</span>
                  </li>
                ))}
                {PREVIEW_FILES.map(([name, size, date]) => (
                  <li className="file-row" key={name}>
                    <FileBadge name={name} />
                    <span className="file-name">{name}</span>
                    <span className="file-size">{size}</span>
                    <span className="file-date">{date}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="features" aria-label="Features">
          {FEATURES.map((f) => (
            <div className="feature" key={f.title}>
              <h2>{f.title}</h2>
              <p>{f.text}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="land-foot">
        <Logo size={22} to="/" />
        <span className="muted">© {new Date().getFullYear()} CDriveX</span>
      </footer>
    </div>
  );
}
