import { queryOptions } from '@tanstack/react-query';
import { api } from './api';

/**
 * Shared by the admin layout (new-order badge and notifications) and the dashboard page. Polled so a
 * new order shows up within half a minute while the admin is open.
 */
export const adminDashboardQuery = queryOptions({
  queryKey: ['admin', 'dashboard'],
  queryFn: ({ signal }) => api.admin.dashboard(signal),
  refetchInterval: 30_000,
  refetchIntervalInBackground: true,
});
