import { Outlet } from 'react-router';
import AuthProvider from 'providers/AuthProvider';
import AssociateModeProvider from 'providers/AssociateModeProvider';
import EcommerceProvider from 'providers/EcommerceProvider';

const App = () => {
  return (
    <AuthProvider>
      <AssociateModeProvider>
        <EcommerceProvider>
          <Outlet />
        </EcommerceProvider>
      </AssociateModeProvider>
    </AuthProvider>
  );
};

export default App;
