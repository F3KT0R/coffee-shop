import { createBrowserRouter } from 'react-router';
import { Layout } from './components/Layout';
import { CartPage } from './routes/CartPage';
import { Catalog } from './routes/Catalog';
import { CheckoutPage } from './routes/CheckoutPage';
import { Home } from './routes/Home';
import { HowToOrder } from './routes/HowToOrder';
import { NotFound, RouteError } from './routes/NotFound';
import { OrderPage } from './routes/OrderPage';
import { ProductPage } from './routes/ProductPage';

/** Admin screens are split into their own chunks -- shoppers never download them. */
const lazyDefault = (load: () => Promise<{ default: React.ComponentType }>) => async () => ({
  Component: (await load()).default,
});

export const router = createBrowserRouter([
  {
    element: <Layout />,
    errorElement: <RouteError />,
    children: [
      {
        errorElement: <RouteError />,
        children: [
          { index: true, element: <Home /> },
          { path: 'prodavnica', element: <Catalog /> },
          { path: 'proizvod/:slug', element: <ProductPage /> },
          { path: 'korpa', element: <CartPage /> },
          { path: 'kasa', element: <CheckoutPage /> },
          { path: 'porudzbina/:number', element: <OrderPage /> },
          { path: 'kako-poruciti', element: <HowToOrder /> },
          { path: 'admin/prijava', lazy: lazyDefault(() => import('./routes/admin/AdminLogin')) },
          {
            path: 'admin',
            lazy: lazyDefault(() => import('./routes/admin/AdminLayout')),
            children: [
              { index: true, lazy: lazyDefault(() => import('./routes/admin/AdminDashboard')) },
              { path: 'porudzbine', lazy: lazyDefault(() => import('./routes/admin/AdminOrders')) },
              { path: 'kupci', lazy: lazyDefault(() => import('./routes/admin/AdminCustomers')) },
              {
                path: 'porudzbine/:number',
                lazy: lazyDefault(() => import('./routes/admin/AdminOrderDetail')),
              },
              { path: 'slanje', lazy: lazyDefault(() => import('./routes/admin/AdminShipping')) },
              { path: 'nabavka', lazy: lazyDefault(() => import('./routes/admin/AdminProcurement')) },
              { path: 'sinhronizacija', lazy: lazyDefault(() => import('./routes/admin/AdminSync')) },
            ],
          },
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
]);
