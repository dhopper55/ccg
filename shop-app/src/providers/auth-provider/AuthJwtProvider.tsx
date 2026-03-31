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
  const displayName = trimmed ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1) : "Admin";
  return {
    id: trimmed,
    name: displayName,
    email: trimmed,
    avatar: null,
    designation: "Admin",
  };
}

const AuthJwtProvider = ({ children }: PropsWithChildren) => {
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const setSession = useCallback(
    (user: SessionUser | null) => {
      setSessionUser(user);
    },
    [setSessionUser],
  );

  const refreshSession = useCallback(async (): Promise<SessionUser | null> => {
    return null;
  }, []);

  const login = useCallback(
    async (_credentials: { email: string; password: string }) => {
      // No-op for public shop
    },
    [],
  );

  const signout = useCallback(() => {
    setSessionUser(null);
  }, []);

  return (
    <AuthJwtContext
      value={{ sessionUser, isLoading, setSessionUser, setSession, refreshSession, login, signout }}
    >
      {children}
    </AuthJwtContext>
  );
};

export const demoUser: SessionUser = {
  id: 'guest',
  name: 'Guest',
  email: 'guest@coalcreekguitars.com',
  avatar: null,
  designation: 'Customer',
};

export const useAuth = () => use(AuthJwtContext);

export default AuthJwtProvider;
