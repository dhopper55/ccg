import {
  Dispatch,
  PropsWithChildren,
  SetStateAction,
  createContext,
  use,
  useCallback,
  useEffect,
  useState,
} from "react";

// Deliberately reuses the same /api/login and /api/session endpoints the CCG
// admin app uses — this app shares the domain-wide auth cookie, not a
// separate credential. See dncbudget-spec.md §1.

export interface SessionUser {
  username: string;
}

type SessionResponse = {
  ok?: boolean;
  user?: string;
};

interface AuthContextInterface {
  sessionUser: SessionUser | null;
  isLoading: boolean;
  setSessionUser: Dispatch<SetStateAction<SessionUser | null>>;
  refreshSession: () => Promise<SessionUser | null>;
  login: (credentials: { username: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext({} as AuthContextInterface);

const AuthProvider = ({ children }: PropsWithChildren) => {
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSession = useCallback(async (): Promise<SessionUser | null> => {
    try {
      const response = await fetch("/api/session", {
        method: "GET",
        credentials: "same-origin",
      });
      if (!response.ok) {
        setSessionUser(null);
        return null;
      }
      const data = (await response.json()) as SessionResponse;
      if (!data.ok || !data.user) {
        setSessionUser(null);
        return null;
      }
      const nextUser: SessionUser = { username: data.user };
      setSessionUser(nextUser);
      return nextUser;
    } catch {
      setSessionUser(null);
      return null;
    }
  }, []);

  const login = useCallback(
    async ({ username, password }: { username: string; password: string }) => {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ username: username.trim(), password }),
      });

      if (!response.ok) {
        throw new Error("Invalid credentials. Try again.");
      }

      const nextUser = await refreshSession();
      if (!nextUser) {
        throw new Error("Authenticated session was not established.");
      }
    },
    [refreshSession],
  );

  const logout = useCallback(async () => {
    await fetch("/api/logout", { method: "POST", credentials: "same-origin" });
    setSessionUser(null);
  }, []);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      await refreshSession();
      if (isMounted) {
        setIsLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [refreshSession]);

  return (
    <AuthContext value={{ sessionUser, isLoading, setSessionUser, refreshSession, login, logout }}>
      {children}
    </AuthContext>
  );
};

export const useAuth = () => use(AuthContext);

export default AuthProvider;
