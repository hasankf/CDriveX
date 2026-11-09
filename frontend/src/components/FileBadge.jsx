import { extOf, kindOf } from "../fileTypes.js";

export default function FileBadge({ name }) {
  return (
    <span className="file-badge" data-kind={kindOf(name)} aria-hidden="true">
      {extOf(name).slice(0, 4) || "file"}
    </span>
  );
}