import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type Ctx = {
  /** Reserved for future company-scoped views; always null with no header switcher. */
  companyId: string | null;
  setCompanyId: (id: string | null) => void;
};

const CompanyContext = createContext<Ctx | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [companyId, setCompanyIdState] = useState<string | null>(null);

  const setCompanyId = useCallback((id: string | null) => {
    setCompanyIdState(id);
  }, []);

  const value = useMemo<Ctx>(() => ({ companyId, setCompanyId }), [companyId, setCompanyId]);

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error("useCompany must be used within CompanyProvider");
  return ctx;
}
