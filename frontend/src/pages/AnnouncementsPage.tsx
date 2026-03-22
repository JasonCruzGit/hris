import { useEffect, useState } from "react";
import { api, apiForm } from "../api/client";
import { useAuth } from "../auth/AuthContext";

type Announcement = {
  id: string;
  title: string;
  summary: string;
  body: string;
  createdAt: string;
  audience: string;
  pinned: boolean;
  imageUrl?: string | null;
};

export function AnnouncementsPage() {
  const { user } = useAuth();
  const canManage = ["SUPER_ADMIN", "HR_ADMIN", "DEPARTMENT_HEAD"].includes(user?.role ?? "");
  const [items, setItems] = useState<Announcement[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pinned">("all");
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    summary: "",
    body: "",
    audience: "All employees",
    pinned: false,
  });
  const [image, setImage] = useState<File | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    try {
      const res = await api<{ items: Announcement[] }>("/api/announcements");
      setItems(res.items);
      setExpanded((curr) => curr ?? res.items[0]?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load announcements");
    }
  }

  async function publish(e: React.FormEvent) {
    e.preventDefault();
    try {
      const fd = new FormData();
      fd.append("title", form.title);
      fd.append("summary", form.summary);
      fd.append("body", form.body);
      fd.append("audience", form.audience);
      fd.append("pinned", String(form.pinned));
      if (image) fd.append("image", image);
      await apiForm("/api/announcements", fd);
      setForm({ title: "", summary: "", body: "", audience: "All employees", pinned: false });
      setImage(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not publish");
    }
  }

  async function saveEdit(id: string, payload: Partial<Announcement>) {
    try {
      await api(`/api/announcements/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setEditingId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update");
    }
  }

  async function remove(id: string) {
    try {
      await api(`/api/announcements/${id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete");
    }
  }

  const list = filter === "pinned" ? items.filter((a) => a.pinned) : items;

  return (
    <div className="w-full space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Announcements</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          Company and HR news.
        </p>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </header>

      {canManage && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Publish announcement</h2>
          <form className="mt-3 grid gap-3 md:grid-cols-2" onSubmit={publish}>
            <input
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
            />
            <input
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              placeholder="Audience"
              value={form.audience}
              onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value }))}
              required
            />
            <input
              className="md:col-span-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              placeholder="Summary"
              value={form.summary}
              onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
              required
            />
            <textarea
              className="md:col-span-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              rows={3}
              placeholder="Full body"
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              required
            />
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.pinned}
                onChange={(e) => setForm((f) => ({ ...f, pinned: e.target.checked }))}
              />
              Pin
            </label>
            <label className="text-sm md:col-span-2">
              Attach image
              <input
                type="file"
                accept="image/*"
                className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                onChange={(e) => setImage(e.target.files?.[0] ?? null)}
              />
            </label>
            <button
              type="submit"
              className="justify-self-start rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900"
            >
              Publish
            </button>
          </form>
        </section>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium ${
            filter === "all"
              ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
          }`}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => setFilter("pinned")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium ${
            filter === "pinned"
              ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
          }`}
        >
          Pinned only
        </button>
      </div>

      <ul className="space-y-4">
        {list.map((a) => {
          const open = expanded === a.id;
          return (
            <li
              key={a.id}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <button
                type="button"
                onClick={() => setExpanded(open ? null : a.id)}
                className="flex w-full flex-col gap-1 px-5 py-4 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/80"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {a.pinned && (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                      Pinned
                    </span>
                  )}
                  <span className="text-xs text-slate-500">{new Date(a.createdAt).toLocaleDateString()}</span>
                  <span className="text-xs text-slate-500">· {a.audience}</span>
                </div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{a.title}</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">{a.summary}</p>
                <span className="text-xs font-medium text-sky-700 dark:text-sky-400">{open ? "Show less" : "Read more"}</span>
              </button>
              {open && (
                <div className="border-t border-slate-100 px-5 pb-5 pt-2 text-sm leading-relaxed text-slate-700 dark:border-slate-800 dark:text-slate-300">
                  {editingId === a.id ? (
                    <EditAnnouncementForm
                      initial={a}
                      onCancel={() => setEditingId(null)}
                      onSave={(payload) => void saveEdit(a.id, payload)}
                    />
                  ) : (
                    <>
                      {a.imageUrl && (
                        <img
                          src={a.imageUrl}
                          alt={a.title}
                          className="mb-3 max-h-64 w-full rounded-lg object-cover"
                        />
                      )}
                      <p>{a.body}</p>
                      {canManage && (
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingId(a.id)}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs dark:border-slate-700"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void remove(a.id)}
                            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-700 dark:border-red-800 dark:text-red-300"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {list.length === 0 && (
        <p className="text-center text-slate-500">No pinned announcements.</p>
      )}
    </div>
  );
}

function EditAnnouncementForm({
  initial,
  onCancel,
  onSave,
}: {
  initial: Announcement;
  onCancel: () => void;
  onSave: (payload: Partial<Announcement>) => void;
}) {
  const [form, setForm] = useState({
    title: initial.title,
    summary: initial.summary,
    body: initial.body,
    audience: initial.audience,
    pinned: initial.pinned,
  });

  return (
    <form
      className="grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(form);
      }}
    >
      <input
        className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
        value={form.title}
        onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
      />
      <input
        className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
        value={form.summary}
        onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
      />
      <textarea
        rows={3}
        className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
        value={form.body}
        onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
      />
      <input
        className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
        value={form.audience}
        onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value }))}
      />
      <label className="inline-flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={form.pinned}
          onChange={(e) => setForm((f) => ({ ...f, pinned: e.target.checked }))}
        />
        Pinned
      </label>
      <div className="flex gap-2">
        <button type="submit" className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white dark:bg-white dark:text-slate-900">
          Save
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs dark:border-slate-700">
          Cancel
        </button>
      </div>
    </form>
  );
}
