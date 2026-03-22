import { useEffect, useState } from "react";
import { api } from "../../api/client";

type Enrollment = {
  id: string;
  attended: boolean;
  certified: boolean;
  program: {
    id: string;
    name: string;
    description: string | null;
    startDate: string | null;
    endDate: string | null;
  };
};

export function MyTrainingPage() {
  const [items, setItems] = useState<Enrollment[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ items: Enrollment[] }>("/api/training/my-programs")
      .then((r) => setItems(r.items))
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load your training"));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold">My training</h1>
      <p className="text-slate-500">Programs where you are enrolled</p>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      <ul className="mt-6 space-y-3">
        {items.map((enrollment) => (
          <li
            key={enrollment.id}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="font-medium">{enrollment.program.name}</div>
            <div className="mt-1 text-sm text-slate-500">
              {enrollment.program.description ?? "No description"}
            </div>
            <div className="mt-2 text-xs text-slate-500">
              {enrollment.program.startDate ? new Date(enrollment.program.startDate).toLocaleDateString() : "TBD"}
              {" - "}
              {enrollment.program.endDate ? new Date(enrollment.program.endDate).toLocaleDateString() : "TBD"}
              {enrollment.attended ? " • Attended" : ""}
              {enrollment.certified ? " • Certified" : ""}
            </div>
          </li>
        ))}
      </ul>
      {items.length === 0 && !error && <p className="mt-4 text-slate-500">No training enrollments yet.</p>}
    </div>
  );
}
