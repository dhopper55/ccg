import { PropsWithChildren } from "react";
import { Navigate } from "react-router";
import { useAuth } from "providers/AuthProvider";
import PageLoader from "components/PageLoader";

const GuestGuard = ({ children }: PropsWithChildren) => {
  const { isLoading, sessionUser } = useAuth();

  if (isLoading) {
    return <PageLoader />;
  }

  return sessionUser ? <Navigate to="/" replace /> : children;
};

export default GuestGuard;
