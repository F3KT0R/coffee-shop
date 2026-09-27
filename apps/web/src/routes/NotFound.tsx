import { Link, isRouteErrorResponse, useRouteError } from 'react-router';
import { EmptyState } from '../components/States';

export function NotFound() {
  return (
    <div className="container-page py-12">
      <title>Stranica nije pronađena | Kafe za Vas</title>
      <EmptyState title="Ova stranica ne postoji">
        <p>Možda je proizvod povučen iz ponude ili je link pogrešan.</p>
        <Link to="/prodavnica" className="btn-primary mt-4">
          Nazad u prodavnicu
        </Link>
      </EmptyState>
    </div>
  );
}

/** Last-resort boundary: a render error in one page must not blank the whole shop. */
export function RouteError() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFound />;
  console.error(error);
  const isChunkError =
    error instanceof Error && /dynamically imported module|Loading chunk/i.test(error.message);
  return (
    <div className="container-page py-16">
      <EmptyState title={isChunkError ? 'Izašla je nova verzija sajta' : 'Došlo je do greške'}>
        <p>
          {isChunkError
            ? 'Osvežite stranicu da biste učitali najnoviju verziju.'
            : 'Pokušajte da osvežite stranicu.'}
        </p>
        <button type="button" className="btn-primary mt-4" onClick={() => window.location.reload()}>
          Osveži stranicu
        </button>
      </EmptyState>
    </div>
  );
}
