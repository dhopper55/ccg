import { Outlet } from 'react-router';
import AuthProvider from 'providers/AuthProvider';
import EcommerceProvider from 'providers/EcommerceProvider';

const App = () => {
  return (
    <AuthProvider>
      <EcommerceProvider>
        <Outlet />
      </EcommerceProvider>
    </AuthProvider>
  );
};

export default App;
