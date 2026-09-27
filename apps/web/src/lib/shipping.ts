import { formatRsd } from '@kafeshop/core';

export interface ShippingAddress {
  number: string;
  fullName: string;
  address: string;
  postalCode: string;
  city: string;
  phone: string;
  totalRsd: number;
}

/** The courier-ready text: recipient, address, phone and the cash-on-delivery amount ("otkupnina"). */
export function shippingText(o: ShippingAddress): string {
  return [
    o.fullName,
    o.address,
    `${o.postalCode} ${o.city}`,
    o.phone,
    `Otkupnina: ${formatRsd(o.totalRsd)}`,
    `Porudžbina: ${o.number}`,
  ].join('\n');
}
