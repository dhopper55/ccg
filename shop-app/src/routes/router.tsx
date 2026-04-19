import { RouteObject, createBrowserRouter } from 'react-router';
import App from 'App';
import EcommerceLayout from 'layouts/ecommerce-layout';
import Cart from 'pages/apps/ecommerce/customer/Cart';
import CheckoutSuccess from 'pages/apps/ecommerce/customer/CheckoutSuccess';
import ProductDetails from 'pages/apps/ecommerce/customer/ProductDetails';
import Products from 'pages/apps/ecommerce/customer/Products';
import Page404 from 'pages/errors/Page404';

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
const routerBasename = rawBase.length > 1 && rawBase.endsWith('/') ? rawBase.slice(0, -1) : rawBase;

if (typeof window !== 'undefined') {
  const isShopRoot =
    window.location.pathname === routerBasename ||
    window.location.pathname === `${routerBasename}/`;
  if (routerBasename !== '/' && isShopRoot && window.location.hash.startsWith('#/')) {
    window.history.replaceState(
      null,
      '',
      `${routerBasename}${window.location.hash.slice(1)}${window.location.search}`,
    );
  }
}

const router = createBrowserRouter(routes, {
  basename: routerBasename,
});

export default router;
