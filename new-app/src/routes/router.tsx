import { RouteObject, createBrowserRouter } from 'react-router';
import App from 'App';
import Content from 'pages/apps/content';
import Page404 from 'pages/errors/Page404';

export const routes: RouteObject[] = [
  {
    element: <App />,
    children: [
      {
        path: '/',
        element: <Content />,
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
