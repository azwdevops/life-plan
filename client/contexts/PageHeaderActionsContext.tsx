"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export interface PageHeaderAction {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  disabled?: boolean;
  variant?: "default" | "danger";
}

interface PageHeaderActionsContextType {
  actions: PageHeaderAction[];
  setActions: (actions: PageHeaderAction[]) => void;
}

const PageHeaderActionsContext = createContext<PageHeaderActionsContextType | undefined>(undefined);

export function PageHeaderActionsProvider({ children }: { children: ReactNode }) {
  const [actions, setActions] = useState<PageHeaderAction[]>([]);
  return (
    <PageHeaderActionsContext.Provider value={{ actions, setActions }}>
      {children}
    </PageHeaderActionsContext.Provider>
  );
}

/** Internal: consumed by <Header> to render the "more actions" menu. */
export function usePageHeaderActionsValue(): PageHeaderAction[] {
  const context = useContext(PageHeaderActionsContext);
  if (context === undefined) {
    throw new Error("usePageHeaderActionsValue must be used within a PageHeaderActionsProvider");
  }
  return context.actions;
}

/**
 * Registers page-level action buttons (e.g. "Refresh", "Add X") to show in the
 * shared Header's "more actions" menu instead of the page rendering its own
 * button row. Pass a memoized array — call sites should wrap `actions` in
 * `useMemo` so this doesn't re-register (and re-render the Header) every
 * render. Automatically clears on unmount so stale actions don't linger when
 * navigating to a page that doesn't call this hook.
 */
export function usePageHeaderActions(actions: PageHeaderAction[]): void {
  const context = useContext(PageHeaderActionsContext);
  if (context === undefined) {
    throw new Error("usePageHeaderActions must be used within a PageHeaderActionsProvider");
  }
  const { setActions } = context;

  useEffect(() => {
    setActions(actions);
    return () => setActions([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions, setActions]);
}
