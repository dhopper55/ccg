import { PropsWithChildren, useEffect } from "react";
import { useAuth } from "providers/AuthProvider";
import PageLoader from "components/loading/PageLoader";

const AuthGurad = ({ children }: PropsWithChildren) => {
  const { isLoading, sessionUser } = useAuth();

  useEffect(() => {
    if (isLoading || sessionUser) return;
    const base = import.meta.env.VITE_BASENAME || '/';
    window.location.replace(`${base}authentication/default/jwt/login`);
  }, [isLoading, sessionUser]);

  if (isLoading) {
    return <PageLoader />;
  }

  return sessionUser ? children : <PageLoader />;
};

export default AuthGurad;
