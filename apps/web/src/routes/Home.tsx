import { useQuery } from '@tanstack/react-query';
import { LOYALTY_TIERS } from '@kafeshop/core';
import { Link } from 'react-router';
import heroImage from '../assets/promo/hero.webp';
import { BrushText, FeaturePill, HeartDoodle, SectionTitle } from '../components/Decor';
import { CartIcon, ChevronRightIcon, CoffeeIcon, MapPinIcon, TruckIcon, ChatIcon } from '../components/icons';
import { ProductCard, ProductCardSkeleton } from '../components/ProductCard';
import { ErrorState } from '../components/States';
import { PROMOS } from '../lib/promos';
import { metaQuery, productsQuery, shopConfigQuery } from '../lib/queries';

function ProductRow({
  kicker,
  title,
  href,
  params,
}: {
  kicker: string;
  title: string;
  href: string;
  params: Parameters<typeof productsQuery>[0];
}) {
  const { data, error, refetch, isPending } = useQuery(productsQuery(params));
  const { data: config } = useQuery(shopConfigQuery);
  const id = `row-${title.replace(/\W+/g, '-')}`;
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (!isPending && data.items.length === 0) return null;
  return (
    <section className="container-page mt-20" aria-labelledby={id}>
      <div className="mb-6 flex items-end justify-between gap-4">
        <SectionTitle id={id} kicker={kicker}>
          {title}
        </SectionTitle>
        <Link
          to={href}
          className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-roast-600 hover:text-roast-500"
        >
          Pogledaj sve <ChevronRightIcon size={16} />
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-4">
        {isPending
          ? Array.from({ length: 4 }, (_, i) => <ProductCardSkeleton key={i} />)
          : data.items.map((p) => (
              <ProductCard key={p.sku} product={p} ordersOpen={config?.ordersOpen ?? false} />
            ))}
      </div>
    </section>
  );
}

/**
 * Styled after the shop's Instagram posts: the photo fills the banner, warm dark light pours in from the
 * left for legibility, the headline sits on a cream brush panel, and the feature pills run along the bottom.
 */
function Hero() {
  return (
    <section className="container-page pt-4 sm:pt-6" aria-labelledby="hero-title">
      <div className="relative isolate overflow-hidden rounded-4xl bg-espresso-950 shadow-(--shadow-lift)">
        <img
          src={heroImage}
          alt=""
          width={735}
          height={804}
          fetchPriority="high"
          className="absolute inset-x-0 top-0 -z-20 h-[26rem] w-full object-cover object-[50%_65%] sm:h-[30rem] lg:inset-y-0 lg:right-0 lg:left-auto lg:h-full lg:w-[62%] lg:object-center"
        />
        {/* Café light: dark from the bottom on phones, from the left on large screens; a warm amber glow. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-linear-to-b from-transparent from-20% via-espresso-950/85 via-45% to-espresso-950 to-60% lg:bg-linear-to-r lg:from-espresso-950 lg:from-35% lg:via-espresso-950/60 lg:via-55% lg:to-transparent lg:to-85%"
        />
        <div
          aria-hidden="true"
          className="absolute -top-32 -left-24 -z-10 size-112 rounded-full bg-roast-400/25 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-40 left-1/4 -z-10 size-96 rounded-full bg-roast-500/20 blur-3xl"
        />
        <HeartDoodle className="absolute top-8 right-8 hidden size-14 rotate-12 text-crema-100/80 sm:block" />

        <div className="grid min-h-[38rem] content-between gap-12 px-6 pt-64 pb-6 sm:px-10 sm:pt-80 sm:pb-10 lg:min-h-[40rem] lg:px-14 lg:pt-16 lg:pb-12">
          <div className="max-w-xl">
            <h1 id="hero-title" className="brush-panel inline-block px-3 py-2 sm:px-5">
              <span className="block font-script text-6xl leading-[0.95] font-bold text-espresso-900 sm:text-7xl lg:text-8xl">
                Vratili smo se!
              </span>
              <span className="mt-2 flex items-center gap-2 font-sans text-lg font-bold tracking-normal text-espresso-800 sm:text-xl">
                Vaša omiljena kafa iz Velike Britanije, ponovo na klik
                <HeartDoodle className="size-6 shrink-0 text-roast-500" />
              </span>
            </h1>
            <p className="mt-10 max-w-md text-base text-crema-100/90 sm:text-lg">
              Kapsule za Nespresso, Dolce Gusto, Tassimo, Senseo i druge aparate, čajevi i sirupi — brendovi
              koje ne nalazite kod nas, po cenama u dinarima.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/prodavnica?kategorija=kapsule"
                className="btn bg-crema-100 px-7 py-3.5 text-base text-espresso-900 shadow-lg hover:bg-white"
              >
                Izaberi kapsule
              </Link>
              <Link
                to="/kako-poruciti"
                className="btn px-7 py-3.5 text-base text-crema-100 ring-1 ring-crema-100/50 hover:bg-white/10"
              >
                Kako poručiti
              </Link>
            </div>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
            <FeaturePill icon={<CoffeeIcon size={22} />}>Kapsule iz Velike Britanije</FeaturePill>
            <FeaturePill icon={<CartIcon size={22} />}>Vaša omiljena kafa na klik</FeaturePill>
            <FeaturePill icon={<TruckIcon size={22} />}>Slanje mesečno</FeaturePill>
            <FeaturePill icon={<MapPinIcon size={22} />}>Dostava širom Srbije</FeaturePill>
          </div>
        </div>
      </div>
    </section>
  );
}

function Featured() {
  return (
    <section className="mt-20" aria-labelledby="featured-title">
      <div className="container-page flex flex-wrap items-end justify-between gap-3">
        <SectionTitle id="featured-title" kicker="izdvajamo">
          Iz naše ponude
        </SectionTitle>
        <BrushText className="text-2xl sm:text-3xl">Odmah dostupno!</BrushText>
      </div>
      {/* Horizontal scroller on phones, a grid on large screens. */}
      <ul className="container-page mt-6 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto pb-4 sm:scroll-px-6 lg:grid lg:grid-cols-5 lg:overflow-visible">
        {PROMOS.map((promo) => (
          <li key={promo.to} className="w-[72%] shrink-0 snap-start sm:w-[42%] lg:w-auto">
            <Link to={promo.to} className="group block">
              <div className="overflow-hidden rounded-3xl shadow-(--shadow-card) ring-1 ring-espresso-900/10 transition group-hover:shadow-(--shadow-lift)">
                <img
                  src={promo.image}
                  alt={`${promo.title} — ${promo.subtitle}`}
                  width={720}
                  height={620}
                  loading="lazy"
                  className="aspect-720/620 w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                />
              </div>
              <p className="mt-3 font-display text-lg font-bold">{promo.title}</p>
              <p className="text-sm text-espresso-600">{promo.subtitle}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Systems() {
  const { data: meta } = useQuery(metaQuery({ category: 'kapsule' }));
  const systems = meta?.systems.slice(0, 8);
  return (
    <section className="container-page mt-16" aria-labelledby="systems-title">
      <div className="rounded-4xl bg-espresso-900 p-6 text-crema-100 sm:p-10">
        <p className="font-script text-2xl text-roast-400" aria-hidden="true">
          koji aparat imate?
        </p>
        <h2 id="systems-title" className="text-3xl font-bold sm:text-4xl">
          Kapsule za vaš aparat
        </h2>
        <ul className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {(systems ?? Array.from({ length: 8 }, () => null)).map((s, i) => (
            <li key={s?.value ?? i}>
              {s ? (
                <Link
                  to={`/prodavnica?kategorija=kapsule&sistem=${s.value}`}
                  className="flex items-center justify-between gap-2 rounded-full bg-white/8 py-3 pr-4 pl-5 ring-1 ring-white/10 transition hover:bg-white/15"
                >
                  <span className="font-bold">{s.label}</span>
                  <span className="rounded-full bg-crema-100/15 px-2 py-0.5 text-xs text-crema-200 tabular-nums">
                    {s.count}
                  </span>
                </Link>
              ) : (
                <div className="h-12 animate-pulse rounded-full bg-white/10" />
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function HowItWorks() {
  const { data: config } = useQuery(shopConfigQuery);
  const steps = [
    {
      icon: <CartIcon size={22} />,
      title: 'Izaberite i poručite',
      text: 'Dodajte kapsule u korpu i ostavite podatke za dostavu. Cene su u dinarima, bez skrivenih troškova.',
    },
    {
      icon: <ChatIcon size={22} />,
      title: 'Pošaljite broj porudžbine',
      text: 'Dobijate broj porudžbine — pošaljite nam ga u Instagram poruci i mi potvrđujemo porudžbinu.',
    },
    {
      icon: <TruckIcon size={22} />,
      title: 'Preuzmite i platite pouzećem',
      text: `Isporuka za ${config?.deliveryEstimate ?? '5–6 nedelja'} od potvrde. Ništa ne plaćate unapred — sve plaćate kuriru.`,
    },
  ];
  return (
    <section className="container-page mt-20" aria-labelledby="how-title">
      <SectionTitle id="how-title" kicker="jednostavno">
        Kako funkcioniše
      </SectionTitle>
      <ol className="mt-6 grid gap-4 md:grid-cols-3">
        {steps.map((step, i) => (
          <li key={step.title} className="card relative overflow-hidden p-6">
            <span
              className="absolute -top-3 right-4 font-script text-7xl font-bold text-crema-200"
              aria-hidden="true"
            >
              {i + 1}
            </span>
            <span className="relative grid size-12 place-items-center rounded-full bg-espresso-900 text-crema-100">
              {step.icon}
            </span>
            <h3 className="relative mt-4 text-xl font-bold">{step.title}</h3>
            <p className="relative mt-1.5 text-sm text-espresso-700">{step.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function KafeKlub() {
  return (
    <section className="container-page mt-20" aria-labelledby="klub-title">
      <div className="relative overflow-hidden rounded-4xl bg-espresso-900 p-6 text-crema-100 sm:p-10">
        <HeartDoodle className="absolute top-8 right-8 size-14 rotate-12 text-crema-100/30" />
        <p className="font-script text-2xl text-roast-400" aria-hidden="true">
          nagrađujemo vernost
        </p>
        <h2 id="klub-title" className="text-3xl font-bold sm:text-4xl">
          Kafe klub
        </h2>
        <p className="mt-2 max-w-2xl text-crema-200/85">
          Bez registracije i lozinki: prepoznajemo vas po email adresi. Svaka preuzeta porudžbina se računa, a
          popust se automatski obračunava pri sledećoj kupovini.
        </p>
        <ol className="mt-6 grid gap-3 sm:grid-cols-3">
          {LOYALTY_TIERS.map((tier) => (
            <li key={tier.id} className="rounded-3xl bg-white/8 p-5 ring-1 ring-white/10">
              <p className="font-display text-4xl font-extrabold text-crema-100">−{tier.discountPercent}%</p>
              <p className="mt-1 font-script text-2xl font-bold text-roast-400">{tier.name}</p>
              <p className="text-sm text-crema-200/80">od {tier.minOrders}. preuzete porudžbine</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function Home() {
  return (
    <>
      <title>Kafe za Vas — kafe kapsule za sve aparate</title>
      <Hero />
      <Featured />
      <ProductRow
        kicker="omiljeno"
        title="Najpopularnije"
        href="/prodavnica?kategorija=kapsule"
        params={{ category: 'kapsule', sort: 'popular', pageSize: 8 }}
      />
      <Systems />
      <ProductRow
        kicker="kupci preporučuju"
        title="Najbolje ocenjeno"
        href="/prodavnica?kategorija=kapsule&sort=rating"
        params={{ category: 'kapsule', sort: 'rating', pageSize: 4 }}
      />
      <section className="container-page mt-20 grid gap-4 sm:grid-cols-2" aria-label="Kategorije">
        {[
          {
            to: '/prodavnica?kategorija=caj',
            kicker: 'za mirne trenutke',
            title: 'Čajevi',
            text: 'Yogi Tea, chai latte, matcha i čajevi u kapsulama.',
          },
          {
            to: '/prodavnica?kategorija=sirupi',
            kicker: 'malo slatkoće',
            title: 'Sirupi za kafu',
            text: 'Karamela, vanila, lešnik — i verzije bez šećera.',
          },
        ].map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className="card group flex items-center justify-between gap-4 bg-crema-100 p-7 transition hover:shadow-(--shadow-lift)"
          >
            <div>
              <p className="font-script text-xl text-roast-500" aria-hidden="true">
                {c.kicker}
              </p>
              <h2 className="text-3xl font-bold">{c.title}</h2>
              <p className="mt-1 text-sm text-espresso-700">{c.text}</p>
            </div>
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-espresso-900 text-crema-100 transition group-hover:translate-x-1">
              <ChevronRightIcon />
            </span>
          </Link>
        ))}
      </section>
      <HowItWorks />
      <KafeKlub />
    </>
  );
}
