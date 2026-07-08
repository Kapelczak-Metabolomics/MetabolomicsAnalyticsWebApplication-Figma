import { createContext, useContext, useState, type ReactNode } from "react";

interface LayoutContextValue {
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
  workspaceOpen: boolean;
  setWorkspaceOpen: (open: boolean) => void;
}

const LayoutContext = createContext<LayoutContextValue | null>(null);

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);

  return (
    <LayoutContext.Provider value={{ mobileNavOpen, setMobileNavOpen, workspaceOpen, setWorkspaceOpen }}>
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout() {
  const ctx = useContext(LayoutContext);
  if (!ctx) throw new Error("useLayout must be used within LayoutProvider");
  return ctx;
}
