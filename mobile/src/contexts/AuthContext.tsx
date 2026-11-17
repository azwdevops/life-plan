import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { clearAuthToken, loadAuthToken, loadSettings, saveAuthToken } from '../storage';

interface AuthContextValue {
  token: string | null;
  backendUrl: string;
  ready: boolean;
  login: (token: string) => void;
  logout: () => void;
  /** Settings screen calls this after saving, so Book Ideas picks up the new
   * URL immediately without needing to reload AsyncStorage. */
  setBackendUrl: (url: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Loads the saved token/backend URL once on mount. Does not gate the rest of
// the app - Tasks/Alarms/Playlists/etc. are fully offline and don't need
// this; only the Book Ideas screen reads `token`/`backendUrl`.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [backendUrl, setBackendUrl] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([loadAuthToken(), loadSettings()]).then(([savedToken, settings]) => {
      setToken(savedToken);
      setBackendUrl(settings.backendUrl);
      setReady(true);
    });
  }, []);

  const login = (next: string) => {
    setToken(next);
    void saveAuthToken(next);
  };

  const logout = () => {
    setToken(null);
    void clearAuthToken();
  };

  return (
    <AuthContext.Provider value={{ token, backendUrl, ready, login, logout, setBackendUrl }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
