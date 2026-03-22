import { useEffect, useRef, useState } from "react";
import { api, apiForm, getToken } from "../api/client";

export type EmployeeFileRow = {
  id: string;
  title: string;
  category: string;
  fileName: string;
  uploadedAt: string;
  expiresAt: string | null;
};

const CATEGORIES = ["Contracts", "Policies & acknowledgements", "Personal", "Training & certificates", "Other"];

export function EmployeeFilesPage() {
  const [files, setFiles] = useState<EmployeeFileRow[]>([]);
  const [filter, setFilter] = useState<string>("All");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]!);
  const [expiresAt, setExpiresAt] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void loadFiles();
  }, []);

  async function loadFiles() {
    try {
      setError(null);
      const res = await api<{
        items: {
          id: string;
          title: string;
          category: string;
          fileName: string;
          fileUrl: string;
          createdAt: string;
          expiresAt: string | null;
        }[];
      }>("/api/employee/files");
      setFiles(
        res.items.map((d) => ({
          id: d.id,
          title: d.title,
          category: d.category,
          fileName: d.fileName,
          uploadedAt: d.createdAt,
          expiresAt: d.expiresAt,
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load files");
    }
  }

  async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    if (!list?.length) return;
    try {
      setError(null);
      for (let i = 0; i < list.length; i++) {
        const f = list[i]!;
        const form = new FormData();
        form.append("file", f);
        if (title.trim()) form.append("title", title.trim());
        if (category) form.append("category", category);
        if (expiresAt) form.append("expiresAt", expiresAt);
        await apiForm("/api/employee/files", form);
      }
      setMsg(`${list.length} file(s) uploaded.`);
      setTimeout(() => setMsg(null), 3000);
      setTitle("");
      setExpiresAt("");
      await loadFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      e.target.value = "";
    }
  }

  async function removeFile(id: string) {
    try {
      setError(null);
      await api(`/api/employee/files/${id}`, { method: "DELETE" });
      setFiles((prev) => prev.filter((f) => f.id !== id));
      setMsg("File removed.");
      setTimeout(() => setMsg(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function downloadFile(id: string, fileName: string) {
    try {
      setError(null);
      const token = getToken();
      const res = await fetch(`/api/employee/files/${id}/download`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    }
  }

  const filtered = filter === "All" ? files : files.filter((f) => f.category === filter);

  return (
    <div className="w-full space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Employee files</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          Secure storage for your personal employee documents. Upload, view, and download your files anytime.
        </p>
      </header>

      {msg && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100">
          {msg}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
          {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">
          Document title
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Optional title"
          />
        </label>
        <label className="text-sm">
          Category
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Expiry date
          <input
            type="date"
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        </label>
      </div>

      <div
        className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/50 px-6 py-12 text-center transition hover:border-slate-400 dark:border-slate-600 dark:bg-slate-900/30"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        role="button"
        tabIndex={0}
      >
        <input ref={inputRef} type="file" multiple className="hidden" onChange={onPickFiles} />
        <p className="font-medium text-slate-800 dark:text-slate-200">Drop files here or click to upload</p>
        <p className="mt-1 text-sm text-slate-500">Files are saved to the HRIS document storage.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {["All", ...CATEGORIES].map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setFilter(c)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition ${
              filter === c
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <ul className="space-y-3">
        {filtered.length === 0 && (
          <li className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-900">
            No files in this category.
          </li>
        )}
        {filtered.map((f) => (
          <li
            key={f.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium text-slate-900 dark:text-slate-100">{f.title}</div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                <span>{f.category}</span>
                <span className="truncate">{f.fileName}</span>
                <span>{new Date(f.uploadedAt).toLocaleDateString()}</span>
                {f.expiresAt ? <span>Expires {new Date(f.expiresAt).toLocaleDateString()}</span> : null}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void downloadFile(f.id, f.fileName)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-600"
              >
                Download
              </button>
              <button
                type="button"
                onClick={() => void removeFile(f.id)}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700 dark:border-red-800 dark:text-red-300"
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
