import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import PageLoader from 'components/loading/PageLoader';
import { useAuth } from 'providers/AuthProvider';
import paths from 'routes/paths';

const Logout = () => {
  const navigate = useNavigate();
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
          navigate(paths.defaultJwtLogin, { replace: true });
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [navigate, refreshSession, setSession]);

  return <PageLoader />;
};

export default Logout;
