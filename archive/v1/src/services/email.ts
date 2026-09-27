import emailjs from '@emailjs/browser';
import type { OrderEmailData } from '../types';

// Initialize EmailJS with your public key
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || '';
const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID || '';
const EMAILJS_TEMPLATE_ORDER = import.meta.env.VITE_EMAILJS_TEMPLATE_ORDER || '';
const EMAILJS_TEMPLATE_CUSTOMER = import.meta.env.VITE_EMAILJS_TEMPLATE_CUSTOMER || '';
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || '';

// Initialize EmailJS
if (EMAILJS_PUBLIC_KEY) {
  emailjs.init(EMAILJS_PUBLIC_KEY);
}

/**
 * Send order notification emails to both admin and customer
 */
export const sendOrderNotification = async (data: OrderEmailData): Promise<boolean> => {
  // Check if EmailJS is configured
  if (!EMAILJS_PUBLIC_KEY || !EMAILJS_SERVICE_ID) {
    console.warn('EmailJS not configured. Skipping email notifications.');
    console.log('Order details:', data);
    return true; // Return true to allow testing without EmailJS
  }

  try {
    // Send to admin
    if (EMAILJS_TEMPLATE_ORDER && ADMIN_EMAIL) {
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ORDER,
        {
          to_email: ADMIN_EMAIL,
          order_number: data.orderNumber,
          customer_name: data.customerName,
          customer_email: data.customerEmail,
          customer_phone: data.customerPhone,
          shipping_address: data.shippingAddress,
          items_list: data.items,
          subtotal: data.subtotal,
          reservation_fee: data.reservationFee,
          payment_method: data.paymentMethod,
          order_date: data.orderDate,
        }
      );
    }

    // Send to customer
    if (EMAILJS_TEMPLATE_CUSTOMER) {
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_CUSTOMER,
        {
          to_email: data.customerEmail,
          customer_name: data.customerName,
          order_number: data.orderNumber,
          items_list: data.items,
          subtotal: data.subtotal,
          reservation_fee: data.reservationFee,
          payment_method: data.paymentMethod,
          expected_delivery: '5-6 nedelja',
        }
      );
    }

    return true;
  } catch (error) {
    console.error('Email sending failed:', error);
    return false;
  }
};
