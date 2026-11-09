// Thin wrapper around fetch. Every call goes to /api and sends the auth cookie.

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function request(path, { method = "GET", body, formData } = {}) {
  const options = { method, credentials: "same-origin", headers: {} };

  if (formData) {
    options.body = formData; // browser sets the multipart boundary itself
  } else if (body) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`/api${path}`, options);
  } catch {
    throw new ApiError(
      "Can’t reach the server. Check your connection and try again.",
      0
    );
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(
      data?.message || "Something went wrong. Try again.",
      res.status,
      data
    );
  }
  return data;
}

export const api = {
  // Auth
  me: () => request("/auth/me"),
  login: (credentials) =>
    request("/auth/login", { method: "POST", body: credentials }),
  register: (details) =>
    request("/auth/register", { method: "POST", body: details }),
  logout: () => request("/auth/logout", { method: "POST" }),

  // Folders and listing
  browse: (folderId) =>
    request(`/browse${folderId ? `?folder=${encodeURIComponent(folderId)}` : ""}`),
  createFolder: (name, parentId) =>
    request("/folders", { method: "POST", body: { name, parentId } }),
  deleteFolder: (id) =>
    request(`/folders/${encodeURIComponent(id)}`, { method: "DELETE" }),

  // Files
  // Uses XMLHttpRequest because fetch can't report upload progress.
  uploadFile: (file, folderId, onProgress) =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/files");
      xhr.withCredentials = true;
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress?.(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onload = () => {
        let data = null;
        try {
          data = JSON.parse(xhr.responseText);
        } catch {}
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else
          reject(
            new ApiError(
              data?.message || "Something went wrong. Try again.",
              xhr.status,
              data
            )
          );
      };
      xhr.onerror = () =>
        reject(
          new ApiError(
            "Can’t reach the server. Check your connection and try again.",
            0
          )
        );
      const formData = new FormData();
      formData.append("folderId", folderId || ""); // must come before the file
      formData.append("file", file);
      xhr.send(formData);
    }),
  fileUrl: (id) => request(`/files/${encodeURIComponent(id)}/url`),
  renameFile: (id, name) =>
    request(`/files/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: { name },
    }),
  deleteFile: (id) =>
    request(`/files/${encodeURIComponent(id)}`, { method: "DELETE" }),
};