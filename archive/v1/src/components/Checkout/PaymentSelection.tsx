import React, { useState, useEffect } from 'react';
import type { ShippingInfo, Cart, Order } from '../../types';
import {
  generateOrderNumber,
  calculateReservationFee,
  generatePaymentSlip,
  generateIPSQRCode,
  getPayPalLink,
  formatItemsForEmail,
} from '../../services/payment';
import { sendOrderNotification } from '../../services/email';
import './PaymentSelection.scss';

interface PaymentSelectionProps {
  cart: Cart;
  shippingInfo: ShippingInfo;
  onComplete: (order: Order) => void;
  onBack: () => void;
}

export const PaymentSelection: React.FC<PaymentSelectionProps> = ({
  cart,
  shippingInfo,
  onComplete,
  onBack,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<'ips' | 'paypal' | 'bank-transfer'>('ips');
  const [qrCode, setQrCode] = useState<string>('');
  const [paymentProof, setPaymentProof] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reservationFee = calculateReservationFee(cart.total);
  const orderNumber = generateOrderNumber();

  const order: Order = {
    id: orderNumber,
    items: cart.items,
    shipping: shippingInfo,
    subtotal: cart.total,
    reservationFee,
    status: 'pending',
    paymentMethod,
    createdAt: new Date().toISOString(),
  };

  const paymentSlip = generatePaymentSlip(order);

  useEffect(() => {
    if (paymentMethod === 'ips') {
      generateIPSQRCode(paymentSlip).then(setQrCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentMethod]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPaymentProof(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!paymentProof && paymentMethod !== 'bank-transfer') {
      alert('Molimo priložite dokaz o plaćanju');
      return;
    }

    setIsSubmitting(true);

    const orderWithProof: Order = {
      ...order,
      paymentProof,
    };

    const itemsHTML = formatItemsForEmail(cart.items);
    const shippingAddress = `${shippingInfo.address}, ${shippingInfo.city} ${shippingInfo.postalCode}`;

    const emailSent = await sendOrderNotification({
      orderNumber,
      customerName: shippingInfo.fullName,
      customerEmail: shippingInfo.email,
      customerPhone: shippingInfo.phone,
      shippingAddress,
      items: itemsHTML,
      subtotal: cart.total,
      reservationFee,
      paymentMethod:
        paymentMethod === 'ips' ? 'IPS QR' : paymentMethod === 'paypal' ? 'PayPal' : 'Bankovna transakcija',
      orderDate: new Date().toLocaleDateString('sr-RS'),
    });

    setIsSubmitting(false);

    if (emailSent) {
      onComplete(orderWithProof);
    } else {
      alert('Greška pri slanju email-a. Molimo pokušajte ponovo.');
    }
  };

  return (
    <div className="payment-selection">
      <div className="payment-info">
        <h3>Informacije o plaćanju</h3>
        <div className="info-box">
          <p>
            <strong>Broj porudžbine:</strong> {orderNumber}
          </p>
          <p>
            <strong>Ukupna vrednost:</strong> {Number(cart.total).toFixed(0)} RSD
          </p>
          <p>
            <strong>Rezervacioni depozit:</strong> {Number(reservationFee).toFixed(0)} RSD
          </p>
          <div className="info-note">
            💡 Plaćate samo rezervacioni depozit od {Number(reservationFee).toFixed(0)} RSD. Ostatak ćete
            platiti kada stigne pošiljka (5-6 nedelja).
          </div>
          <div className="postage-note">
            📦 <strong>Napomena:</strong> Pri preuzimanju paketa potrebno je platiti i trošak poštarine (~500-750 RSD).
          </div>
        </div>
      </div>

      <div className="payment-methods">
        <h3>Izaberite način plaćanja</h3>

        <div className="payment-method-tabs">
          <button
            className={`tab ${paymentMethod === 'ips' ? 'active' : ''}`}
            onClick={() => setPaymentMethod('ips')}
          >
            📱 IPS QR Kod
          </button>
          <button
            className={`tab ${paymentMethod === 'paypal' ? 'active' : ''}`}
            onClick={() => setPaymentMethod('paypal')}
          >
            💳 PayPal
          </button>
          <button
            className={`tab ${paymentMethod === 'bank-transfer' ? 'active' : ''}`}
            onClick={() => setPaymentMethod('bank-transfer')}
          >
            🏦 Bankovna transakcija
          </button>
        </div>

        {paymentMethod === 'ips' && (
          <div className="payment-content">
            <h4>Skenirajte QR kod u vašoj banking aplikaciji</h4>
            {qrCode && <img src={qrCode} alt="IPS QR Code" className="qr-code" />}
            <div className="payment-details">
              <p>
                <strong>Primalac:</strong> {paymentSlip.recipientName}
              </p>
              <p>
                <strong>Račun:</strong> {paymentSlip.recipientAccount}
              </p>
              <p>
                <strong>Iznos:</strong> {paymentSlip.amount} RSD
              </p>
              <p>
                <strong>Svrha:</strong> {paymentSlip.purpose}
              </p>
            </div>
            <div className="upload-proof">
              <label htmlFor="payment-proof">Priložite screenshot uplate nakon plaćanja:</label>
              <input
                type="file"
                id="payment-proof"
                accept="image/*"
                onChange={handleFileUpload}
              />
              {paymentProof && (
                <img src={paymentProof} alt="Payment proof" className="proof-preview" />
              )}
            </div>
          </div>
        )}

        {paymentMethod === 'paypal' && (
          <div className="payment-content">
            <h4>Platite putem PayPal-a</h4>
            <div className="paypal-instructions">
              <p>1. Kliknite na dugme ispod da otvorite PayPal</p>
              <p>
                2. Unesite iznos: <strong>{(reservationFee / 117).toFixed(2)} EUR</strong>
              </p>
              <p>
                3. U napomenu dodajte: <strong>{orderNumber}</strong>
              </p>
              <a
                href={getPayPalLink(reservationFee)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-paypal"
              >
                Otvori PayPal
              </a>
            </div>
            <div className="upload-proof">
              <label htmlFor="payment-proof">Priložite screenshot potvrde nakon plaćanja:</label>
              <input
                type="file"
                id="payment-proof"
                accept="image/*"
                onChange={handleFileUpload}
              />
              {paymentProof && (
                <img src={paymentProof} alt="Payment proof" className="proof-preview" />
              )}
            </div>
          </div>
        )}

        {paymentMethod === 'bank-transfer' && (
          <div className="payment-content">
            <h4>Podaci za bankovnu transakciju</h4>
            <div className="payment-details">
              <p>
                <strong>Primalac:</strong> {paymentSlip.recipientName}
              </p>
              <p>
                <strong>Broj računa:</strong> {paymentSlip.recipientAccount}
              </p>
              <p>
                <strong>Iznos:</strong> {paymentSlip.amount} RSD
              </p>
              <p>
                <strong>Svrha uplate:</strong> {paymentSlip.purpose}
              </p>
              <p>
                <strong>Poziv na broj:</strong> {paymentSlip.referenceNumber}
              </p>
            </div>
            <div className="info-note">
              ⚠️ Nakon izvršenja uplate, poslaćemo vam email sa potvrdom. Molimo sačuvajte broj
              porudžbine: <strong>{orderNumber}</strong>
            </div>
          </div>
        )}
      </div>

      <div className="payment-actions">
        <button onClick={onBack} className="btn btn-secondary" disabled={isSubmitting}>
          Nazad
        </button>
        <button
          onClick={handleSubmit}
          className="btn btn-primary"
          disabled={isSubmitting || (!paymentProof && paymentMethod !== 'bank-transfer')}
        >
          {isSubmitting ? 'Šaljem...' : 'Potvrdi porudžbinu'}
        </button>
      </div>
    </div>
  );
};
