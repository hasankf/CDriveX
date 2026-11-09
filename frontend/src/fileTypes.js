const KINDS = {
  pdf: "pdf",
  png: "image", jpg: "image", jpeg: "image", gif: "image", webp: "image",
  txt: "text", md: "text", csv: "text",
  doc: "doc", docx: "doc",
  xls: "sheet", xlsx: "sheet",
  ppt: "slides", pptx: "slides",
  zip: "archive", mp3: "audio", mp4: "video",
};

export const ACCEPT = Object.keys(KINDS).map((e) => `.${e}`).join(",");
export const MAX_BYTES = 10 * 1024 * 1024;

export function extOf(name) {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i + 1).toLowerCase();
}
export const isAllowed = (name) => Object.hasOwn(KINDS, extOf(name));
export const kindOf = (name) => KINDS[extOf(name)] || "file";

export function formatSize(bytes) {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}