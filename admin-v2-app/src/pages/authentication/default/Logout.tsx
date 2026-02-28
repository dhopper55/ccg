import { useEffect } from 'react';
import PageLoader from 'components/loading/PageLoader';
import { useAuth } from 'providers/AuthProvider';

const Logout = () => {
  const { refreshSession, setSession } = useAuth();

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      try {
        await fetch('/api/logout', {
          method: 'POST',
          credentials: 'same-origin',
        });
      } finally {
        setSession(null);
        await refreshSession();
        if (isMounted) {
          const base = import.meta.env.VITE_BASENAME || '/';
          window.location.replace(`${base}authentication/default/jwt/login`);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [refreshSession, setSession]);

  return <PageLoader />;
};

export default Logout;
