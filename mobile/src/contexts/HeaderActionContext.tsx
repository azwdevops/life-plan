import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export interface HeaderAction {
  key: string;
  icon: string;
  label: string;
  onPress: () => void;
}

// A screen that wants its own search box in the header supplies this while
// the box should be showing - the header renders the actual TextInput (in
// place of the title) but the screen owns the query state and filtering.
export interface HeaderSearchBox {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

interface HeaderActionContextValue {
  headerTitle: string | null;
  setHeaderTitle: (title: string | null) => void;
  headerActions: HeaderAction[];
  setHeaderAction: (key: string, action: HeaderAction | null) => void;
  headerSearchBox: HeaderSearchBox | null;
  setHeaderSearchBox: (box: HeaderSearchBox | null) => void;
}

const HeaderActionContext = createContext<HeaderActionContextValue | null>(null);

export function HeaderActionProvider({ children }: { children: ReactNode }) {
  const [headerTitle, setHeaderTitle] = useState<string | null>(null);
  const [headerActions, setHeaderActions] = useState<HeaderAction[]>([]);
  const [headerSearchBox, setHeaderSearchBox] = useState<HeaderSearchBox | null>(null);

  const setHeaderAction = useCallback((key: string, action: HeaderAction | null) => {
    setHeaderActions(prev => {
      const next = prev.filter(a => a.key !== key);
      return action ? [...next, action] : next;
    });
  }, []);

  return (
    <HeaderActionContext.Provider
      value={{ headerTitle, setHeaderTitle, headerActions, setHeaderAction, headerSearchBox, setHeaderSearchBox }}
    >
      {children}
    </HeaderActionContext.Provider>
  );
}

export function useHeaderActionContext(): HeaderActionContextValue {
  const ctx = useContext(HeaderActionContext);
  if (!ctx) throw new Error('useHeaderActionContext must be used within HeaderActionProvider');
  return ctx;
}

// A screen calls this to inject a button into the global app header for as
// long as it's mounted - e.g. a refresh action only relevant on that screen.
// `key` identifies the slot, since a screen may register more than one.
export function useHeaderAction(key: string, icon: string, label: string, onPress: () => void): void {
  const { setHeaderAction } = useHeaderActionContext();
  useEffect(() => {
    setHeaderAction(key, { key, icon, label, onPress });
    return () => setHeaderAction(key, null);
  }, [key, icon, label, onPress, setHeaderAction]);
}

// A screen calls this to replace the global header's title ("Life Plan")
// with its own, for as long as it's mounted.
export function useHeaderTitle(title: string): void {
  const { setHeaderTitle } = useHeaderActionContext();
  useEffect(() => {
    setHeaderTitle(title);
    return () => setHeaderTitle(null);
  }, [title, setHeaderTitle]);
}

// A screen calls this with a non-null box while its own search input should
// replace the header title; pass null the rest of the time (e.g. before the
// search icon is tapped).
export function useHeaderSearchBox(box: HeaderSearchBox | null): void {
  const { setHeaderSearchBox } = useHeaderActionContext();
  useEffect(() => {
    setHeaderSearchBox(box);
    return () => setHeaderSearchBox(null);
  }, [box, setHeaderSearchBox]);
}
