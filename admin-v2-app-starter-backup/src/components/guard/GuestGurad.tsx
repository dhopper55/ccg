import { PropsWithChildren } from "react";
import { Navigate } from "react-router";
import { useAuth } from "providers/AuthProvider";
import PageLoader from "components/loading/PageLoader";

const GuestGurad = ({ children }: PropsWithChildren) => {
  const { isLoading, sessionUser } = useAuth();

  if (isLoading) {
    return <PageLoader />;
  }

  return sessionUser ? <Navigate to="/" /> : children;
};

export default GuestGurad;
