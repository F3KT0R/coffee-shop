import { useQuery } from '@tanstack/react-query';
import { LOYALTY_TIERS } from '@kafeshop/core';
import { Link } from 'react-router';
import { shopConfigQuery } from '../lib/queries';

export function HowToOrder() {
  const { data: config } = useQuery(shopConfigQuery);
  const delivery = config?.deliveryEstimate ?? '5–6 nedelja';

  return (
    <article className="container-page max-w-3xl py-10">
      <title>Kako poručiti | Kafe za Vas</title>
      <p className="font-script text-2xl text-roast-500" aria-hidden="true">
        jednostavno
      </p>
      <h1 className="text-4xl font-extrabold sm:text-5xl">Kako poručiti</h1>
      <p className="mt-3 text-lg text-espresso-700">
        Proizvode poručujemo za vas iz Velike Britanije. Ništa ne plaćate unapred — plaćate tek kad preuzmete
        paket.
      </p>

      <div className="mt-10 space-y-10 text-[0.95rem] leading-relaxed">
        <section>
          <h2 className="text-2xl font-bold">1. Porudžbina</h2>
          <p className="mt-2">
            Izaberite proizvode, dodajte ih u korpu i unesite podatke za dostavu. Cene su izražene u dinarima.
            Odmah po porudžbini dobijate <b>broj porudžbine</b> i potvrdu na email sa linkom za praćenje.
          </p>
        </section>
        <section>
          <h2 className="text-2xl font-bold">2. Potvrda preko Instagrama</h2>
          <p className="mt-2">
            Pošaljite nam broj porudžbine u Instagram poruci
            {config?.instagramUrl && (
              <>
                {' '}
                (
                <a
                  href={config.instagramUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-roast-600 hover:underline"
                >
                  otvori Instagram
                </a>
                )
              </>
            )}
            . Nakon toga potvrđujemo porudžbinu i ona ulazi u narednu nabavku — o tome dobijate email.
          </p>
        </section>
        <section>
          <h2 className="text-2xl font-bold">3. Isporuka i plaćanje pouzećem</h2>
          <p className="mt-2">
            Isporuka traje {delivery} od potvrde. Kada paket stigne, iznos porudžbine plaćate kuriru
            (pouzećem). {config?.postageNote} O svakoj promeni statusa obaveštavamo vas emailom.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold">Kafe klub</h2>
          <p className="mt-2">
            Vernost nagrađujemo popustom, bez registracije: prepoznajemo vas po email adresi koju unosite pri
            porudžbini. Računaju se preuzete porudžbine, a popust se automatski obračunava:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            {LOYALTY_TIERS.map((tier) => (
              <li key={tier.id}>
                <b>{tier.name}</b> — od {tier.minOrders}. preuzete porudžbine, {tier.discountPercent}% popusta
              </li>
            ))}
          </ul>
        </section>

        <section id="uslovi" className="scroll-mt-24 rounded-3xl bg-crema-100 p-6">
          <h2 className="text-2xl font-bold">Uslovi kupovine</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6">
            <li>Porudžbina je potvrđena kada nam pošaljete broj porudžbine i mi je potvrdimo.</li>
            <li>
              Ako proizvod u međuvremenu postane nedostupan kod dobavljača, javljamo vam se i nudimo zamenu
              ili ga uklanjamo iz porudžbine.
            </li>
            <li>Porudžbinu možete otkazati bez troškova dok nije poručena od dobavljača.</li>
            <li>
              Poručeni proizvodi se nabavljaju posebno za vas — molimo vas da paket preuzmete i platite pri
              isporuci.
            </li>
            <li>Cene se ažuriraju svakodnevno; za vašu porudžbinu važi cena u trenutku poručivanja.</li>
            <li>
              Nazivi aparata (Nespresso®, Dolce Gusto®, Tassimo®, Senseo® i dr.) su žigovi svojih vlasnika i
              koriste se samo radi označavanja kompatibilnosti.
            </li>
          </ul>
        </section>
      </div>

      <Link to="/prodavnica" className="btn-primary mt-10">
        Pogledaj ponudu
      </Link>
    </article>
  );
}
