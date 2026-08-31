import { createBrowserRouter } from "react-router";
import AuthGuard from "components/guard/AuthGuard";
import GuestGuard from "components/guard/GuestGuard";
import Login from "pages/Login";
import MonthsGrid from "pages/MonthsGrid";
import MonthDetail from "pages/MonthDetail";
import System from "pages/System";
import PublicView from "pages/PublicView";

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
    {
      path: "/system",
      element: (
        <AuthGuard>
          <System />
        </AuthGuard>
      ),
    },
    {
      // Deliberately no AuthGuard/GuestGuard — public by design, gated only by
      // knowing a valid token (§7). Never linked to from anywhere in the authed app.
      path: "/view",
      element: <PublicView />,
    },
  ],
  { basename: import.meta.env.BASE_URL },
);

export default router;
