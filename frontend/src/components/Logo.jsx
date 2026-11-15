import { Link } from "react-router-dom";
import logoMark from "../logo-mark.png";

export default function Logo({ size = 34, to = "/", className = "" }) {
  return (
    <Link
      to={to}
      className={`logo ${className}`}
      style={{ "--logo-size": `${size}px` }}
      aria-label="CDriveX home"
    >
      <img src={logoMark} alt="" />
      <span className="logo-word">
        CDRIVE<span>X</span>
      </span>
    </Link>
  );
}
