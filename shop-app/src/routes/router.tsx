import { RouteObject, createBrowserRouter } from 'react-router';
import App from 'App';
import EcommerceLayout from 'layouts/ecommerce-layout';
import ProductDetails from 'pages/apps/ecommerce/customer/ProductDetails';
import Products from 'pages/apps/ecommerce/customer/Products';
import Page404 from 'pages/errors/Page404';
import paths from './paths';

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
        path: paths.productDetails(':id'),
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

const router = createBrowserRouter(routes, {
  basename: import.meta.env.VITE_BASENAME || '/',
});

export default router;
