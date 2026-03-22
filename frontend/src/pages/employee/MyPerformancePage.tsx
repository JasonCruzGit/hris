import { useEffect, useState } from "react";
import { api } from "../../api/client";

type Review = {
  id: string;
  periodStart: string;
  periodEnd: string;
  rating: string | null;
  comments: string | null;
  reviewer: { firstName: string; lastName: string } | null;
};

export function MyPerformancePage() {
  const [items, setItems] = useState<Review[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ items: Review[] }>("/api/performance/my-reviews")
      .then((r) => setItems(r.items))
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load your reviews"));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold">My performance</h1>
      <p className="text-slate-500">Your review history and ratings</p>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      <div className="mt-6 space-y-3">
        {items.map((r) => (
          <div
            key={r.id}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="font-medium">
              {new Date(r.periodStart).toLocaleDateString()} - {new Date(r.periodEnd).toLocaleDateString()}
            </div>
            <div className="mt-1 text-sm text-slate-500">
              {r.rating ? `Rating ${r.rating}` : "No rating yet"}
              {r.reviewer ? ` • Reviewer: ${r.reviewer.firstName} ${r.reviewer.lastName}` : ""}
            </div>
            {r.comments && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{r.comments}</p>}
          </div>
        ))}
      </div>
      {items.length === 0 && !error && <p className="mt-4 text-slate-500">No reviews yet.</p>}
    </div>
  );
}
