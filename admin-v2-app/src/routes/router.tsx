import { Outlet, RouteObject, createBrowserRouter } from "react-router";
import App from "App";
import AuthLayout from "layouts/auth-layout";
import DefaultAuthLayout from "layouts/auth-layout/DefaultAuthLayout";
import MainLayout from "layouts/main-layout";
import Page404 from "pages/errors/Page404";
import AuthGurad from "components/guard/AuthGuard";
import paths, { rootPaths } from "./paths";
import Login from 'pages/authentication/default/jwt/Login';
import Starter from 'pages/others/Starter';
import IconGallery from 'pages/others/IconGallery';
import ListingEvaluator from 'pages/listing-evaluator/ListingEvaluator';
import ListingEvaluatorItem from 'pages/listing-evaluator/ListingEvaluatorItem';
import ListingEvaluatorResults from 'pages/listing-evaluator/ListingEvaluatorResults';
import LoggedOut from 'pages/authentication/default/LoggedOut';
import Logout from 'pages/authentication/default/Logout';
import Signup from 'pages/authentication/default/jwt/Signup';
import ForgotPassword from 'pages/authentication/default/jwt/ForgotPassword';
import TwoFA from 'pages/authentication/default/jwt/TwoFA';
import SetPassword from 'pages/authentication/default/jwt/SetPassword';
import FirebaseLogin from 'pages/authentication/default/firebase/Login';
import FirebaseSignup from 'pages/authentication/default/firebase/Signup';
import FirebaseForgotPassword from 'pages/authentication/default/firebase/ForgotPassword';
import Auth0Login from 'pages/authentication/default/auth0/Login';

export const routes: RouteObject[] = [
  {
    element: (
      // Uncomment the following line to enable the Suspense fallback for initial loading when using AuthGuard

      // <Suspense fallback={<Splash />}>
      <App />
      // </Suspense>
    ),
    children: [
      {
        path: '/',
        element: (
          <AuthGurad>
          <MainLayout>
            <Outlet />
          </MainLayout>
          </AuthGurad>
        ),
        children: [
          {
            index: true,
            element: <Starter />,
          },
          {
            path: paths.listingEvaluatorResults,
            element: <ListingEvaluatorResults />,
          },
          {
            path: paths.listingEvaluator,
            element: <ListingEvaluator />,
          },
          {
            path: paths.listingEvaluatorItem,
            element: <ListingEvaluatorItem />,
          },
          {
            path: paths.logout,
            element: <Logout />,
          },
          {
            path: paths.iconGallery,
            element: <IconGallery />,
          },
        ],
      },

      {
        path: rootPaths.authRoot,
        element: <AuthLayout />,
        children: [
          {
            element: (
              <DefaultAuthLayout>
                <Outlet />
              </DefaultAuthLayout>
            ),
            children: [
              {
                path: paths.defaultJwtLogin,
                element: <Login />,
              },
              {
                path: paths.defaultJwtSignup,
                element: <Signup />,
              },
              {
                path: paths.defaultJwtForgotPassword,
                element: <ForgotPassword />,
              },
              {
                path: paths.defaultJwt2FA,
                element: <TwoFA />,
              },
              {
                path: paths.defaultJwtSetPassword,
                element: <SetPassword />,
              },
              {
                path: paths.defaultFirebaseLogin,
                element: <FirebaseLogin />,
              },
              {
                path: paths.defaultFirebaseSignup,
                element: <FirebaseSignup />,
              },
              {
                path: paths.defaultFirebaseForgotPassword,
                element: <FirebaseForgotPassword />,
              },
              {
                path: paths.defaultAuth0Login,
                element: <Auth0Login />,
              },
              {
                path: paths.defaultLoggedOut,
                element: <LoggedOut />,
              },
            ],
          },
        ],
      },

      {
        path: '*',
        element: <Page404 />,
      },
    ],
  },
];

const router = createBrowserRouter(routes, {
  basename: import.meta.env.VITE_BASENAME || '/',
});

export default router;
