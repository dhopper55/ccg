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

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  avatar: null | string;
  designation?: string;
}

type SessionResponse = {
  ok?: boolean;
  user?: string;
};

interface AuthJwtContextInterface {
  sessionUser: SessionUser | null;
  isLoading: boolean;
  setSessionUser: Dispatch<SetStateAction<SessionUser | null>>;
  setSession: (user: SessionUser | null) => void;
  refreshSession: () => Promise<SessionUser | null>;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  signout: () => void;
}

export const AuthJwtContext = createContext({} as AuthJwtContextInterface);

function buildSessionUser(username: string): SessionUser {
  const trimmed = username.trim();
  return {
    id: trimmed,
    name: trimmed,
    email: trimmed,
    avatar: null,
    designation: "Admin",
  };
}

const AuthJwtProvider = ({ children }: PropsWithChildren) => {
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const setSession = useCallback(
    (user: SessionUser | null) => {
      setSessionUser(user);
    },
    [setSessionUser],
  );

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
      const nextUser = buildSessionUser(data.user);
      setSessionUser(nextUser);
      return nextUser;
    } catch {
      setSessionUser(null);
      return null;
    }
  }, []);

  const login = useCallback(
    async ({ email, password }: { email: string; password: string }) => {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          username: email.trim(),
          password,
        }),
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

  const signout = useCallback(() => {
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
    <AuthJwtContext
      value={{ sessionUser, isLoading, setSessionUser, setSession, refreshSession, login, signout }}
    >
      {children}
    </AuthJwtContext>
  );
};

export const useAuth = () => use(AuthJwtContext);

export default AuthJwtProvider;
