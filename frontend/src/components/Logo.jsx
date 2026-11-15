import { Link } from "react-router-dom";

// Icon from the brand logo + live text wordmark (stays sharp on any screen).
export default function Logo({ size = 34, to = "/", className = "" }) {
  return (
    <Link
      to={to}
      className={`logo ${className}`}
      style={{ "--logo-size": `${size}px` }}
      aria-label="CDriveX home"
    >
      <img src="/logo-mark.png" alt="" />
      <span className="logo-word">
        CDRIVE<span>X</span>
      </span>
    </Link>
  );
}
