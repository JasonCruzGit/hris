import { useEffect, useState } from "react";
import { api } from "../api/client";

type Program = {
  id: string;
  name: string;
  description: string | null;
  _count: { enrollments: number };
};

export function TrainingPage() {
  const [items, setItems] = useState<Program[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ items: Program[] }>("/api/training/programs")
      .then((r) => setItems(r.items))
      .catch(() => setError("Could not load programs"));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Training &amp; development</h1>
      <p className="text-slate-500">Programs, attendance, certifications</p>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      <ul className="mt-6 space-y-3">
        {items.map((p) => (
          <li
            key={p.id}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="font-medium">{p.name}</div>
            <div className="text-sm text-slate-500">
              {p.description ?? "—"} · {p._count.enrollments} enrolled
            </div>
          </li>
        ))}
      </ul>
      {items.length === 0 && !error && <p className="mt-4 text-slate-500">No programs yet.</p>}
    </div>
  );
}
