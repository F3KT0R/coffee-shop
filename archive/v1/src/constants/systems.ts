import { SystemCategory } from '../types';

export const SYSTEMS: SystemCategory[] = [
  { id: 'tass', type: 'tassimo', name: 'Tassimo' },
  { id: 'dolce', type: 'dolce-gusto', name: 'Dolce Gusto' },
  { id: 'ness', type: 'nespresso', name: 'Nespresso' },
  { id: 'lav', type: 'a-modo-mio', name: 'Lavazza' },
  { id: 'sen', type: 'senseo', name: 'Senseo' },
  { id: 'nessp', type: 'nes-pro', name: 'Nespresso Pro' },
  { id: 'tea', type: 'yogi-tea', name: 'Čajevi' },
  { id: 'syrup', type: 'syrup', name: 'Sirupi' },
];
