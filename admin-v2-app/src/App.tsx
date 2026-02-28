import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router';
import { useConfigFromQuery } from 'hooks/useConfigFromQuery';
import AuthProvider from 'providers/AuthProvider';

const App = () => {
  const { pathname } = useLocation();

  useConfigFromQuery();

  const isShowcase = pathname === '/' || pathname.startsWith('/showcase');

  useEffect(() => {
    window.scrollTo(0, 0);

    if (isShowcase) {
      document.documentElement.style.overscrollBehavior = 'none';
      document.documentElement.style.filter = 'none';
    }

    return () => {
      document.documentElement.style.overscrollBehavior = 'auto';
      document.documentElement.style.filter = 'auto';
    };
  }, [pathname, isShowcase]);

  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
};

export default App;
