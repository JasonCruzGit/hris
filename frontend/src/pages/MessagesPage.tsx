import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";

type Thread = {
  userId: string;
  email: string;
  role: string;
  updatedAt: string;
  unread: number;
  lastMessage: string;
};

type ChatMessage = {
  id: string;
  senderUserId: string;
  recipientUserId: string;
  body: string;
  createdAt: string;
};

type Contact = {
  id: string;
  email: string;
  role: string;
};

export function MessagesPage() {
  const { user } = useAuth();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState("");

  async function loadThreads() {
    try {
      const res = await api<{ items: Thread[] }>("/api/messages/threads");
      setThreads(res.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load threads");
    }
  }

  async function loadContacts() {
    try {
      const res = await api<{ items: Contact[] }>("/api/messages/contacts");
      setContacts(res.items);
    } catch {
      // ignore
    }
  }

  async function loadMessages(otherUserId: string) {
    try {
      const res = await api<{ items: ChatMessage[] }>(`/api/messages/with/${otherUserId}`);
      setMessages(res.items);
      setThreads((prev) => prev.map((t) => (t.userId === otherUserId ? { ...t, unread: 0 } : t)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load messages");
    }
  }

  useEffect(() => {
    void loadThreads();
    void loadContacts();
  }, []);

  useEffect(() => {
    if (activeId) void loadMessages(activeId);
    else setMessages([]);
  }, [activeId]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void loadThreads();
      if (activeId) void loadMessages(activeId);
    }, 10000);
    return () => window.clearInterval(id);
  }, [activeId]);

  const active = useMemo(() => {
    return (
      threads.find((x) => x.userId === activeId) ??
      contacts.find((x) => x.id === activeId) ?? {
        userId: "",
        email: "",
        role: "",
        updatedAt: "",
        unread: 0,
        lastMessage: "",
      }
    );
  }, [threads, contacts, activeId]);

  const list = useMemo(() => {
    const noThread = contacts
      .filter((c) => !threads.some((t) => t.userId === c.id))
      .map((c) => ({
        userId: c.id,
        email: c.email,
        role: c.role,
        updatedAt: "",
        unread: 0,
        lastMessage: "",
      }));
    const base = [...threads, ...noThread];
    return base.filter((t) => {
      if (unreadOnly && t.unread === 0) return false;
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        return t.email.toLowerCase().includes(q) || t.lastMessage.toLowerCase().includes(q);
      }
      return true;
    });
  }, [threads, contacts, unreadOnly, query]);

  const unreadTotal = useMemo(() => threads.reduce((sum, t) => sum + t.unread, 0), [threads]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const recipientId = composeOpen ? composeTo : activeId;
    if (!draft.trim() || !recipientId) return;
    try {
      const row = await api<ChatMessage>(`/api/messages/with/${recipientId}`, {
        method: "POST",
        body: JSON.stringify({ body: draft.trim() }),
      });
      if (composeOpen) {
        setActiveId(recipientId);
        setComposeOpen(false);
        setComposeTo("");
      }
      setMessages((prev) => [...prev, row]);
      setDraft("");
      await loadThreads();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send message");
    }
  }

  async function markAllRead() {
    try {
      await api<{ count: number }>("/api/messages/read-all", { method: "PATCH" });
      setThreads((prev) => prev.map((t) => ({ ...t, unread: 0 })));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not mark all as read");
    }
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] w-full flex-col gap-4 md:h-[calc(100vh-10rem)]">
      <header className="shrink-0">
        <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">Employee and HR messaging. Signed in as {user?.email ?? "—"}.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setComposeOpen((v) => !v);
              if (!composeTo && contacts[0]) setComposeTo(contacts[0].id);
              if (!composeOpen) setDraft("");
            }}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-slate-900"
          >
            {composeOpen ? "Close compose" : "Compose"}
          </button>
          <input
            className="w-64 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            placeholder="Search conversations..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <label className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />
            Unread only
          </label>
          <button
            type="button"
            onClick={() => void markAllRead()}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"
          >
            Mark all read ({unreadTotal})
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </header>

      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 md:grid-cols-[280px_1fr]">
        <aside className="flex flex-col border-b border-slate-200 dark:border-slate-800 md:border-b-0 md:border-r">
          <div className="border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase text-slate-500 dark:border-slate-800">
            Inbox
          </div>
          <ul className="flex-1 overflow-y-auto p-2">
            {list.map((t) => (
              <li key={t.userId}>
                <button
                  type="button"
                  onClick={() => setActiveId(t.userId)}
                  className={`mb-1 w-full rounded-lg px-3 py-2.5 text-left text-sm transition ${
                    activeId === t.userId
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                      : "hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium">{t.email}</span>
                    {t.unread > 0 && (
                      <span className="shrink-0 rounded-full bg-sky-500 px-1.5 text-[10px] font-bold text-white">
                        {t.unread}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 line-clamp-1 text-xs opacity-80">{t.lastMessage || t.role}</div>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="flex min-h-0 flex-col">
          <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <h2 className="font-semibold">{composeOpen ? "Compose new message" : active.email || "Select a thread"}</h2>
            <p className="text-xs text-slate-500">{composeOpen ? "Start a new conversation" : active.role}</p>
          </div>

          {composeOpen && (
            <form onSubmit={send} className="border-b border-slate-200 p-3 dark:border-slate-800">
              <div className="rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-950">
                <div className="mb-2 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2 dark:border-slate-700">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">To</span>
                  <select
                    className="min-w-[260px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                    value={composeTo}
                    onChange={(e) => setComposeTo(e.target.value)}
                    required
                  >
                    <option value="">Select recipient</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.email} ({c.role})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setComposeOpen(false)}
                    className="ml-auto rounded-md border border-slate-200 px-2 py-1 text-xs dark:border-slate-700"
                  >
                    Close
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <input
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                    placeholder="Write message..."
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    disabled={!composeTo}
                  />
                  <button
                    type="submit"
                    disabled={!composeTo || !draft.trim()}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
                  >
                    Send
                  </button>
                </div>
              </div>
            </form>
          )}

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {composeOpen ? (
              <p className="text-center text-sm text-slate-500">Compose mode is open. Pick a recipient and send your message above.</p>
            ) : (
              <>
                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.senderUserId === user?.id ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                        m.senderUserId === user?.id
                          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                          : "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{m.body}</p>
                      <p className="mt-1 text-[10px] opacity-70">{new Date(m.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
                {activeId && messages.length === 0 && <p className="text-center text-sm text-slate-500">No messages yet. Say hello below.</p>}
              </>
            )}
          </div>

          {!composeOpen && (
            <form onSubmit={send} className="border-t border-slate-200 p-3 dark:border-slate-800">
              <div className="flex flex-wrap gap-2">
                <input
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                  placeholder="Type a message..."
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  disabled={!activeId}
                />
                <button
                  type="submit"
                  disabled={!activeId || !draft.trim()}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
                >
                  Send
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
