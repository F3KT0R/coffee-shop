import QRCode from 'qrcode';
import type { PaymentSlipData, Order, CartItem } from '../types';

const BANK_ACCOUNT = import.meta.env.VITE_BANK_ACCOUNT || '160-XXXXXX-XX';
const RECIPIENT_NAME = import.meta.env.VITE_RECIPIENT_NAME || 'Your Name';
const PAYPAL_ME = import.meta.env.VITE_PAYPAL_ME || 'https://paypal.me/yourusername';

/**
 * Generate unique order number
 */
export const generateOrderNumber = (): string => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `KS-${timestamp}-${random}`;
};

/**
 * Calculate reservation fee (min 1000 RSD or order total, whichever is less)
 */
export const calculateReservationFee = (orderTotal: number): number => {
  return Math.min(1000, orderTotal);
};

/**
 * Generate payment slip data for Serbian banking
 */
export const generatePaymentSlip = (order: Order): PaymentSlipData => {
  return {
    recipientName: RECIPIENT_NAME,
    recipientAccount: BANK_ACCOUNT,
    amount: order.reservationFee,
    currency: 'RSD',
    purpose: `${order.id}`, // Shortened to fit 35 char limit
    referenceNumber: order.id.replace('KS-', ''),
  };
};

/**
 * Generate IPS QR Code for Serbian banking system
 * Universal format compatible with ALL Serbian banks (NBS Standard)
 */
export const generateIPSQRCode = async (slipData: PaymentSlipData): Promise<string> => {
  // IPS QR Code format - Standard Serbian format (works with all banks)
  // Based on utility bill format that all Serbian banks recognize

  // Format amount with comma as decimal separator (Serbian format)
  const amountFormatted = slipData.amount.toFixed(2).replace('.', ',');

  // Clean recipient name - keep spaces and convert \n to actual line breaks
  const cleanRecipientName = slipData.recipientName
    .replace(/\\n/g, '\n') // Convert \n string to actual newline
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .trim()
    .substring(0, 70);

  // Clean purpose
  const cleanPurpose = slipData.purpose
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .substring(0, 35);

  // Build IPS string - standard format with all required fields
  const ipsData = [
    'K:PR',
    'V:01',
    'C:1',
    `R:${slipData.recipientAccount}`,
    `N:${cleanRecipientName}`,
    `I:RSD${amountFormatted}`,
    'SF:221',
    `S:${cleanPurpose}`,
    `RO:${slipData.referenceNumber}`,
  ].join('|');

  try {
    const qrCodeDataUrl = await QRCode.toDataURL(ipsData, {
      width: 300,
      margin: 2,
      errorCorrectionLevel: 'M', // Medium error correction (best balance)
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
    return qrCodeDataUrl;
  } catch (error) {
    console.error('QR generation failed:', error);
    return '';
  }
};

/**
 * Get PayPal.me link with pre-filled amount
 */
export const getPayPalLink = (amount: number): string => {
  // Convert RSD to EUR (approximate rate: 1 EUR ≈ 117 RSD)
  const amountEUR = (amount / 117).toFixed(2);
  return `${PAYPAL_ME}/${amountEUR}EUR`;
};

/**
 * Format cart items as HTML table for email with images
 */
export const formatItemsForEmail = (items: CartItem[]): string => {
  const itemRows = items
    .map(
      (item) => `
    <tr style="border-bottom: 1px solid #e0e0e0;">
      <td style="padding: 15px 10px; vertical-align: middle;">
        <img src="${item.product.image_url}"
             alt="${item.product.name}"
             style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; display: block;" />
      </td>
      <td style="padding: 15px 10px; vertical-align: middle;">
        <div style="font-weight: 600; color: #2c3e50; margin-bottom: 4px;">${item.product.name}</div>
        <div style="font-size: 13px; color: #7f8c8d;">${item.product.brand || ''}</div>
        ${item.product.system ? `<div style="font-size: 12px; color: #95a5a6; margin-top: 2px;">Sistem: ${item.product.system}</div>` : ''}
      </td>
      <td style="padding: 15px 10px; vertical-align: middle; text-align: center; color: #2c3e50; font-weight: 500;">
        ${item.quantity}x
      </td>
      <td style="padding: 15px 10px; vertical-align: middle; text-align: right; color: #2c3e50; font-weight: 600;">
        ${Number(item.product.price_rsd).toFixed(0)} RSD
      </td>
      <td style="padding: 15px 10px; vertical-align: middle; text-align: right; color: #27ae60; font-weight: 700; font-size: 15px;">
        ${(Number(item.product.price_rsd) * item.quantity).toFixed(0)} RSD
      </td>
    </tr>`
    )
    .join('');

  return `
    <table style="width: 100%; border-collapse: collapse; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
      <thead>
        <tr style="background: #34495e; color: #ffffff;">
          <th style="padding: 12px 10px; text-align: left; font-weight: 600; font-size: 13px;">Slika</th>
          <th style="padding: 12px 10px; text-align: left; font-weight: 600; font-size: 13px;">Proizvod</th>
          <th style="padding: 12px 10px; text-align: center; font-weight: 600; font-size: 13px;">Količina</th>
          <th style="padding: 12px 10px; text-align: right; font-weight: 600; font-size: 13px;">Cena</th>
          <th style="padding: 12px 10px; text-align: right; font-weight: 600; font-size: 13px;">Ukupno</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>`;
};
