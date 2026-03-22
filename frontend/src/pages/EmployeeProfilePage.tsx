import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { api, apiForm } from "../api/client";
import { useAuth } from "../auth/AuthContext";

type EmergencyRow = { name: string; relationship: string; phone: string; email?: string };

type Employee = {
  id: string;
  employeeNumber: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  dateOfBirth: string | null;
  gender: string | null;
  nationality: string | null;
  civilStatus: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  hireDate: string;
  employmentStatus: string;
  basicSalary: string | number;
  payFrequency: string;
  currency: string;
  bankName: string | null;
  bankAccount: string | null;
  tin: string | null;
  sssNumber: string | null;
  philhealthNumber: string | null;
  pagibigNumber: string | null;
  department: { id: string; name: string; code: string } | null;
  position: { id: string; title: string } | null;
  branch: { id: string; name: string } | null;
  manager: { id: string; firstName: string; lastName: string } | null;
  emergencyContacts: { name: string; phone: string; relationship: string; email?: string | null }[];
  documents: { id: string; title: string; category: string; expiresAt: string | null }[];
  photoUrl?: string | null;
};

type OrgItem = { id: string; name?: string; title?: string };
type BranchItem = { id: string; name: string };

type StaffForm = {
  employeeNumber: string;
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  nationality: string;
  civilStatus: string;
  email: string;
  phone: string;
  address: string;
  hireDate: string;
  employmentStatus: "ACTIVE" | "PROBATIONARY" | "ON_LEAVE" | "TERMINATED";
  departmentId: string;
  positionId: string;
  branchId: string;
  managerId: string;
  basicSalary: string;
  payFrequency: string;
  currency: string;
  bankName: string;
  bankAccount: string;
  tin: string;
  sssNumber: string;
  philhealthNumber: string;
  pagibigNumber: string;
};

const STAFF_EDIT_ROLES = ["SUPER_ADMIN", "HR_ADMIN"] as const;

function toDateInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function initialsFromName(first: string, last: string): string {
  const a = first.trim()[0];
  const b = last.trim()[0];
  return `${a ?? "?"}${b ?? "?"}`.toUpperCase();
}

function employmentStatusStyles(status: string): string {
  const u = status.toUpperCase();
  if (u === "ACTIVE") return "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200";
  if (u === "PROBATIONARY") return "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200";
  if (u === "ON_LEAVE") return "bg-sky-100 text-sky-900 dark:bg-sky-950/60 dark:text-sky-200";
  if (u === "TERMINATED") return "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200";
  return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
}

export function EmployeeProfilePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [emp, setEmp] = useState<Employee | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [selfUnlocked, setSelfUnlocked] = useState(false);
  const [staffUnlocked, setStaffUnlocked] = useState(false);

  const [securityOpen, setSecurityOpen] = useState(false);
  const [securityMode, setSecurityMode] = useState<"self" | "staff" | null>(null);
  const [securityPassword, setSecurityPassword] = useState("");
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [securityBusy, setSecurityBusy] = useState(false);

  const [edit, setEdit] = useState({
    phone: "",
    address: "",
    email: "",
    contacts: [] as EmergencyRow[],
  });

  const [departments, setDepartments] = useState<OrgItem[]>([]);
  const [positions, setPositions] = useState<OrgItem[]>([]);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [allEmployees, setAllEmployees] = useState<{ id: string; firstName: string; lastName: string }[]>([]);

  const [staffForm, setStaffForm] = useState<StaffForm>({
    employeeNumber: "",
    firstName: "",
    middleName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "",
    nationality: "",
    civilStatus: "",
    email: "",
    phone: "",
    address: "",
    hireDate: "",
    employmentStatus: "ACTIVE",
    departmentId: "",
    positionId: "",
    branchId: "",
    managerId: "",
    basicSalary: "",
    payFrequency: "MONTHLY",
    currency: "PHP",
    bankName: "",
    bankAccount: "",
    tin: "",
    sssNumber: "",
    philhealthNumber: "",
    pagibigNumber: "",
  });
  const [staffContacts, setStaffContacts] = useState<EmergencyRow[]>([{ name: "", relationship: "", phone: "", email: "" }]);
  const [staffSaving, setStaffSaving] = useState(false);
  const [staffPhoto, setStaffPhoto] = useState<File | null>(null);
  const [staffPhotoPreview, setStaffPhotoPreview] = useState<string | null>(null);

  const isSelf = !!(user?.employee?.id && id === user.employee.id);
  const canStaffEdit = !!(user && STAFF_EDIT_ROLES.includes(user.role as (typeof STAFF_EDIT_ROLES)[number]));

  const loadEmployee = useCallback(async () => {
    if (!id) return;
    const e = await api<Employee>(`/api/employees/${id}`);
    setError(null);
    setEmp(e);
    setEdit({
      phone: e.phone ?? "",
      address: e.address ?? "",
      email: e.email ?? "",
      contacts:
        e.emergencyContacts.length > 0
          ? e.emergencyContacts.map((c) => ({
              name: c.name,
              relationship: c.relationship,
              phone: c.phone,
              email: c.email ?? undefined,
            }))
          : [{ name: "", relationship: "", phone: "", email: "" }],
    });
    setStaffForm({
      employeeNumber: e.employeeNumber,
      firstName: e.firstName,
      middleName: e.middleName ?? "",
      lastName: e.lastName,
      dateOfBirth: toDateInput(e.dateOfBirth),
      gender: e.gender ?? "",
      nationality: e.nationality ?? "",
      civilStatus: e.civilStatus ?? "",
      email: e.email ?? "",
      phone: e.phone ?? "",
      address: e.address ?? "",
      hireDate: toDateInput(e.hireDate),
      employmentStatus: (e.employmentStatus as StaffForm["employmentStatus"]) ?? "ACTIVE",
      departmentId: e.department?.id ?? "",
      positionId: e.position?.id ?? "",
      branchId: e.branch?.id ?? "",
      managerId: e.manager?.id ?? "",
      basicSalary: String(e.basicSalary ?? ""),
      payFrequency: e.payFrequency || "MONTHLY",
      currency: e.currency || "PHP",
      bankName: e.bankName ?? "",
      bankAccount: e.bankAccount ?? "",
      tin: e.tin ?? "",
      sssNumber: e.sssNumber ?? "",
      philhealthNumber: e.philhealthNumber ?? "",
      pagibigNumber: e.pagibigNumber ?? "",
    });
    setStaffContacts(
      e.emergencyContacts.length > 0
        ? e.emergencyContacts.map((c) => ({
            name: c.name,
            relationship: c.relationship,
            phone: c.phone,
            email: c.email ?? "",
          }))
        : [{ name: "", relationship: "", phone: "", email: "" }]
    );
  }, [id]);

  useEffect(() => {
    if (!id) return;
    void loadEmployee().catch(() => setError("Not found or access denied"));
  }, [id, loadEmployee]);

  useEffect(() => {
    if (!staffUnlocked) return;
    void Promise.all([
      api<{ items: OrgItem[] }>("/api/org/departments"),
      api<{ items: OrgItem[] }>("/api/org/positions"),
      api<{ items: { branches: BranchItem[] }[] }>("/api/org/companies"),
      api<{ items: { id: string; firstName: string; lastName: string }[] }>("/api/employees?page=1&pageSize=500"),
    ]).then(([d, p, companies, emps]) => {
      setDepartments(d.items);
      setPositions(p.items);
      setBranches(companies.items.flatMap((c) => c.branches));
      setAllEmployees(emps.items.filter((row) => row.id !== id));
    });
  }, [staffUnlocked, id]);

  useEffect(() => {
    if (!staffPhoto) {
      setStaffPhotoPreview(null);
      return;
    }
    const url = URL.createObjectURL(staffPhoto);
    setStaffPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [staffPhoto]);

  useEffect(() => {
    if (!staffUnlocked) setStaffPhoto(null);
  }, [staffUnlocked]);

  function openSecurity(mode: "self" | "staff") {
    setSecurityMode(mode);
    setSecurityPassword("");
    setSecurityError(null);
    setSecurityOpen(true);
  }

  async function confirmSecurity() {
    setSecurityError(null);
    setSecurityBusy(true);
    try {
      await api("/api/auth/verify-password", {
        method: "POST",
        body: JSON.stringify({ password: securityPassword }),
      });
      setSecurityOpen(false);
      setSecurityPassword("");
      if (securityMode === "self") {
        setSelfUnlocked(true);
      }
      if (securityMode === "staff") {
        setStaffUnlocked(true);
        void loadEmployee();
      }
    } catch (e) {
      setSecurityError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setSecurityBusy(false);
    }
  }

  async function saveSelf(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setError(null);
    try {
      const contacts = edit.contacts.filter((c) => c.name.trim() && c.relationship.trim() && c.phone.trim());
      const updated = await api<Employee>("/api/employees/me", {
        method: "PATCH",
        body: JSON.stringify({
          phone: edit.phone || undefined,
          address: edit.address || undefined,
          email: edit.email || undefined,
          emergencyContacts: contacts,
        }),
      });
      setEmp(updated);
      setMsg("Profile updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function saveStaff(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setMsg(null);
    setError(null);
    setStaffSaving(true);
    try {
      const emergencyContacts = staffContacts
        .filter((c) => c.name.trim() && c.relationship.trim() && c.phone.trim())
        .map((c) => ({
          name: c.name.trim(),
          relationship: c.relationship.trim(),
          phone: c.phone.trim(),
          email: (c.email ?? "").trim() || undefined,
        }));

      const body: Record<string, unknown> = {
        employeeNumber: staffForm.employeeNumber.trim(),
        firstName: staffForm.firstName.trim(),
        middleName: staffForm.middleName.trim() || undefined,
        lastName: staffForm.lastName.trim(),
        dateOfBirth: staffForm.dateOfBirth || undefined,
        gender: staffForm.gender.trim() || undefined,
        nationality: staffForm.nationality.trim() || undefined,
        civilStatus: staffForm.civilStatus.trim() || undefined,
        address: staffForm.address.trim() || undefined,
        phone: staffForm.phone.trim() || undefined,
        email: staffForm.email.trim() || "",
        hireDate: staffForm.hireDate,
        employmentStatus: staffForm.employmentStatus,
        departmentId: staffForm.departmentId || undefined,
        positionId: staffForm.positionId || undefined,
        branchId: staffForm.branchId || undefined,
        managerId: staffForm.managerId || undefined,
        basicSalary: Number(staffForm.basicSalary),
        payFrequency: staffForm.payFrequency.trim() || "MONTHLY",
        currency: staffForm.currency.trim() || "PHP",
        bankName: staffForm.bankName.trim() || undefined,
        bankAccount: staffForm.bankAccount.trim() || undefined,
        tin: staffForm.tin.trim() || undefined,
        sssNumber: staffForm.sssNumber.trim() || undefined,
        philhealthNumber: staffForm.philhealthNumber.trim() || undefined,
        pagibigNumber: staffForm.pagibigNumber.trim() || undefined,
        emergencyContacts,
      };

      await api(`/api/employees/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      if (staffPhoto) {
        const fd = new FormData();
        fd.append("photo", staffPhoto);
        await apiForm<{ photoUrl: string }>(`/api/employees/${id}/photo`, fd);
        setStaffPhoto(null);
      }
      await loadEmployee();
      setMsg("Employee record updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setStaffSaving(false);
    }
  }

  if (error && !emp) return <p className="text-sm text-red-600">{error}</p>;
  if (!emp) return <p className="text-slate-500">Loading…</p>;

  const hasGovOnFile = !!(emp.tin || emp.sssNumber || emp.philhealthNumber || emp.pagibigNumber);
  const hasDemographics = !!(emp.dateOfBirth || emp.gender || emp.nationality || emp.civilStatus || emp.manager);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 pb-12">
      {securityOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-lg font-semibold">Confirm your identity</h2>
            <p className="mt-1 text-sm text-slate-500">
              Enter your account password to continue editing{" "}
              {securityMode === "staff" ? "this employee record" : "your profile"}.
            </p>
            {securityError && <p className="mt-2 text-sm text-red-600">{securityError}</p>}
            <label className="mt-4 block text-sm">
              <span className="text-slate-500">Password</span>
              <input
                type="password"
                autoComplete="current-password"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                value={securityPassword}
                onChange={(e) => setSecurityPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void confirmSecurity();
                }}
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-slate-700"
                onClick={() => setSecurityOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={securityBusy || !securityPassword}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
                onClick={() => void confirmSecurity()}
              >
                {securityBusy ? "Checking…" : "Continue"}
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className="flex flex-wrap items-center gap-2 text-sm text-slate-500" aria-label="Breadcrumb">
        <Link to="/" className="transition hover:text-slate-900 dark:hover:text-slate-200">
          Home
        </Link>
        {user?.role !== "EMPLOYEE" && (
          <>
            <span className="text-slate-300 dark:text-slate-600">/</span>
            <Link
              to="/employee-database/regular"
              className="transition hover:text-slate-900 dark:hover:text-slate-200"
            >
              Employee database
            </Link>
          </>
        )}
        <span className="text-slate-300 dark:text-slate-600">/</span>
        <span className="font-medium text-slate-900 dark:text-slate-100">Profile</span>
      </nav>

      <header className="overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-slate-50/80 to-slate-100/50 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950">
        <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-start sm:justify-between sm:p-8">
          <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center">
            {emp.photoUrl ? (
              <img
                src={emp.photoUrl}
                alt=""
                className="h-[4.5rem] w-[4.5rem] shrink-0 rounded-2xl object-cover object-top shadow-inner ring-1 ring-slate-200/80 dark:ring-slate-700"
              />
            ) : (
              <div
                className="flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-xl font-semibold tracking-tight text-white shadow-inner dark:bg-white dark:text-slate-900"
                aria-hidden
              >
                {initialsFromName(emp.firstName, emp.lastName)}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Employee record</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                {emp.firstName} {emp.middleName ? `${emp.middleName} ` : ""}
                {emp.lastName}
              </h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {emp.position?.title ?? "No position"} · {emp.department?.name ?? "No department"}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded bg-white px-2.5 py-1 font-mono text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700">
                  {emp.employeeNumber}
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${employmentStatusStyles(emp.employmentStatus)}`}
                >
                  {emp.employmentStatus.replace(/_/g, " ")}
                </span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:items-end">
            <div className="flex flex-wrap gap-2">
              {isSelf && (
                <>
                  {!selfUnlocked ? (
                    <button
                      type="button"
                      onClick={() => openSecurity("self")}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700"
                    >
                      Edit my contact info
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSelfUnlocked(false)}
                      className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium dark:border-slate-600"
                    >
                      Lock editing
                    </button>
                  )}
                </>
              )}
              {canStaffEdit && !isSelf && (
                <>
                  {!staffUnlocked ? (
                    <button
                      type="button"
                      onClick={() => openSecurity("staff")}
                      className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                    >
                      Edit employee details
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setStaffUnlocked(false)}
                      className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium dark:border-slate-600"
                    >
                      Lock editing
                    </button>
                  )}
                </>
              )}
            </div>
            <p className="max-w-md text-right text-xs leading-relaxed text-slate-500">
              Editing is protected. You will be asked to confirm your account password before changes are enabled.
            </p>
          </div>
        </div>
      </header>

      {msg && <p className="text-sm text-green-700 dark:text-green-400">{msg}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {isSelf && selfUnlocked && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-medium">Edit contact info (self-service)</h2>
          <form className="mt-3 grid gap-3 text-sm" onSubmit={saveSelf}>
            <label>
              Email
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 dark:border-slate-700 dark:bg-slate-950"
                value={edit.email}
                onChange={(e) => setEdit((x) => ({ ...x, email: e.target.value }))}
              />
            </label>
            <label>
              Phone
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 dark:border-slate-700 dark:bg-slate-950"
                value={edit.phone}
                onChange={(e) => setEdit((x) => ({ ...x, phone: e.target.value }))}
              />
            </label>
            <label>
              Address
              <textarea
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 dark:border-slate-700 dark:bg-slate-950"
                rows={2}
                value={edit.address}
                onChange={(e) => setEdit((x) => ({ ...x, address: e.target.value }))}
              />
            </label>
            <p className="text-xs text-slate-500">Emergency contacts replace the full list when saved.</p>
            {edit.contacts.map((c, i) => (
              <div key={i} className="grid gap-2 rounded-lg border border-slate-100 p-2 dark:border-slate-800">
                <input
                  placeholder="Name"
                  className="rounded border border-slate-200 px-2 py-1 dark:border-slate-700 dark:bg-slate-950"
                  value={c.name}
                  onChange={(e) => {
                    const next = [...edit.contacts];
                    next[i] = { ...next[i]!, name: e.target.value };
                    setEdit((x) => ({ ...x, contacts: next }));
                  }}
                />
                <input
                  placeholder="Relationship"
                  className="rounded border border-slate-200 px-2 py-1 dark:border-slate-700 dark:bg-slate-950"
                  value={c.relationship}
                  onChange={(e) => {
                    const next = [...edit.contacts];
                    next[i] = { ...next[i]!, relationship: e.target.value };
                    setEdit((x) => ({ ...x, contacts: next }));
                  }}
                />
                <input
                  placeholder="Phone"
                  className="rounded border border-slate-200 px-2 py-1 dark:border-slate-700 dark:bg-slate-950"
                  value={c.phone}
                  onChange={(e) => {
                    const next = [...edit.contacts];
                    next[i] = { ...next[i]!, phone: e.target.value };
                    setEdit((x) => ({ ...x, contacts: next }));
                  }}
                />
              </div>
            ))}
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2 text-white dark:bg-white dark:text-slate-900"
            >
              Save changes
            </button>
          </form>
        </section>
      )}

      {canStaffEdit && staffUnlocked && !isSelf && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-medium">Edit employee record</h2>
          <p className="mt-1 text-xs text-slate-500">Changes are saved to the employee master file (PDS-aligned fields).</p>
          <form className="mt-4 space-y-6" onSubmit={saveStaff}>
            <fieldset className="grid gap-3 md:grid-cols-4">
              <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Personal</legend>
              <div className="md:col-span-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-950/40">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Employee photo</span>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900">
                    {staffPhotoPreview ? (
                      <img src={staffPhotoPreview} alt="" className="h-full w-full object-cover object-top" />
                    ) : emp.photoUrl ? (
                      <img src={emp.photoUrl} alt="" className="h-full w-full object-cover object-top" />
                    ) : (
                      <span className="px-2 text-center text-xs text-slate-400">No photo</span>
                    )}
                  </div>
                  <label className="min-w-0 flex-1 text-sm">
                    <span className="mb-1 block text-xs text-slate-500">
                      Replace or add photo (JPG, PNG, WebP, GIF — max 5 MB). Saved with the record.
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium dark:border-slate-700 dark:bg-slate-950 dark:file:bg-slate-800"
                      onChange={(e) => setStaffPhoto(e.target.files?.[0] ?? null)}
                    />
                  </label>
                </div>
              </div>
              <Field label="Employee #" required value={staffForm.employeeNumber} onChange={(v) => setStaffForm((f) => ({ ...f, employeeNumber: v }))} />
              <Field label="First name" required value={staffForm.firstName} onChange={(v) => setStaffForm((f) => ({ ...f, firstName: v }))} />
              <Field label="Middle name" value={staffForm.middleName} onChange={(v) => setStaffForm((f) => ({ ...f, middleName: v }))} />
              <Field label="Last name" required value={staffForm.lastName} onChange={(v) => setStaffForm((f) => ({ ...f, lastName: v }))} />
              <Field label="Date of birth" type="date" value={staffForm.dateOfBirth} onChange={(v) => setStaffForm((f) => ({ ...f, dateOfBirth: v }))} />
              <Field label="Gender" value={staffForm.gender} onChange={(v) => setStaffForm((f) => ({ ...f, gender: v }))} />
              <Field label="Civil status" value={staffForm.civilStatus} onChange={(v) => setStaffForm((f) => ({ ...f, civilStatus: v }))} />
              <Field label="Nationality" value={staffForm.nationality} onChange={(v) => setStaffForm((f) => ({ ...f, nationality: v }))} />
              <Field label="Email" type="email" value={staffForm.email} onChange={(v) => setStaffForm((f) => ({ ...f, email: v }))} />
              <Field label="Phone" value={staffForm.phone} onChange={(v) => setStaffForm((f) => ({ ...f, phone: v }))} />
              <Field label="Address" className="md:col-span-2" value={staffForm.address} onChange={(v) => setStaffForm((f) => ({ ...f, address: v }))} />
            </fieldset>

            <fieldset className="grid gap-3 md:grid-cols-4">
              <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Employment</legend>
              <Field label="Hire date" required type="date" value={staffForm.hireDate} onChange={(v) => setStaffForm((f) => ({ ...f, hireDate: v }))} />
              <SelectField
                label="Status"
                value={staffForm.employmentStatus}
                onChange={(v) => setStaffForm((f) => ({ ...f, employmentStatus: v as StaffForm["employmentStatus"] }))}
                options={[
                  { value: "ACTIVE", label: "ACTIVE" },
                  { value: "PROBATIONARY", label: "PROBATIONARY" },
                  { value: "ON_LEAVE", label: "ON_LEAVE" },
                  { value: "TERMINATED", label: "TERMINATED" },
                ]}
              />
              <SelectField
                label="Department"
                value={staffForm.departmentId}
                onChange={(v) => setStaffForm((f) => ({ ...f, departmentId: v }))}
                options={[{ value: "", label: "—" }, ...departments.map((d) => ({ value: d.id, label: d.name ?? "" }))]}
              />
              <SelectField
                label="Position"
                value={staffForm.positionId}
                onChange={(v) => setStaffForm((f) => ({ ...f, positionId: v }))}
                options={[{ value: "", label: "—" }, ...positions.map((p) => ({ value: p.id, label: p.title ?? "" }))]}
              />
              <SelectField
                label="Branch"
                value={staffForm.branchId}
                onChange={(v) => setStaffForm((f) => ({ ...f, branchId: v }))}
                options={[{ value: "", label: "—" }, ...branches.map((b) => ({ value: b.id, label: b.name }))]}
              />
              <SelectField
                label="Manager"
                value={staffForm.managerId}
                onChange={(v) => setStaffForm((f) => ({ ...f, managerId: v }))}
                options={[{ value: "", label: "—" }, ...allEmployees.map((m) => ({ value: m.id, label: `${m.firstName} ${m.lastName}` }))]}
              />
              <Field label="Basic salary" required type="number" min="0" step="0.01" value={staffForm.basicSalary} onChange={(v) => setStaffForm((f) => ({ ...f, basicSalary: v }))} />
              <Field label="Pay frequency" value={staffForm.payFrequency} onChange={(v) => setStaffForm((f) => ({ ...f, payFrequency: v }))} />
              <Field label="Currency" value={staffForm.currency} onChange={(v) => setStaffForm((f) => ({ ...f, currency: v }))} />
            </fieldset>

            <fieldset className="grid gap-3 md:grid-cols-4">
              <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Government & bank</legend>
              <Field label="TIN" value={staffForm.tin} onChange={(v) => setStaffForm((f) => ({ ...f, tin: v }))} />
              <Field label="SSS" value={staffForm.sssNumber} onChange={(v) => setStaffForm((f) => ({ ...f, sssNumber: v }))} />
              <Field label="PhilHealth" value={staffForm.philhealthNumber} onChange={(v) => setStaffForm((f) => ({ ...f, philhealthNumber: v }))} />
              <Field label="Pag-IBIG" value={staffForm.pagibigNumber} onChange={(v) => setStaffForm((f) => ({ ...f, pagibigNumber: v }))} />
              <Field label="Bank name" value={staffForm.bankName} onChange={(v) => setStaffForm((f) => ({ ...f, bankName: v }))} />
              <Field label="Bank account" value={staffForm.bankAccount} onChange={(v) => setStaffForm((f) => ({ ...f, bankAccount: v }))} />
            </fieldset>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Emergency contacts</p>
              <div className="mt-2 space-y-3">
                {staffContacts.map((c, i) => (
                  <div key={i} className="grid gap-2 rounded-lg border border-slate-100 p-3 md:grid-cols-2 dark:border-slate-800">
                    <Field
                      label="Name"
                      value={c.name}
                      onChange={(v) => {
                        const next = [...staffContacts];
                        next[i] = { ...next[i]!, name: v };
                        setStaffContacts(next);
                      }}
                    />
                    <Field
                      label="Relationship"
                      value={c.relationship}
                      onChange={(v) => {
                        const next = [...staffContacts];
                        next[i] = { ...next[i]!, relationship: v };
                        setStaffContacts(next);
                      }}
                    />
                    <Field
                      label="Phone"
                      value={c.phone}
                      onChange={(v) => {
                        const next = [...staffContacts];
                        next[i] = { ...next[i]!, phone: v };
                        setStaffContacts(next);
                      }}
                    />
                    <Field
                      label="Email"
                      type="email"
                      value={c.email ?? ""}
                      onChange={(v) => {
                        const next = [...staffContacts];
                        next[i] = { ...next[i]!, email: v };
                        setStaffContacts(next);
                      }}
                    />
                  </div>
                ))}
                <button
                  type="button"
                  className="text-sm font-medium text-sky-700 dark:text-sky-400"
                  onClick={() => setStaffContacts((rows) => [...rows, { name: "", relationship: "", phone: "", email: "" }])}
                >
                  + Add contact
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={staffSaving}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
            >
              {staffSaving ? "Saving…" : "Save employee record"}
            </button>
          </form>
        </section>
      )}

      {!(canStaffEdit && staffUnlocked && !isSelf) && !(isSelf && selfUnlocked) && (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <ProfileCard title="Contact & status" subtitle="Reach-out details and employment state">
              <InfoRow icon={<IconMail />} label="Email" value={emp.email ?? "—"} mono={!!emp.email} />
              <InfoRow icon={<IconPhone />} label="Phone" value={emp.phone ?? "—"} href={emp.phone ? `tel:${emp.phone.replace(/\s/g, "")}` : undefined} />
              <InfoRow icon={<IconMapPin />} label="Address" value={emp.address ?? "—"} />
            </ProfileCard>
            <ProfileCard title="Role & compensation" subtitle="Where they work and pay basis">
              <InfoRow icon={<IconBuilding />} label="Department" value={emp.department?.name ?? "—"} />
              <InfoRow icon={<IconBriefcase />} label="Position" value={emp.position?.title ?? "—"} />
              <InfoRow icon={<IconBranch />} label="Branch" value={emp.branch?.name ?? "—"} />
              <InfoRow icon={<IconCalendar />} label="Hire date" value={new Date(emp.hireDate).toLocaleDateString()} />
              <InfoRow
                icon={<IconCash />}
                label="Basic salary"
                value={`${emp.currency} ${Number(emp.basicSalary).toLocaleString(undefined, { minimumFractionDigits: 0 })}`}
                hint={`${(emp.payFrequency ?? "MONTHLY").toLowerCase()} · ${emp.currency ?? "PHP"}`}
              />
            </ProfileCard>
          </div>

          {hasDemographics && (
            <ProfileCard title="Profile details" subtitle="Aligned with PDS personal data">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {emp.dateOfBirth && (
                  <div className="rounded-xl bg-slate-50/80 px-3 py-2 dark:bg-slate-800/50">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Date of birth</div>
                    <div className="mt-0.5 text-sm font-medium text-slate-900 dark:text-slate-100">
                      {new Date(emp.dateOfBirth).toLocaleDateString()}
                    </div>
                  </div>
                )}
                {emp.gender && (
                  <div className="rounded-xl bg-slate-50/80 px-3 py-2 dark:bg-slate-800/50">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Gender</div>
                    <div className="mt-0.5 text-sm font-medium">{emp.gender}</div>
                  </div>
                )}
                {emp.civilStatus && (
                  <div className="rounded-xl bg-slate-50/80 px-3 py-2 dark:bg-slate-800/50">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Civil status</div>
                    <div className="mt-0.5 text-sm font-medium">{emp.civilStatus}</div>
                  </div>
                )}
                {emp.nationality && (
                  <div className="rounded-xl bg-slate-50/80 px-3 py-2 dark:bg-slate-800/50">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Nationality</div>
                    <div className="mt-0.5 text-sm font-medium">{emp.nationality}</div>
                  </div>
                )}
                {emp.manager && (
                  <div className="rounded-xl bg-slate-50/80 px-3 py-2 sm:col-span-2 lg:col-span-1">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Reports to</div>
                    <div className="mt-0.5 text-sm font-medium">
                      {emp.manager.firstName} {emp.manager.lastName}
                    </div>
                  </div>
                )}
              </div>
            </ProfileCard>
          )}

          {hasGovOnFile && (
            <ProfileCard title="Government & statutory" subtitle="Tax and social contributions">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {emp.tin && (
                  <GovPill label="TIN" value={emp.tin} />
                )}
                {emp.sssNumber && (
                  <GovPill label="SSS" value={emp.sssNumber} />
                )}
                {emp.philhealthNumber && (
                  <GovPill label="PhilHealth" value={emp.philhealthNumber} />
                )}
                {emp.pagibigNumber && (
                  <GovPill label="Pag-IBIG" value={emp.pagibigNumber} />
                )}
              </div>
            </ProfileCard>
          )}
        </>
      )}

      {!(canStaffEdit && staffUnlocked && !isSelf) && (
        <section>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">Emergency contacts</h2>
              <p className="mt-0.5 text-sm text-slate-500">People to notify in case of emergency</p>
            </div>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {emp.emergencyContacts.length === 0 && (
              <li className="col-span-full rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/30">
                No emergency contacts on file.
              </li>
            )}
            {emp.emergencyContacts.map((c) => (
              <li
                key={c.name + c.phone}
                className="flex gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <IconUser />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-900 dark:text-slate-100">{c.name}</div>
                  <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {c.relationship}
                  </span>
                  <div className="mt-2">
                    <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="text-sm font-medium text-sky-700 hover:underline dark:text-sky-400">
                      {c.phone}
                    </a>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">Documents</h2>
            <p className="mt-0.5 text-sm text-slate-500">HR file attachments and expiries</p>
          </div>
          {canStaffEdit && !staffUnlocked && (
            <p className="text-xs text-slate-500">Use Edit employee details to manage records.</p>
          )}
        </div>
        {emp.documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-900/40">
            <div className="rounded-full bg-slate-200/80 p-3 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <IconFile className="h-8 w-8" />
            </div>
            <p className="mt-3 font-medium text-slate-700 dark:text-slate-300">No documents uploaded yet</p>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              HR can attach contracts, IDs, and clearances from the employee record when editing is enabled.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {emp.documents.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <span className="font-medium text-slate-900 dark:text-slate-100">{d.title}</span>
                  <span className="text-slate-500"> · {d.category}</span>
                </div>
                {d.expiresAt && (
                  <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                    Expires {new Date(d.expiresAt).toLocaleDateString()}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  className = "",
  ...rest
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  className?: string;
  min?: string;
  step?: string;
}) {
  return (
    <label className={`text-sm ${className}`}>
      <span className="mb-1 block text-xs text-slate-500">{label}</span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
        {...rest}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-xs text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
      >
        {options.map((opt) => (
          <option key={opt.value || "blank"} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ProfileCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      <div className="mt-4 space-y-0 divide-y divide-slate-100 dark:divide-slate-800">{children}</div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
  hint,
  href,
  mono,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string;
  href?: string;
  mono?: boolean;
}) {
  const content = href ? (
    <a href={href} className="break-all text-sm font-medium text-sky-700 hover:underline dark:text-sky-400">
      {value}
    </a>
  ) : (
    <span className={`text-sm font-medium text-slate-900 dark:text-slate-100 ${mono ? "font-mono text-[13px]" : ""}`}>
      {value}
    </span>
  );
  return (
    <div className="flex gap-3 py-3.5 first:pt-0 last:pb-0">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</div>
        <div className="mt-0.5">{content}</div>
        {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
      </div>
    </div>
  );
}

function GovPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/90 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/40">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5 font-mono text-sm font-medium text-slate-900 dark:text-slate-100">{value}</div>
    </div>
  );
}

function IconMail() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function IconPhone() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  );
}

function IconMapPin() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function IconBuilding() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );
}

function IconBriefcase() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function IconBranch() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function IconCash() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function IconFile({ className }: { className?: string }) {
  return (
    <svg className={className ?? "h-5 w-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}
