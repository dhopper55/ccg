import { PropsWithChildren } from "react";
import { Navigate } from "react-router";
import { useAuth } from "providers/AuthProvider";
import paths from "routes/paths";
import PageLoader from "components/loading/PageLoader";

const AuthGurad = ({ children }: PropsWithChildren) => {
  const { isLoading, sessionUser } = useAuth();

  if (isLoading) {
    return <PageLoader />;
  }

  return sessionUser ? children : <Navigate to={paths.defaultJwtLogin} />;
};

export default AuthGurad;
