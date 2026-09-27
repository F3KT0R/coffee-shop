import cafeAuLait from '../assets/promo/cafe-au-lait.webp';
import cappuccinoIce from '../assets/promo/cappuccino-ice.webp';
import chocolate from '../assets/promo/chocolate.webp';
import cortado from '../assets/promo/cortado.webp';
import cremeBrulee from '../assets/promo/creme-brulee.webp';

/**
 * Featured products on the home page, using the shop's own promo artwork. To feature something new,
 * add a 1:1-ish image under src/assets/promo and an entry here; `to` can be a product or a filtered list.
 */
export interface Promo {
  image: string;
  title: string;
  subtitle: string;
  to: string;
}

export const PROMOS: Promo[] = [
  {
    image: cortado,
    title: 'Cortado',
    subtitle: 'Nescafé Dolce Gusto · 30 kapsula',
    to: '/proizvod/big-pack-cortado-nescafe-dolce-gusto',
  },
  {
    image: cafeAuLait,
    title: 'Café au Lait',
    subtitle: 'Nescafé Dolce Gusto · 30 kapsula',
    to: '/proizvod/big-pack-30-cafe-au-lait-nescafe-dolce-gusto',
  },
  {
    image: cremeBrulee,
    title: 'Crème Brûlée',
    subtitle: 'Dolce Vita · za Dolce Gusto',
    to: '/proizvod/creme-brulee-dolce-vita-dolce-gusto-12',
  },
  {
    image: chocolate,
    title: 'Chocolate',
    subtitle: 'Café René · za Dolce Gusto',
    to: '/proizvod/chocolate-cafe-rene-dolce-gusto',
  },
  {
    image: cappuccinoIce,
    title: 'Dolce Vita',
    subtitle: 'Cappuccino i dezertni napici',
    to: '/prodavnica?kategorija=kapsule&sistem=dolce-gusto&brend=Dolce%20Vita',
  },
];
