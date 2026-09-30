import { ORDER_STATUSES, formatRsd, type LoyaltyStatus, type OrderStatus } from '@kafeshop/core';
import type { MailMessage } from '../mail/mailer.js';

/**
 * Transactional emails in the shop's visual language (latte/cream, chocolate, script headline).
 *
 * Email clients are not browsers: no web fonts (Gmail ignores them), no <style>-only CSS that Gmail
 * strips, no flexbox. So these are 600px table layouts with inline styles, Georgia for the serif
 * headings, a system sans for text, and the handwritten headline baked into a header image
 * (apps/web/public/email/*.jpg, served from the shop's own domain).
 */

export interface EmailOrder {
  number: string;
  status: OrderStatus;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  note: string;
  subtotalRsd: number;
  discountRsd: number;
  loyaltyTier: string | null;
  totalRsd: number;
  lines: {
    name: string;
    brand: string;
    image?: string | null;
    quantity: number;
    unitPriceRsd: number;
    lineTotalRsd: number;
  }[];
}

export interface EmailContext {
  siteUrl: string;
  statusUrl: string;
  deliveryEstimate: string;
  postageNote: string;
  instagramUrl: string;
  /** Kafe klub standing before this order (picked-up orders only). */
  loyalty?: LoyaltyStatus;
}

const BRAND = 'Kafe za Vas';
const C = {
  page: '#f6ebdd',
  card: '#fffaf3',
  soft: '#f3e3cf',
  ink: '#3a2214',
  muted: '#86603f',
  accent: '#ad6d3a',
  line: '#ead8c2',
  good: '#2f6b43',
};
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "'Segoe UI', Helvetica, Arial, sans-serif";

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!,
  );

const firstName = (fullName: string) => fullName.split(' ')[0] || fullName;

function button(href: string, label: string, dark = true): string {
  const bg = dark ? C.ink : C.card;
  const fg = dark ? C.page : C.ink;
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:separate"><tr>
<td style="background:${bg};border-radius:999px;${dark ? '' : `border:2px solid ${C.ink};`}">
<a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 26px;font-family:${SANS};font-size:15px;font-weight:700;color:${fg};text-decoration:none">${escapeHtml(label)}</a>
</td></tr></table>`;
}

/** Page shell: preheader (the inbox preview line), header image, content card, footer. */
function shell(opts: { preheader: string; header: string; ctx: EmailContext; body: string }): string {
  const { ctx } = opts;
  return `<!doctype html>
<html lang="sr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${BRAND}</title></head>
<body style="margin:0;padding:0;background:${C.page}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(opts.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:${C.card};border-radius:22px;overflow:hidden">
<tr><td><img src="${escapeHtml(`${ctx.siteUrl}/email/${opts.header}`)}" width="600" alt="${BRAND}" style="display:block;width:100%;height:auto;border:0"></td></tr>
<tr><td style="padding:28px 32px 32px;font-family:${SANS};font-size:15px;line-height:1.6;color:${C.ink}">
${opts.body}
</td></tr>
</table>
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px"><tr>
<td style="padding:22px 12px;text-align:center;font-family:${SANS};font-size:13px;line-height:1.6;color:${C.muted}">
<img src="${escapeHtml(`${ctx.siteUrl}/apple-touch-icon.png`)}" width="40" height="40" alt="" style="display:inline-block;border-radius:12px;border:0"><br>
<b style="font-family:${SERIF};font-size:16px;color:${C.ink}">${BRAND}</b> &#9825;<br>
Kapsule, kafa u zrnu, čajevi i sirupi iz Velike Britanije, dostavljeni širom Srbije.<br>
<a href="${escapeHtml(ctx.siteUrl)}" style="color:${C.accent}">Prodavnica</a> &middot;
<a href="${escapeHtml(ctx.instagramUrl)}" style="color:${C.accent}">Instagram</a> &middot;
<a href="${escapeHtml(ctx.statusUrl)}" style="color:${C.accent}">Vaša porudžbina</a>
</td></tr></table>
</td></tr></table>
</body></html>`;
}

function orderNumberBlock(number: string, statusName: string): string {
  return `<p style="margin:0;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${C.muted};font-weight:700">Broj porudžbine</p>
<p style="margin:2px 0 6px;font-family:${SERIF};font-size:40px;line-height:1.1;font-weight:700;letter-spacing:1px;color:${C.ink}">${escapeHtml(number)}</p>
<span style="display:inline-block;background:${C.soft};color:${C.ink};border-radius:999px;padding:3px 12px;font-size:13px;font-weight:700">${escapeHtml(statusName)}</span>`;
}

function heading(text: string): string {
  return `<h2 style="margin:28px 0 10px;font-family:${SERIF};font-size:22px;line-height:1.2;color:${C.ink}">${escapeHtml(text)}</h2>`;
}

function productsTable(order: EmailOrder, totalLabel: string): string {
  const rows = order.lines
    .map(
      (l) => `<tr>
<td width="68" style="padding:10px 12px 10px 0;border-bottom:1px solid ${C.line};vertical-align:middle">
${l.image ? `<img src="${escapeHtml(l.image)}" width="56" height="56" alt="" style="display:block;width:56px;height:56px;background:#ffffff;border-radius:10px;border:1px solid ${C.line}">` : ''}
</td>
<td style="padding:10px 8px 10px 0;border-bottom:1px solid ${C.line};vertical-align:middle">
<span style="display:block;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;font-weight:700;color:${C.accent}">${escapeHtml(l.brand)}</span>
<span style="display:block;font-family:${SERIF};font-size:16px;font-weight:700;color:${C.ink}">${escapeHtml(l.name)}</span>
<span style="font-size:13px;color:${C.muted}">${l.quantity} &times; ${formatRsd(l.unitPriceRsd)}</span>
</td>
<td style="padding:10px 0;border-bottom:1px solid ${C.line};text-align:right;vertical-align:middle;white-space:nowrap;font-weight:700">${formatRsd(l.lineTotalRsd)}</td>
</tr>`,
    )
    .join('');
  const row = (label: string, value: string, style = '') =>
    `<tr><td colspan="2" style="padding:6px 0;${style}">${label}</td><td style="padding:6px 0;text-align:right;white-space:nowrap;${style}">${value}</td></tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:15px">
${rows}
<tr><td colspan="3" style="height:8px"></td></tr>
${row('Proizvodi', formatRsd(order.subtotalRsd))}
${order.discountRsd > 0 ? row(`Kafe klub popust${order.loyaltyTier ? ` (${escapeHtml(order.loyaltyTier)})` : ''}`, `&minus;${formatRsd(order.discountRsd)}`, `color:${C.good};font-weight:700`) : ''}
${row('Poštarina', 'plaća se kuriru', `color:${C.muted}`)}
<tr><td colspan="3" style="padding-top:8px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.ink};border-radius:14px"><tr>
<td style="padding:14px 18px;color:${C.page};font-size:15px;font-weight:700">${escapeHtml(totalLabel)}</td>
<td style="padding:14px 18px;color:${C.page};font-family:${SERIF};font-size:24px;font-weight:700;text-align:right;white-space:nowrap">${formatRsd(order.totalRsd)}</td>
</tr></table>
</td></tr>
</table>`;
}

function loyaltyBlock(loyalty: LoyaltyStatus | undefined): string {
  if (!loyalty) return '';
  let text: string;
  if (loyalty.tier && !loyalty.next) {
    text = `Vi ste <b>${escapeHtml(loyalty.tier.name)}</b>, najviši nivo Kafe kluba, sa ${loyalty.tier.discountPercent}% popusta na svaku porudžbinu. Hvala što ste sa nama!`;
  } else if (loyalty.next) {
    const n = loyalty.next.ordersNeeded;
    const more = n === 1 ? 'još 1 preuzeta porudžbina' : `još ${n} preuzete porudžbine`;
    text = loyalty.tier
      ? `Vi ste <b>${escapeHtml(loyalty.tier.name)}</b> (${loyalty.tier.discountPercent}% popusta). Do nivoa <b>${escapeHtml(loyalty.next.name)}</b> i ${loyalty.next.discountPercent}% popusta: ${more}.`
      : `Do Kafe kluba i <b>${loyalty.next.discountPercent}% popusta</b> na svaku sledeću kupovinu: ${more}.`;
  } else {
    return '';
  }
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;background:${C.soft};border-radius:16px"><tr>
<td style="padding:16px 18px;font-size:14px;line-height:1.55;color:${C.ink}"><b style="font-family:${SERIF};font-size:17px">Kafe klub &#9825;</b><br>${text}</td>
</tr></table>`;
}

function addressBlock(order: EmailOrder): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.line};border-radius:16px"><tr>
<td style="padding:16px 18px;font-size:14px;line-height:1.6">
<b>${escapeHtml(order.fullName)}</b><br>${escapeHtml(order.address)}<br>${escapeHtml(order.postalCode)} ${escapeHtml(order.city)}<br>${escapeHtml(order.phone)}
${order.note ? `<br><span style="color:${C.muted}">Napomena: ${escapeHtml(order.note)}</span>` : ''}
</td></tr></table>`;
}

function nextSteps(ctx: EmailContext): string {
  const steps: [string, string][] = [
    ['Potvrda', 'Kada nam pošaljete broj na Instagramu, potvrđujemo porudžbinu i javljamo vam emailom.'],
    [
      'Nabavka',
      `Proizvode poručujemo iz Velike Britanije. Isporuka stiže za ${ctx.deliveryEstimate} od potvrde.`,
    ],
    ['Preuzimanje', `Kurir vam donosi paket, a vi plaćate pouzećem. ${ctx.postageNote}`],
  ];
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${steps
    .map(
      ([title, text], i) => `<tr>
<td width="42" style="vertical-align:top;padding:4px 12px 12px 0">
<div style="width:30px;height:30px;line-height:30px;border-radius:999px;background:${C.ink};color:${C.page};text-align:center;font-family:${SERIF};font-weight:700">${i + 1}</div></td>
<td style="vertical-align:top;padding:4px 0 12px;font-size:14px;line-height:1.5"><b>${title}</b><br><span style="color:${C.muted}">${escapeHtml(text)}</span></td>
</tr>`,
    )
    .join('')}</table>`;
}

function linesText(order: EmailOrder, totalLabel: string): string {
  return [
    ...order.lines.map((l) => `- ${l.brand} ${l.name} × ${l.quantity} = ${formatRsd(l.lineTotalRsd)}`),
    ...(order.discountRsd > 0 ? [`Kafe klub popust: −${formatRsd(order.discountRsd)}`] : []),
    `${totalLabel}: ${formatRsd(order.totalRsd)} + poštarina`,
  ].join('\n');
}

/** The customer's receipt, sent right after ordering. */
/** A realistic made-up order for the admin's "send a test email" button. */
export function sampleEmailOrder(): EmailOrder {
  return {
    number: '000000-0000',
    status: 'NEW',
    fullName: 'Probni Kupac',
    email: 'kupac@primer.rs',
    phone: '+381641234567',
    address: 'Bulevar oslobođenja 12',
    city: 'Novi Sad',
    postalCode: '21000',
    note: 'Ovo je probni email -- porudžbina ne postoji.',
    subtotalRsd: 3_900,
    discountRsd: 190,
    loyaltyTier: 'Stalni gost',
    totalRsd: 3_710,
    lines: [
      {
        name: 'Cortado',
        brand: 'Nescafé',
        image: null,
        quantity: 2,
        unitPriceRsd: 1_550,
        lineTotalRsd: 3_100,
      },
      {
        name: 'Café au Lait',
        brand: 'KaffeK',
        image: null,
        quantity: 1,
        unitPriceRsd: 800,
        lineTotalRsd: 800,
      },
    ],
  };
}

export function orderConfirmationEmail(order: EmailOrder, ctx: EmailContext): MailMessage {
  const body = `<p style="margin:0 0 18px;font-size:16px">Zdravo ${escapeHtml(firstName(order.fullName))}, hvala što ste izabrali nas! Evo vaše porudžbine.</p>
${orderNumberBlock(order.number, ORDER_STATUSES.NEW.name)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px;background:${C.soft};border-radius:18px"><tr>
<td style="padding:20px 22px">
<p style="margin:0 0 4px;font-family:${SERIF};font-size:19px;font-weight:700">Poslednji korak</p>
<p style="margin:0 0 14px;font-size:14px;line-height:1.55">Pošaljite nam broj <b>${escapeHtml(order.number)}</b> u Instagram poruci. Tako potvrđujemo da je porudžbina vaša i uključujemo je u narednu nabavku.</p>
${button(ctx.instagramUrl, 'Pošalji na Instagramu')}
</td></tr></table>
${heading('Vaša porudžbina')}
${productsTable(order, 'Plaćate pouzećem')}
${loyaltyBlock(ctx.loyalty)}
${heading('Dostava na adresu')}
${addressBlock(order)}
${heading('Šta sledi')}
${nextSteps(ctx)}
<div style="margin-top:18px">${button(ctx.statusUrl, 'Pratite porudžbinu', false)}</div>`;

  const text = [
    `Zdravo ${order.fullName}, hvala na porudžbini!`,
    `Broj porudžbine: ${order.number}`,
    `Pošaljite nam ovaj broj u Instagram poruci: ${ctx.instagramUrl}`,
    '',
    linesText(order, 'Plaćate pouzećem'),
    '',
    `Dostava: ${order.fullName}, ${order.address}, ${order.postalCode} ${order.city}, ${order.phone}`,
    `Isporuka za ${ctx.deliveryEstimate} od potvrde. Plaćanje pouzećem. ${ctx.postageNote}`,
    `Status porudžbine: ${ctx.statusUrl}`,
  ].join('\n');

  return {
    to: order.email,
    subject: `Porudžbina ${order.number} je primljena ☕`,
    html: shell({
      preheader: `Broj porudžbine ${order.number}: plaćate pouzećem ${formatRsd(order.totalRsd)}. Pošaljite nam broj na Instagramu.`,
      header: 'header-thanks.jpg',
      ctx,
      body,
    }),
    text,
  };
}

/** The owner's new-order notification: same look, everything needed to act. */
export function adminNewOrderEmail(
  order: EmailOrder,
  adminUrl: string,
  to: string,
  ctx: EmailContext,
): MailMessage {
  const body = `<p style="margin:0 0 14px;font-size:16px"><b>Nova porudžbina!</b> Čeka potvrdu: kupac treba da vam pošalje broj na Instagramu.</p>
${orderNumberBlock(order.number, ORDER_STATUSES.NEW.name)}
${order.loyaltyTier ? `<p style="margin:12px 0 0;font-size:14px">Kafe klub: <b>${escapeHtml(order.loyaltyTier)}</b></p>` : ''}
${heading('Kupac')}
${addressBlock(order)}
<p style="margin:8px 0 0;font-size:14px"><a href="mailto:${escapeHtml(order.email)}" style="color:${C.accent}">${escapeHtml(order.email)}</a></p>
${heading('Proizvodi')}
${productsTable(order, 'Kupac plaća pouzećem')}
<div style="margin-top:22px">${button(adminUrl, 'Otvori u administraciji')}</div>`;
  return {
    to,
    replyTo: order.email,
    subject: `🛒 Nova porudžbina ${order.number} — ${formatRsd(order.totalRsd)} (${order.fullName})`,
    html: shell({
      preheader: `${order.fullName}, ${order.city}: ${formatRsd(order.totalRsd)}`,
      header: 'header.jpg',
      ctx,
      body,
    }),
    text: `Nova porudžbina ${order.number}\n${order.fullName}, ${order.address}, ${order.postalCode} ${order.city}, ${order.phone}\n${order.note}\n\n${linesText(order, 'Kupac plaća pouzećem')}\n\n${adminUrl}`,
  };
}

/** Status updates the customer is told about. Other transitions are internal. */
export const NOTIFY_STATUSES: readonly OrderStatus[] = ['CONFIRMED', 'SHIPPED', 'CANCELLED'];

const STATUS_INTRO: Partial<Record<OrderStatus, string>> = {
  CONFIRMED:
    'Vaša porudžbina je potvrđena i ulazi u narednu nabavku iz Velike Britanije. Javićemo vam se kada krene ka vama.',
  SHIPPED: 'Vaš paket je krenuo! Kurir će vas kontaktirati pre isporuke.',
  CANCELLED: 'Vaša porudžbina je otkazana. Ako mislite da je u pitanju greška, pišite nam na Instagramu.',
};

export function statusUpdateEmail(order: EmailOrder, ctx: EmailContext): MailMessage {
  const status = ORDER_STATUSES[order.status];
  const intro = STATUS_INTRO[order.status] ?? status.description;
  const pay =
    order.status === 'SHIPPED'
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;background:${C.ink};border-radius:14px"><tr>
<td style="padding:14px 18px;color:${C.page};font-size:15px;font-weight:700">Kuriru plaćate</td>
<td style="padding:14px 18px;color:${C.page};font-family:${SERIF};font-size:22px;font-weight:700;text-align:right;white-space:nowrap">${formatRsd(order.totalRsd)} + poštarina</td>
</tr></table>`
      : '';
  const summary =
    order.status === 'CANCELLED' ? '' : `${heading('Porudžbina')}${productsTable(order, 'Plaćate pouzećem')}`;
  const body = `<p style="margin:0 0 18px;font-size:16px">Zdravo ${escapeHtml(firstName(order.fullName))},</p>
${orderNumberBlock(order.number, status.name)}
<p style="margin:18px 0 0;font-size:15px">${escapeHtml(intro)}</p>
${pay}
${summary}
<div style="margin-top:22px">${button(ctx.statusUrl, 'Pratite porudžbinu', false)}</div>`;
  return {
    to: order.email,
    subject: `Porudžbina ${order.number}: ${status.name}`,
    html: shell({ preheader: `${status.name}: ${intro}`, header: 'header.jpg', ctx, body }),
    text: `Status porudžbine ${order.number}: ${status.name}. ${intro}\n${ctx.statusUrl}`,
  };
}
