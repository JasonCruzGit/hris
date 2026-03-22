import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, apiForm } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useCompany } from "../context/CompanyContext";

type EmployeeRow = {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  employmentStatus: string;
  department: { name: string } | null;
  position: { title: string } | null;
};

type BucketKey = "regular" | "jobOrder" | "contractOfService";
type OrgItem = { id: string; name?: string; title?: string };
type BranchItem = { id: string; name: string };

type CreateEmployeePayload = {
  employeeNumber: string;
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  nationality: string;
  civilStatus: string;
  address: string;
  phone: string;
  email: string;
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
  emergencyName: string;
  emergencyRelationship: string;
  emergencyPhone: string;
  emergencyEmail: string;
  userEmail: string;
  userPassword: string;
};
const FORM_STEPS = [
  "Personal Information",
  "Employment Information",
  "Government and Bank Details",
  "Emergency Contact",
  "Portal Account",
] as const;

function classifyEmployee(status: string): BucketKey {
  const normalized = status.replace(/[\s-]+/g, "_").toUpperCase();
  if (normalized.includes("JOB_ORDER")) return "jobOrder";
  if (normalized.includes("CONTRACT_OF_SERVICE") || normalized === "COS") return "contractOfService";
  return "regular";
}

function labelForBucket(key: BucketKey): string {
  if (key === "jobOrder") return "Job Order";
  if (key === "contractOfService") return "Contract of Service";
  return "Regular employees";
}

export function EmployeeDatabasePage({ section = "regular" }: { section?: BucketKey }) {
  const { user } = useAuth();
  const { companyId } = useCompany();
  const [items, setItems] = useState<EmployeeRow[]>([]);
  const [allEmployees, setAllEmployees] = useState<EmployeeRow[]>([]);
  const [departments, setDepartments] = useState<OrgItem[]>([]);
  const [positions, setPositions] = useState<OrgItem[]>([]);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formStep, setFormStep] = useState(0);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [form, setForm] = useState<CreateEmployeePayload>({
    employeeNumber: "",
    firstName: "",
    middleName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "",
    nationality: "",
    civilStatus: "",
    address: "",
    phone: "",
    email: "",
    hireDate: new Date().toISOString().slice(0, 10),
    employmentStatus: "ACTIVE",
    departmentId: "",
    positionId: "",
    branchId: "",
    managerId: "",
    basicSalary: "0",
    payFrequency: "MONTHLY",
    currency: "PHP",
    bankName: "",
    bankAccount: "",
    tin: "",
    sssNumber: "",
    philhealthNumber: "",
    pagibigNumber: "",
    emergencyName: "",
    emergencyRelationship: "",
    emergencyPhone: "",
    emergencyEmail: "",
    userEmail: "",
    userPassword: "",
  });
  const canCreate = user?.role === "SUPER_ADMIN" || user?.role === "HR_ADMIN";

  async function loadEmployees(query: string, activeCompanyId: string | null) {
    setLoading(true);
    const q = new URLSearchParams({ page: "1", pageSize: "200" });
    if (query.trim()) q.set("search", query.trim());
    if (activeCompanyId) q.set("companyId", activeCompanyId);
    try {
      const r = await api<{ items: EmployeeRow[] }>(`/api/employees?${q.toString()}`);
      setItems(r.items);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load employee database");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadEmployees(search, companyId);
  }, [search, companyId]);

  useEffect(() => {
    if (!photo) {
      setPhotoPreview(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  useEffect(() => {
    Promise.all([
      api<{ items: OrgItem[] }>("/api/org/departments"),
      api<{ items: OrgItem[] }>("/api/org/positions"),
      api<{ items: { id: string; branches: BranchItem[] }[] }>("/api/org/companies"),
      api<{ items: EmployeeRow[] }>("/api/employees?page=1&pageSize=200"),
    ])
      .then(([deptRes, posRes, companiesRes, employeeRes]) => {
        setDepartments(deptRes.items);
        setPositions(posRes.items);
        setBranches(companiesRes.items.flatMap((c) => c.branches));
        setAllEmployees(employeeRes.items);
      })
      .catch(() => {
        // Keep main listing usable even if options fail.
      });
  }, []);

  const grouped = useMemo(() => {
    const seed: Record<BucketKey, EmployeeRow[]> = { regular: [], jobOrder: [], contractOfService: [] };
    for (const row of items) {
      seed[classifyEmployee(row.employmentStatus)].push(row);
    }
    return seed;
  }, [items]);

  const selectedRows = grouped[section];
  const sectionHref: Record<BucketKey, string> = {
    regular: "/employee-database/regular",
    jobOrder: "/employee-database/job-order",
    contractOfService: "/employee-database/contract-of-service",
  };

  async function onSubmitCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaveError(null);
    setSaveMsg(null);
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        employeeNumber: form.employeeNumber.trim(),
        firstName: form.firstName.trim(),
        middleName: form.middleName.trim() || undefined,
        lastName: form.lastName.trim(),
        dateOfBirth: form.dateOfBirth || undefined,
        gender: form.gender.trim() || undefined,
        nationality: form.nationality.trim() || undefined,
        civilStatus: form.civilStatus.trim() || undefined,
        address: form.address.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || "",
        hireDate: form.hireDate,
        employmentStatus: form.employmentStatus,
        departmentId: form.departmentId || undefined,
        positionId: form.positionId || undefined,
        branchId: form.branchId || undefined,
        managerId: form.managerId || undefined,
        basicSalary: Number(form.basicSalary),
        payFrequency: form.payFrequency.trim() || "MONTHLY",
        currency: form.currency.trim() || "PHP",
        bankName: form.bankName.trim() || undefined,
        bankAccount: form.bankAccount.trim() || undefined,
        tin: form.tin.trim() || undefined,
        sssNumber: form.sssNumber.trim() || undefined,
        philhealthNumber: form.philhealthNumber.trim() || undefined,
        pagibigNumber: form.pagibigNumber.trim() || undefined,
        userEmail: form.userEmail.trim() || undefined,
        userPassword: form.userPassword.trim() || undefined,
      };

      if (form.emergencyName.trim() && form.emergencyRelationship.trim() && form.emergencyPhone.trim()) {
        payload.emergencyContacts = [
          {
            name: form.emergencyName.trim(),
            relationship: form.emergencyRelationship.trim(),
            phone: form.emergencyPhone.trim(),
            email: form.emergencyEmail.trim() || undefined,
          },
        ];
      }

      const created = await api<{ id: string }>("/api/employees", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (photo) {
        const fd = new FormData();
        fd.append("photo", photo);
        await apiForm<{ photoUrl: string }>(`/api/employees/${created.id}/photo`, fd);
      }
      setPhoto(null);
      setSaveMsg("Employee record created.");
      setFormOpen(false);
      await loadEmployees(search, companyId);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not create employee");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Employee Database</h1>
          <p className="mt-1 text-sm text-slate-500">Regular employees, Job Order, and Contract of Service records.</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:max-w-md sm:items-end">
          <input
            placeholder="Search employee name or number..."
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {canCreate && (
            <button
              type="button"
              onClick={() => {
                setFormOpen((v) => !v);
                setFormStep(0);
                setPhoto(null);
              }}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900"
            >
              {formOpen ? "Close Add Employee" : "Add Employee"}
            </button>
          )}
        </div>
      </header>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saveMsg && <p className="text-sm text-emerald-700 dark:text-emerald-300">{saveMsg}</p>}

      {formOpen && canCreate && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold">Add Employee (PDS-based entry)</h2>
          <p className="mt-1 text-xs text-slate-500">Use this form to capture personal, employment, and government records.</p>
          {saveError && <p className="mt-2 text-sm text-red-600">{saveError}</p>}
          <form className="mt-4 space-y-5" onSubmit={onSubmitCreate}>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="text-sm font-medium">
                Step {formStep + 1} of {FORM_STEPS.length}: {FORM_STEPS[formStep]}
              </div>
              <div className="flex items-center gap-1.5">
                {FORM_STEPS.map((s, idx) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setFormStep(idx)}
                    className={`h-2.5 rounded-full transition ${idx === formStep ? "w-8 bg-slate-900 dark:bg-white" : "w-2.5 bg-slate-300 dark:bg-slate-700"}`}
                    aria-label={`Go to step ${idx + 1}`}
                  />
                ))}
              </div>
            </div>

            {formStep === 0 && (
              <fieldset className="grid gap-3 md:grid-cols-4">
                <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Personal Information</legend>
                <div className="md:col-span-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-950/40">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Employee photo</span>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                    <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900">
                      {photoPreview ? (
                        <img src={photoPreview} alt="" className="h-full w-full object-cover object-top" />
                      ) : (
                        <span className="px-2 text-center text-xs text-slate-400">No photo</span>
                      )}
                    </div>
                    <label className="min-w-0 flex-1 text-sm">
                      <span className="mb-1 block text-xs text-slate-500">Upload image (JPG, PNG, WebP — max 5 MB)</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium dark:border-slate-700 dark:bg-slate-950 dark:file:bg-slate-800"
                        onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                      />
                    </label>
                  </div>
                </div>
                <TextField label="Employee Number" required value={form.employeeNumber} onChange={(v) => setForm((f) => ({ ...f, employeeNumber: v }))} />
                <TextField label="First Name" required value={form.firstName} onChange={(v) => setForm((f) => ({ ...f, firstName: v }))} />
                <TextField label="Middle Name" value={form.middleName} onChange={(v) => setForm((f) => ({ ...f, middleName: v }))} />
                <TextField label="Last Name" required value={form.lastName} onChange={(v) => setForm((f) => ({ ...f, lastName: v }))} />
                <TextField label="Date of Birth" type="date" value={form.dateOfBirth} onChange={(v) => setForm((f) => ({ ...f, dateOfBirth: v }))} />
                <TextField label="Gender" value={form.gender} onChange={(v) => setForm((f) => ({ ...f, gender: v }))} />
                <TextField label="Civil Status" value={form.civilStatus} onChange={(v) => setForm((f) => ({ ...f, civilStatus: v }))} />
                <TextField label="Nationality" value={form.nationality} onChange={(v) => setForm((f) => ({ ...f, nationality: v }))} />
                <TextField label="Phone" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} />
                <TextField label="Email" type="email" value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} />
                <TextField label="Address" className="md:col-span-2" value={form.address} onChange={(v) => setForm((f) => ({ ...f, address: v }))} />
              </fieldset>
            )}

            {formStep === 1 && (
              <fieldset className="grid gap-3 md:grid-cols-4">
                <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Employment Information</legend>
                <TextField label="Hire Date" required type="date" value={form.hireDate} onChange={(v) => setForm((f) => ({ ...f, hireDate: v }))} />
                <SelectField
                  label="Status"
                  value={form.employmentStatus}
                  onChange={(v) => setForm((f) => ({ ...f, employmentStatus: v as CreateEmployeePayload["employmentStatus"] }))}
                  options={[
                    { value: "ACTIVE", label: "ACTIVE" },
                    { value: "PROBATIONARY", label: "PROBATIONARY" },
                    { value: "ON_LEAVE", label: "ON_LEAVE" },
                    { value: "TERMINATED", label: "TERMINATED" },
                  ]}
                />
                <SelectField
                  label="Department"
                  value={form.departmentId}
                  onChange={(v) => setForm((f) => ({ ...f, departmentId: v }))}
                  options={[{ value: "", label: "—" }, ...departments.map((d) => ({ value: d.id, label: d.name ?? "Department" }))]}
                />
                <SelectField
                  label="Position"
                  value={form.positionId}
                  onChange={(v) => setForm((f) => ({ ...f, positionId: v }))}
                  options={[{ value: "", label: "—" }, ...positions.map((p) => ({ value: p.id, label: p.title ?? "Position" }))]}
                />
                <SelectField
                  label="Branch"
                  value={form.branchId}
                  onChange={(v) => setForm((f) => ({ ...f, branchId: v }))}
                  options={[{ value: "", label: "—" }, ...branches.map((b) => ({ value: b.id, label: b.name }))]}
                />
                <SelectField
                  label="Manager"
                  value={form.managerId}
                  onChange={(v) => setForm((f) => ({ ...f, managerId: v }))}
                  options={[
                    { value: "", label: "—" },
                    ...allEmployees.map((m) => ({ value: m.id, label: `${m.firstName} ${m.lastName}` })),
                  ]}
                />
                <TextField label="Basic Salary" required type="number" min="0" step="0.01" value={form.basicSalary} onChange={(v) => setForm((f) => ({ ...f, basicSalary: v }))} />
                <TextField label="Pay Frequency" value={form.payFrequency} onChange={(v) => setForm((f) => ({ ...f, payFrequency: v }))} />
                <TextField label="Currency" value={form.currency} onChange={(v) => setForm((f) => ({ ...f, currency: v }))} />
              </fieldset>
            )}

            {formStep === 2 && (
              <fieldset className="grid gap-3 md:grid-cols-4">
                <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Government and Bank Details</legend>
                <TextField label="TIN" value={form.tin} onChange={(v) => setForm((f) => ({ ...f, tin: v }))} />
                <TextField label="SSS Number" value={form.sssNumber} onChange={(v) => setForm((f) => ({ ...f, sssNumber: v }))} />
                <TextField label="PhilHealth Number" value={form.philhealthNumber} onChange={(v) => setForm((f) => ({ ...f, philhealthNumber: v }))} />
                <TextField label="Pag-IBIG Number" value={form.pagibigNumber} onChange={(v) => setForm((f) => ({ ...f, pagibigNumber: v }))} />
                <TextField label="Bank Name" value={form.bankName} onChange={(v) => setForm((f) => ({ ...f, bankName: v }))} />
                <TextField label="Bank Account" value={form.bankAccount} onChange={(v) => setForm((f) => ({ ...f, bankAccount: v }))} />
              </fieldset>
            )}

            {formStep === 3 && (
              <fieldset className="grid gap-3 md:grid-cols-4">
                <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Emergency Contact</legend>
                <TextField label="Name" value={form.emergencyName} onChange={(v) => setForm((f) => ({ ...f, emergencyName: v }))} />
                <TextField label="Relationship" value={form.emergencyRelationship} onChange={(v) => setForm((f) => ({ ...f, emergencyRelationship: v }))} />
                <TextField label="Phone" value={form.emergencyPhone} onChange={(v) => setForm((f) => ({ ...f, emergencyPhone: v }))} />
                <TextField label="Email" type="email" value={form.emergencyEmail} onChange={(v) => setForm((f) => ({ ...f, emergencyEmail: v }))} />
              </fieldset>
            )}

            {formStep === 4 && (
              <fieldset className="grid gap-3 md:grid-cols-4">
                <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Portal Account (optional)</legend>
                <TextField label="User Email" type="email" value={form.userEmail} onChange={(v) => setForm((f) => ({ ...f, userEmail: v }))} />
                <TextField label="Temporary Password" type="password" value={form.userPassword} onChange={(v) => setForm((f) => ({ ...f, userPassword: v }))} />
              </fieldset>
            )}

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setFormStep((s) => Math.max(0, s - 1))}
                disabled={formStep === 0}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700"
              >
                Previous
              </button>
              {formStep < FORM_STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setFormStep((s) => Math.min(FORM_STEPS.length - 1, s + 1))}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900"
                >
                  Next
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900"
                >
                  {saving ? "Saving..." : "Create Employee"}
                </button>
              )}
            </div>
          </form>
        </section>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Regular employees" value={grouped.regular.length} />
        <SummaryCard label="Job Order" value={grouped.jobOrder.length} />
        <SummaryCard label="Contract of Service" value={grouped.contractOfService.length} />
      </div>

      <div className="flex flex-wrap gap-2">
        {(["regular", "jobOrder", "contractOfService"] as BucketKey[]).map((key) => (
          <Link
            key={key}
            to={sectionHref[key]}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              section === key
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            }`}
          >
            {labelForBucket(key)}
          </Link>
        ))}
      </div>

      <EmployeeSection title={labelForBucket(section)} rows={selectedRows} loading={loading} />
    </div>
  );
}

function TextField({
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
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
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
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
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

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function EmployeeSection({
  title,
  rows,
  loading,
}: {
  title: string;
  rows: EmployeeRow[];
  loading: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <h2 className="font-semibold">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-950">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Position</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-100 dark:border-slate-800">
                <td className="px-4 py-3 font-mono text-xs">{row.employeeNumber}</td>
                <td className="px-4 py-3">
                  <Link className="font-medium text-slate-900 underline dark:text-white" to={`/employees/${row.id}`}>
                    {row.firstName} {row.lastName}
                  </Link>
                </td>
                <td className="px-4 py-3">{row.department?.name ?? "—"}</td>
                <td className="px-4 py-3">{row.position?.title ?? "—"}</td>
                <td className="px-4 py-3">{row.employmentStatus}</td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  No records in this section.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  Loading records...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
