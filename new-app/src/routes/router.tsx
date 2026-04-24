import { RouteObject, createBrowserRouter } from 'react-router';
import App from 'App';
import Content from 'pages/apps/content';
import DecoderPage, { DecoderConfig } from 'pages/decoders/DecoderPage';
import decoderConfigs from 'pages/decoders/decoder-configs.json';
import Page404 from 'pages/errors/Page404';

const decoderRoutes: RouteObject[] = (decoderConfigs as DecoderConfig[]).map((config) => ({
  path: config.routePath,
  element: <DecoderPage config={config} />,
}));

export const routes: RouteObject[] = [
  {
    element: <App />,
    children: [
      {
        path: '/',
        element: <Content />,
      },
      ...decoderRoutes,
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
