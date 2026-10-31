import { queryOptions } from '@tanstack/react-query';
import { api } from './api';

/** Shared by the admin layout (new-order badge and notifications) and the dashboard page. */
export const adminDashboardQuery = queryOptions({
  queryKey: ['admin', 'dashboard'],
  queryFn: ({ signal }) => api.admin.dashboard(signal),
});

/**
 * Polled while the admin is open (even in a background tab) so a new order shows up within half a
 * minute. The pulse is answered from the API's memory: polling the dashboard itself kept the Neon
 * database awake around the clock whenever an admin tab was left open, using up the free compute hours.
 */
export const adminPulseQuery = queryOptions({
  queryKey: ['admin', 'pulse'],
  queryFn: ({ signal }) => api.admin.pulse(signal),
  refetchInterval: 30_000,
  refetchIntervalInBackground: true,
});
