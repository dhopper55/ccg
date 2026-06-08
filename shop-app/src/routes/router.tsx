import { RouteObject, createBrowserRouter } from 'react-router';
import App from 'App';
import EcommerceLayout from 'layouts/ecommerce-layout';
import Cart from 'pages/apps/ecommerce/customer/Cart';
import CategoryPage from 'pages/apps/ecommerce/customer/CategoryPage';
import CheckoutSuccess from 'pages/apps/ecommerce/customer/CheckoutSuccess';
import ProductDetails from 'pages/apps/ecommerce/customer/ProductDetails';
import Products from 'pages/apps/ecommerce/customer/Products';
import DecoderPage, { DecoderConfig } from 'pages/decoders/DecoderPage';
import decoderConfigs from 'pages/decoders/decoder-configs.json';
import GuitarEvalPage from 'pages/guitar-eval/GuitarEvalPage';
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
        element: (
          <EcommerceLayout>
            <Products />
          </EcommerceLayout>
        ),
      },
      {
        path: '/cart',
        element: (
          <EcommerceLayout>
            <Cart />
          </EcommerceLayout>
        ),
      },
      {
        path: '/checkout/success',
        element: (
          <EcommerceLayout>
            <CheckoutSuccess />
          </EcommerceLayout>
        ),
      },
      ...decoderRoutes,
      {
        path: '/guitar-value-report-evaluation',
        element: <GuitarEvalPage />,
      },
      {
        path: '/:categorySlug',
        element: (
          <EcommerceLayout>
            <CategoryPage />
          </EcommerceLayout>
        ),
      },
      {
        path: '/:category/:slug',
        element: (
          <EcommerceLayout>
            <ProductDetails />
          </EcommerceLayout>
        ),
      },
      {
        path: '*',
        element: <Page404 />,
      },
    ],
  },
];

const rawBase = import.meta.env.VITE_BASENAME || '/';
const configuredShopBasename = rawBase.length > 1 && rawBase.endsWith('/') ? rawBase.slice(0, -1) : rawBase;
const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
const isRootPath = pathname.startsWith('/decoders') || pathname.startsWith('/guitar-value-report-evaluation');
const routerBasename = isRootPath ? '/' : configuredShopBasename;

if (typeof window !== 'undefined') {
  const isShopRoot =
    window.location.pathname === configuredShopBasename ||
    window.location.pathname === `${configuredShopBasename}/`;
  if (routerBasename !== '/' && isShopRoot && window.location.hash.startsWith('#/')) {
    window.history.replaceState(
      null,
      '',
      `${configuredShopBasename}${window.location.hash.slice(1)}${window.location.search}`,
    );
  }
}

const router = createBrowserRouter(routes, {
  basename: routerBasename,
});

export default router;
