import { RouteObject, createBrowserRouter } from 'react-router';
import App from 'App';
import EcommerceLayout from 'layouts/ecommerce-layout';
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

const router = createBrowserRouter(routes, {
  basename: routerBasename,
});

export default router;
