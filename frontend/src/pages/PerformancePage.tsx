import { useEffect, useState } from "react";
import { api } from "../api/client";

type Review = {
  id: string;
  periodStart: string;
  periodEnd: string;
  rating: string | null;
  employee: { firstName: string; lastName: string };
};

export function PerformancePage() {
  const [items, setItems] = useState<Review[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ items: Review[] }>("/api/performance/reviews")
      .then((r) => setItems(r.items))
      .catch(() => setError("Could not load reviews"));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Performance</h1>
      <p className="text-slate-500">Reviews and KPI records</p>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      <div className="mt-6 space-y-3">
        {items.map((r) => (
          <div
            key={r.id}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="font-medium">
              {r.employee.firstName} {r.employee.lastName}
            </div>
            <div className="text-sm text-slate-500">
              {new Date(r.periodStart).toLocaleDateString()} – {new Date(r.periodEnd).toLocaleDateString()}
              {r.rating ? ` · Rating ${r.rating}` : ""}
            </div>
          </div>
        ))}
      </div>
      {items.length === 0 && !error && <p className="mt-4 text-slate-500">No reviews yet.</p>}
    </div>
  );
}
