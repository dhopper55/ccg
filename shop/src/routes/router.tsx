import { Outlet, RouteObject, createBrowserRouter } from 'react-router';
import EcommerceLayout from 'layouts/ecommerce-layout';
import Page404 from 'pages/errors/Page404';
import paths from './paths';
import Cart from 'pages/apps/ecommerce/customer/Cart';
import Checkout from 'pages/apps/ecommerce/customer/Checkout';
import OrderConfirmation from 'pages/apps/ecommerce/customer/OrderConfirmation';
import OrderDetails from 'pages/apps/ecommerce/customer/OrderDetails';
import OrderList from 'pages/apps/ecommerce/customer/OrderList';
import OrderTrack from 'pages/apps/ecommerce/customer/OrderTrack';
import Payment from 'pages/apps/ecommerce/customer/Payment';
import ProductDetails from 'pages/apps/ecommerce/customer/ProductDetails';
import Products from 'pages/apps/ecommerce/customer/Products';
import Wishlist from 'pages/apps/ecommerce/customer/Wishlist';

export const routes: RouteObject[] = [
  {
    element: <Outlet />,
    children: [
      {
        path: '/',
        element: (
          <EcommerceLayout>
            <Outlet />
          </EcommerceLayout>
        ),
        children: [
          {
            index: true,
            element: <Products />,
          },
          {
            path: paths.products,
            element: <Products />,
          },
          {
            path: '/products/:id',
            element: <ProductDetails />,
          },
          {
            path: paths.cart,
            element: <Cart />,
          },
          {
            path: paths.checkout,
            element: <Checkout />,
          },
          {
            path: paths.payment,
            element: <Payment />,
          },
          {
            path: paths.orderConfirmation,
            element: <OrderConfirmation />,
          },
          {
            path: paths.orderList,
            element: <OrderList />,
          },
          {
            path: '/orders/:id',
            element: <OrderDetails />,
          },
          {
            path: paths.orderTrack,
            element: <OrderTrack />,
          },
          {
            path: paths.wishlist,
            element: <Wishlist />,
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
