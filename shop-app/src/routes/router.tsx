import { ComponentType, LazyExoticComponent, Suspense, lazy } from 'react';
import { RouteObject, createBrowserRouter } from 'react-router';
import { CircularProgress, Stack } from '@mui/material';
import App from 'App';
import EcommerceLayout from 'layouts/ecommerce-layout';

// Each page is its own chunk, so a visitor only downloads the code for the page they open.
const Cart = lazy(() => import('pages/apps/ecommerce/customer/Cart'));
const CategoryPage = lazy(() => import('pages/apps/ecommerce/customer/CategoryPage'));
const CheckoutSuccess = lazy(() => import('pages/apps/ecommerce/customer/CheckoutSuccess'));
const ProductDetails = lazy(() => import('pages/apps/ecommerce/customer/ProductDetails'));
const Products = lazy(() => import('pages/apps/ecommerce/customer/Products'));
const DecoderRoute = lazy(() => import('pages/decoders/DecoderRoute'));
const Page404 = lazy(() => import('pages/errors/Page404'));

const page = (Page: LazyExoticComponent<ComponentType>) => (
  <Suspense
    fallback={
      <Stack sx={{ alignItems: 'center', justifyContent: 'center', py: 12 }}>
        <CircularProgress />
      </Stack>
    }
  >
    <Page />
  </Suspense>
);

export const routes: RouteObject[] = [
  {
    element: <App />,
    children: [
      {
        path: '/',
        element: (
          <EcommerceLayout>{page(Products)}</EcommerceLayout>
        ),
      },
      {
        path: '/cart',
        element: (
          <EcommerceLayout>{page(Cart)}</EcommerceLayout>
        ),
      },
      {
        path: '/checkout/success',
        element: (
          <EcommerceLayout>{page(CheckoutSuccess)}</EcommerceLayout>
        ),
      },
      {
        path: '/decoders/:decoderSlug',
        element: page(DecoderRoute),
      },
      {
        path: '/:categorySlug',
        element: (
          <EcommerceLayout>{page(CategoryPage)}</EcommerceLayout>
        ),
      },
      {
        path: '/:category/:slug',
        element: (
          <EcommerceLayout>{page(ProductDetails)}</EcommerceLayout>
        ),
      },
      {
        path: '*',
        element: page(Page404),
      },
    ],
  },
];

const rawBase = import.meta.env.VITE_BASENAME || '/';
const configuredShopBasename = rawBase.length > 1 && rawBase.endsWith('/') ? rawBase.slice(0, -1) : rawBase;
const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
const isRootPath = pathname.startsWith('/decoders');
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
