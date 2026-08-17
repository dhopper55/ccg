import { PropsWithChildren } from "react";
import { Navigate } from "react-router";
import { useAuth } from "providers/AuthProvider";
import PageLoader from "components/PageLoader";

const AuthGuard = ({ children }: PropsWithChildren) => {
  const { isLoading, sessionUser } = useAuth();

  if (isLoading) {
    return <PageLoader />;
  }

  return sessionUser ? children : <Navigate to="/login" replace />;
};

export default AuthGuard;
