import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ErrorState, Spinner } from '../../components/States';
import { api } from '../../lib/api';

const dateTime = new Intl.DateTimeFormat('sr-Latn-RS', { dateStyle: 'short', timeStyle: 'medium' });

const STATUS: Record<string, string> = {
  RUNNING: 'bg-sky-100 text-sky-900',
  SUCCEEDED: 'bg-emerald-100 text-emerald-900',
  FAILED: 'bg-red-100 text-red-900',
};

export function AdminSync() {
  const queryClient = useQueryClient();
  const runs = useQuery({
    queryKey: ['admin', 'sync-runs'],
    queryFn: ({ signal }) => api.admin.syncRuns(signal),
    refetchInterval: (query) => (query.state.data?.running ? 5_000 : false),
  });
  const start = useMutation({
    mutationFn: api.admin.startSync,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'sync-runs'] }),
  });

  if (runs.error) return <ErrorState error={runs.error} onRetry={() => void runs.refetch()} />;
  if (runs.isPending) return <Spinner />;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Sinhronizacija kataloga</h1>
          <p className="text-sm text-espresso-700">
            Proizvodi, cene i dostupnost se automatski osvežavaju sa KaffeK jednom dnevno.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => start.mutate()}
          disabled={runs.data.running || start.isPending}
        >
          {runs.data.running ? 'Sinhronizacija u toku…' : 'Pokreni sada'}
        </button>
      </div>

      <div className="card mt-5 overflow-x-auto">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <thead className="border-b border-espresso-900/10 text-xs text-espresso-600 uppercase">
            <tr>
              <th className="px-4 py-3">Početak</th>
              <th className="px-4 py-3">Pokrenuto</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Primljeno</th>
              <th className="px-4 py-3 text-right">Ažurirano</th>
              <th className="px-4 py-3 text-right">Povučeno</th>
              <th className="px-4 py-3 text-right">Kurs GBP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-espresso-900/10">
            {runs.data.items.map((run) => (
              <tr key={run.id} className="align-top">
                <td className="px-4 py-3 tabular-nums">{dateTime.format(new Date(run.startedAt))}</td>
                <td className="px-4 py-3">{run.trigger}</td>
                <td className="px-4 py-3">
                  <span className={`chip ${STATUS[run.status]}`}>{run.status}</span>
                  {run.error && <p className="mt-1 max-w-xs text-xs text-espresso-700">{run.error}</p>}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{run.fetched}</td>
                <td className="px-4 py-3 text-right tabular-nums">{run.upserted}</td>
                <td className="px-4 py-3 text-right tabular-nums">{run.retired}</td>
                <td className="px-4 py-3 text-right tabular-nums">{run.gbpRsdRate?.toFixed(2) ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AdminSync;
