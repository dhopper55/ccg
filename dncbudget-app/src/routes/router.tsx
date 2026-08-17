import { createBrowserRouter } from "react-router";
import AuthGuard from "components/guard/AuthGuard";
import GuestGuard from "components/guard/GuestGuard";
import Login from "pages/Login";
import MonthsGrid from "pages/MonthsGrid";
import MonthDetail from "pages/MonthDetail";

const router = createBrowserRouter(
  [
    {
      path: "/login",
      element: (
        <GuestGuard>
          <Login />
        </GuestGuard>
      ),
    },
    {
      path: "/",
      element: (
        <AuthGuard>
          <MonthsGrid />
        </AuthGuard>
      ),
    },
    {
      path: "/month",
      element: (
        <AuthGuard>
          <MonthDetail />
        </AuthGuard>
      ),
    },
  ],
  { basename: import.meta.env.BASE_URL },
);

export default router;
