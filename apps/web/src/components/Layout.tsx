import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  Link,
  NavLink,
  Outlet,
  ScrollRestoration,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router';
import { selectItemCount, useCart } from '../lib/cart';
import { shopConfigQuery } from '../lib/queries';
import { HeartDoodle } from './Decor';
import { CartIcon, CloseIcon, CoffeeIcon, MenuIcon, SearchIcon } from './icons';

const NAV = [
  { to: '/prodavnica?kategorija=kapsule', label: 'Kapsule' },
  { to: '/prodavnica?kategorija=zrno', label: 'Kafa u zrnu' },
  { to: '/prodavnica?kategorija=caj', label: 'Čajevi' },
  { to: '/prodavnica?kategorija=sirupi', label: 'Sirupi' },
  { to: '/kako-poruciti', label: 'Kako poručiti' },
];

function SearchForm({ onDone, autoFocus = false }: { onDone?: () => void; autoFocus?: boolean }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [value, setValue] = useState(params.get('q') ?? '');

  function submit(event: FormEvent) {
    event.preventDefault();
    const q = value.trim();
    navigate(q ? `/prodavnica?q=${encodeURIComponent(q)}` : '/prodavnica');
    onDone?.();
  }

  return (
    <form role="search" onSubmit={submit} className="relative w-full">
      <label htmlFor={autoFocus ? 'search-mobile' : 'search'} className="sr-only">
        Pretraga proizvoda
      </label>
      <SearchIcon
        size={18}
        className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-espresso-600/60"
      />
      <input
        id={autoFocus ? 'search-mobile' : 'search'}
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Pretraži kafe, brendove, aparate…"
        className="input rounded-full bg-crema-100 pl-10"
        autoFocus={autoFocus}
        maxLength={100}
      />
    </form>
  );
}

function CartLink() {
  const count = useCart(selectItemCount);
  return (
    <Link
      to="/korpa"
      className="relative grid size-11 place-items-center rounded-full hover:bg-crema-200"
      aria-label={count > 0 ? `Korpa, ${count} proizvoda` : 'Korpa je prazna'}
    >
      <CartIcon size={22} />
      {count > 0 && (
        <span className="absolute top-1 right-0.5 grid min-w-5 place-items-center rounded-full bg-roast-500 px-1 text-[0.7rem] font-bold text-white tabular-nums">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}

function MobileMenu() {
  const dialog = useRef<HTMLDialogElement>(null);
  const location = useLocation();
  useEffect(() => dialog.current?.close(), [location]);

  return (
    <>
      <button
        type="button"
        className="grid size-11 place-items-center rounded-full hover:bg-crema-200 lg:hidden"
        onClick={() => dialog.current?.showModal()}
        aria-label="Otvori meni"
      >
        <MenuIcon size={22} />
      </button>
      <dialog
        ref={dialog}
        className="m-0 h-dvh max-h-none w-[min(22rem,90vw)] max-w-none bg-crema-50 p-0 text-espresso-900"
        aria-label="Meni"
      >
        <div className="flex items-center justify-between border-b border-espresso-900/10 p-4">
          <span className="font-display text-lg font-semibold">Meni</span>
          <button
            type="button"
            className="grid size-10 place-items-center rounded-full hover:bg-crema-200"
            onClick={() => dialog.current?.close()}
            aria-label="Zatvori meni"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="p-4">
          <SearchForm onDone={() => dialog.current?.close()} />
        </div>
        <nav aria-label="Glavni meni">
          <ul className="px-2">
            {NAV.map((item) => (
              <li key={item.to}>
                <Link to={item.to} className="block rounded-xl px-3 py-3 font-medium hover:bg-crema-200">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </dialog>
    </>
  );
}

export function Layout() {
  const { data: config } = useQuery(shopConfigQuery);

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3"
      >
        Preskoči na sadržaj
      </a>
      {config && !config.ordersOpen && (
        <div className="bg-roast-500 px-4 py-2 text-center text-sm font-medium text-white">
          {config.closedMessage}
        </div>
      )}
      <header className="sticky top-0 z-30 border-b border-espresso-900/10 bg-crema-50/85 backdrop-blur-md">
        <div className="container-page flex h-18 items-center gap-3 lg:gap-8">
          <MobileMenu />
          <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label="Kafe za Vas, početna">
            <span className="grid size-11 place-items-center rounded-full bg-espresso-900 text-crema-100 ring-2 ring-crema-200">
              <CoffeeIcon size={22} />
            </span>
            <span className="font-script text-[2rem] leading-none font-bold text-espresso-900">
              Kafe za Vas
            </span>
          </Link>
          <nav aria-label="Glavni meni" className="hidden lg:block">
            <ul className="flex gap-1">
              {NAV.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className="rounded-full px-3.5 py-2 text-[0.95rem] font-bold text-espresso-800 hover:bg-crema-200"
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className="ml-auto hidden w-full max-w-sm md:block">
            <SearchForm />
          </div>
          <div className="ml-auto md:ml-0">
            <CartLink />
          </div>
        </div>
      </header>

      <main id="main" className="flex-1">
        <Outlet />
      </main>

      <footer className="mt-24 rounded-t-[2.5rem] bg-espresso-900 text-crema-200">
        <div className="container-page grid gap-10 py-14 sm:grid-cols-3">
          <div>
            <p className="flex items-center gap-2 font-script text-4xl font-bold text-crema-100">
              Kafe za Vas <HeartDoodle className="size-7 text-roast-400" />
            </p>
            <p className="mt-2 max-w-xs text-sm text-crema-200/75">
              Kapsule, kafa u zrnu, čajevi i sirupi iz Velike Britanije, poručeni za vas i dostavljeni na vašu
              adresu širom Srbije.
            </p>
          </div>
          <nav aria-label="Prodavnica">
            <p className="text-sm font-semibold text-crema-100">Prodavnica</p>
            <ul className="mt-3 space-y-2 text-sm">
              {NAV.slice(0, 3).map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className="hover:text-white">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Informacije">
            <p className="text-sm font-semibold text-crema-100">Informacije</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link to="/kako-poruciti" className="hover:text-white">
                  Kako poručiti i plaćanje
                </Link>
              </li>
              <li>
                <Link to="/kako-poruciti#uslovi" className="hover:text-white">
                  Uslovi kupovine
                </Link>
              </li>
            </ul>
          </nav>
        </div>
        <div className="border-t border-white/10">
          <p className="container-page py-5 text-xs text-crema-200/60">
            Nespresso®, Dolce Gusto®, Tassimo®, Senseo® i ostali nazivi aparata su zaštićeni žigovi svojih
            vlasnika. Navode se samo radi označavanja kompatibilnosti.
          </p>
        </div>
      </footer>
      <ScrollRestoration />
    </div>
  );
}
