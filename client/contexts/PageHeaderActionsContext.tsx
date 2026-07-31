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
  extra: ReactNode;
  setExtra: (extra: ReactNode) => void;
  menuExtra: ReactNode;
  setMenuExtra: (menuExtra: ReactNode) => void;
}

const PageHeaderActionsContext = createContext<PageHeaderActionsContextType | undefined>(undefined);

export function PageHeaderActionsProvider({ children }: { children: ReactNode }) {
  const [actions, setActions] = useState<PageHeaderAction[]>([]);
  const [extra, setExtra] = useState<ReactNode>(null);
  const [menuExtra, setMenuExtra] = useState<ReactNode>(null);
  return (
    <PageHeaderActionsContext.Provider value={{ actions, setActions, extra, setExtra, menuExtra, setMenuExtra }}>
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

/** Internal: consumed by <Header> to render page-registered extra header content. */
export function usePageHeaderExtraValue(): ReactNode {
  const context = useContext(PageHeaderActionsContext);
  if (context === undefined) {
    throw new Error("usePageHeaderExtraValue must be used within a PageHeaderActionsProvider");
  }
  return context.extra;
}

/** Internal: consumed by <Header> to render page-registered content inside the "more actions" dropdown panel. */
export function usePageHeaderMenuExtraValue(): ReactNode {
  const context = useContext(PageHeaderActionsContext);
  if (context === undefined) {
    throw new Error("usePageHeaderMenuExtraValue must be used within a PageHeaderActionsProvider");
  }
  return context.menuExtra;
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

/**
 * Registers a small page-level widget (e.g. a filter dropdown) to render in
 * the shared Header itself, just to the left of the "more actions" menu —
 * for controls that need to stay visible/interactive rather than living
 * inside the actions dropdown (which only supports simple click actions).
 * Pass a stable/memoized node — call sites should wrap the node in `useMemo`
 * so this doesn't re-register (and re-render the Header) every render.
 * Automatically clears on unmount.
 */
export function usePageHeaderExtra(node: ReactNode): void {
  const context = useContext(PageHeaderActionsContext);
  if (context === undefined) {
    throw new Error("usePageHeaderExtra must be used within a PageHeaderActionsProvider");
  }
  const { setExtra } = context;

  useEffect(() => {
    setExtra(node);
    return () => setExtra(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node, setExtra]);
}

/**
 * Registers a small widget (e.g. a `<select>` filter) to render inside the
 * shared Header's "more actions" dropdown panel itself — for controls that
 * belong in that menu (to save header space) but aren't a simple click
 * action, so they can't be one of the `usePageHeaderActions` buttons.
 * Pass a stable/memoized node — call sites should wrap it in `useMemo` so
 * this doesn't re-register (and re-render the Header) every render.
 * Automatically clears on unmount.
 */
export function usePageHeaderMenuExtra(node: ReactNode): void {
  const context = useContext(PageHeaderActionsContext);
  if (context === undefined) {
    throw new Error("usePageHeaderMenuExtra must be used within a PageHeaderActionsProvider");
  }
  const { setMenuExtra } = context;

  useEffect(() => {
    setMenuExtra(node);
    return () => setMenuExtra(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node, setMenuExtra]);
}
