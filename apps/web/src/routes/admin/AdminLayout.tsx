import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { NavLink, Navigate, Outlet, useLocation } from 'react-router';
import { BellIcon } from '../../components/icons';
import { Spinner } from '../../components/States';
import { adminDashboardQuery } from '../../lib/adminQueries';
import { ApiError, api } from '../../lib/api';

const adminSessionQuery = queryOptions({
  queryKey: ['admin', 'session'],
  queryFn: ({ signal }) => api.admin.session(signal),
  retry: (count, error) => error instanceof ApiError && error.transient && count < 3,
  staleTime: 5 * 60_000,
});

const notificationsSupported = typeof window !== 'undefined' && 'Notification' in window;

/**
 * While the admin is open (even in a background tab), a new order raises a desktop notification and
 * shows its count in the tab title. Email notifications cover the time the admin is closed.
 */
function useNewOrderAlerts(newCount: number | undefined) {
  const previous = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (newCount === undefined) return;
    const before = previous.current;
    previous.current = newCount;
    if (before === undefined || newCount <= before) return;
    if (notificationsSupported && Notification.permission === 'granted') {
      const added = newCount - before;
      new Notification('Kafe za Vas — nova porudžbina', {
        body: added === 1 ? 'Stigla je nova porudžbina.' : `Stiglo je ${added} novih porudžbina.`,
        icon: '/apple-touch-icon.png',
        tag: 'kzv-new-order',
      });
    }
  }, [newCount]);
}

function NotificationToggle() {
  const [permission, setPermission] = useState(notificationsSupported ? Notification.permission : 'denied');
  if (!notificationsSupported) return null;
  if (permission === 'granted') {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-xs text-emerald-800"
        title="Obaveštenja uključena"
      >
        <BellIcon size={16} /> Obaveštenja uključena
      </span>
    );
  }
  return (
    <button
      type="button"
      className="btn-ghost"
      disabled={permission === 'denied'}
      title={permission === 'denied' ? 'Obaveštenja su blokirana u podešavanjima pregledača' : undefined}
      onClick={() => void Notification.requestPermission().then(setPermission)}
    >
      <BellIcon size={16} /> Uključi obaveštenja
    </button>
  );
}

export function AdminLayout() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const session = useQuery(adminSessionQuery);
  const dashboard = useQuery({ ...adminDashboardQuery, enabled: session.isSuccess });
  const newCount = dashboard.data?.counts.NEW;
  useNewOrderAlerts(newCount);
  const logout = useMutation({
    mutationFn: api.admin.logout,
    onSettled: () => queryClient.removeQueries({ queryKey: ['admin'] }),
  });

  if (session.isPending) return <Spinner label="Provera prijave…" />;
  if (session.error) {
    if (session.error instanceof ApiError && session.error.status === 401) {
      return <Navigate to="/admin/prijava" replace state={{ from: location.pathname }} />;
    }
    return <p className="container-page py-10 text-red-800">{session.error.message}</p>;
  }

  const tab = ({ isActive }: { isActive: boolean }) =>
    `inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold ${isActive ? 'bg-espresso-900 text-crema-100' : 'hover:bg-crema-200'}`;

  return (
    <div className="container-page py-8">
      <title>{`${newCount ? `(${newCount}) ` : ''}Administracija | Kafe za Vas`}</title>
      <meta name="robots" content="noindex" />
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Administracija" className="flex flex-wrap gap-1.5">
          <NavLink to="/admin" end className={tab}>
            Pregled
          </NavLink>
          <NavLink to="/admin/porudzbine" className={tab}>
            Porudžbine
            {!!newCount && (
              <span
                className="grid min-w-5 place-items-center rounded-full bg-amber-400 px-1 text-[0.7rem] font-bold text-espresso-950"
                aria-label={`${newCount} novih`}
              >
                {newCount}
              </span>
            )}
          </NavLink>
          <NavLink to="/admin/kupci" className={tab}>
            Kupci
          </NavLink>
          <NavLink to="/admin/nabavka" className={tab}>
            Nabavka
          </NavLink>
          <NavLink to="/admin/slanje" className={tab}>
            Slanje
          </NavLink>
          <NavLink to="/admin/sinhronizacija" className={tab}>
            Katalog
          </NavLink>
        </nav>
        <div className="flex items-center gap-3">
          <NotificationToggle />
          <button
            type="button"
            className="btn-ghost"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
          >
            Odjava
          </button>
        </div>
      </div>
      <Outlet />
    </div>
  );
}

export default AdminLayout;
