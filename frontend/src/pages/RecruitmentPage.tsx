import { useEffect, useState } from "react";
import { api, publicForm, publicJson } from "../api/client";
import { useAuth } from "../auth/AuthContext";

type Job = { id: string; title: string; department: string | null; location: string | null; description: string };
type Applicant = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  stage: string;
  jobPosting: { title: string };
};

const stages = ["APPLIED", "SCREENING", "INTERVIEW", "OFFER", "HIRED", "REJECTED"] as const;

export function RecruitmentPage() {
  const { user } = useAuth();
  const canHr = ["SUPER_ADMIN", "HR_ADMIN"].includes(user?.role ?? "");

  const [publicJobs, setPublicJobs] = useState<Job[]>([]);
  const [internalJobs, setInternalJobs] = useState<Job[]>([]);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [apply, setApply] = useState({
    jobPostingId: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });
  const [resume, setResume] = useState<File | null>(null);

  useEffect(() => {
    publicJson<{ items: Job[] }>("/api/recruitment/public/jobs")
      .then((r) => {
        setPublicJobs(r.items);
        if (r.items[0]) setApply((a) => ({ ...a, jobPostingId: r.items[0].id }));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!canHr) return;
    api<{ items: Job[] }>("/api/recruitment/jobs")
      .then((r) => setInternalJobs(r.items))
      .catch(() => {});
  }, [canHr]);

  useEffect(() => {
    if (!canHr) return;
    api<{ items: Applicant[] }>("/api/recruitment/applicants")
      .then((r) => setApplicants(r.items))
      .catch(() => setApplicants([]));
  }, [canHr, msg]);

  async function submitApplication(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const fd = new FormData();
    fd.append("jobPostingId", apply.jobPostingId);
    fd.append("firstName", apply.firstName);
    fd.append("lastName", apply.lastName);
    fd.append("email", apply.email);
    if (apply.phone) fd.append("phone", apply.phone);
    if (resume) fd.append("resume", resume);
    try {
      await publicForm<{ message: string }>("/api/recruitment/public/apply", fd);
      setMsg("Application submitted. Thank you.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Apply failed");
    }
  }

  async function moveStage(id: string, stage: (typeof stages)[number]) {
    try {
      await api(`/api/recruitment/applicants/${id}/stage`, {
        method: "PATCH",
        body: JSON.stringify({ stage }),
      });
      setMsg("Stage updated.");
      const r = await api<{ items: Applicant[] }>("/api/recruitment/applicants");
      setApplicants(r.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">Recruitment & careers</h1>
        <p className="text-slate-500">Public applications and internal ATS</p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {msg && <p className="text-sm text-green-700 dark:text-green-400">{msg}</p>}

      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-medium">Open positions (public)</h2>
        <ul className="mt-3 space-y-3">
          {publicJobs.map((j) => (
            <li key={j.id} className="rounded-lg border border-slate-100 p-3 text-sm dark:border-slate-800">
              <div className="font-semibold">{j.title}</div>
              <div className="text-slate-500">
                {j.department ?? "—"} · {j.location ?? "—"}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-slate-600 dark:text-slate-300">{j.description}</p>
            </li>
          ))}
          {publicJobs.length === 0 && <li className="text-slate-500">No open roles.</li>}
        </ul>

        <h3 className="mt-8 font-medium">Apply (no login)</h3>
        <form className="mt-3 grid gap-3 text-sm" onSubmit={submitApplication}>
          <label>
            Position
            <select
              required
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 dark:border-slate-700 dark:bg-slate-950"
              value={apply.jobPostingId}
              onChange={(e) => setApply((a) => ({ ...a, jobPostingId: e.target.value }))}
            >
              {publicJobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label>
              First name
              <input
                required
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 dark:border-slate-700 dark:bg-slate-950"
                value={apply.firstName}
                onChange={(e) => setApply((a) => ({ ...a, firstName: e.target.value }))}
              />
            </label>
            <label>
              Last name
              <input
                required
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 dark:border-slate-700 dark:bg-slate-950"
                value={apply.lastName}
                onChange={(e) => setApply((a) => ({ ...a, lastName: e.target.value }))}
              />
            </label>
          </div>
          <label>
            Email
            <input
              type="email"
              required
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 dark:border-slate-700 dark:bg-slate-950"
              value={apply.email}
              onChange={(e) => setApply((a) => ({ ...a, email: e.target.value }))}
            />
          </label>
          <label>
            Phone
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 dark:border-slate-700 dark:bg-slate-950"
              value={apply.phone}
              onChange={(e) => setApply((a) => ({ ...a, phone: e.target.value }))}
            />
          </label>
          <label>
            Resume (optional)
            <input
              type="file"
              className="mt-1 w-full text-sm"
              onChange={(e) => setResume(e.target.files?.[0] ?? null)}
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-white dark:bg-white dark:text-slate-900"
          >
            Submit application
          </button>
        </form>
      </section>

      {canHr && (
        <section>
          <h2 className="font-medium">ATS pipeline</h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {stages.map((stage) => (
              <div key={stage} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                <h3 className="text-xs font-semibold uppercase text-slate-500">{stage}</h3>
                <ul className="mt-2 space-y-2 text-sm">
                  {applicants
                    .filter((a) => a.stage === stage)
                    .map((a) => (
                      <li key={a.id} className="rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
                        <div className="font-medium">
                          {a.firstName} {a.lastName}
                        </div>
                        <div className="text-xs text-slate-500">{a.jobPosting.title}</div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {stages
                            .filter((s) => s !== a.stage)
                            .map((s) => (
                              <button
                                key={s}
                                type="button"
                                className="rounded border border-slate-300 px-1.5 py-0.5 text-xs dark:border-slate-600"
                                onClick={() => void moveStage(a.id, s)}
                              >
                                → {s}
                              </button>
                            ))}
                        </div>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Internal job count: {internalJobs.length} (create jobs as HR from API or seed).
          </p>
        </section>
      )}
    </div>
  );
}
