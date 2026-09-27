import React from 'react';
import type { Order } from '../../types';
import './OrderConfirmation.scss';

interface OrderConfirmationProps {
  order: Order;
  onClose: () => void;
}

export const OrderConfirmation: React.FC<OrderConfirmationProps> = ({ order, onClose }) => {
  return (
    <div className="order-confirmation">
      <div className="success-icon">✅</div>
      <h2>Porudžbina uspešno kreirana!</h2>
      <p className="order-number">
        Broj porudžbine: <strong>{order.id}</strong>
      </p>

      <div className="confirmation-message">
        <p>Hvala vam na porudžbini!</p>
        <p>
          Poslali smo vam email sa detaljima porudžbine na adresu{' '}
          <strong>{order.shipping.email}</strong>
        </p>
        <p className="delivery-info">
          📦 Očekivano vreme isporuke: <strong>5-6 nedelja</strong>
        </p>
        <p className="delivery-info">
          🚚 Pošiljka će biti dostavljena putem Pošte Srbije na adresu:
          <br />
          <strong>
            {order.shipping.address}, {order.shipping.city} {order.shipping.postalCode}
          </strong>
        </p>
      </div>

      <div className="order-summary">
        <h3>Pregled porudžbine</h3>
        {order.items.map((item) => (
          <div key={item.product.id} className="order-item">
            <span>
              {item.product.name} × {item.quantity}
            </span>
            <span>{(Number(item.product.price_rsd) * item.quantity).toFixed(0)} RSD</span>
          </div>
        ))}
        <div className="order-total">
          <span>
            <strong>Ukupno:</strong>
          </span>
          <span>
            <strong>{Number(order.subtotal).toFixed(0)} RSD</strong>
          </span>
        </div>
        <div className="reservation-fee">
          <span>Plaćeni rezervacioni depozit:</span>
          <span className="paid">{Number(order.reservationFee).toFixed(0)} RSD ✓</span>
        </div>
        <div className="remaining-payment">
          <span>Za platiti pri preuzimanju:</span>
          <span>{(Number(order.subtotal) - Number(order.reservationFee)).toFixed(0)} RSD</span>
        </div>
        <div className="postage-fee">
          <span>+ Poštarina (Pošta Srbije):</span>
          <span className="estimate">~500-750 RSD *</span>
        </div>
        <div className="postage-note">
          <small>* Tačan iznos poštarine zavisi od težine paketa, ukupne otkupnine i trenutnih cena Pošte Srbije</small>
        </div>
      </div>

      <div className="next-steps">
        <h4>Šta dalje?</h4>
        <ol>
          <li>Proverićemo uplatu rezervacionog depozita</li>
          <li>Šaljemo porudžbinu iz magacina za Srbiju</li>
          <li>Kada pošiljka stigne u Srbiju, kontaktiraćemo vas</li>
          <li>Pošiljka će biti poslata putem Pošte Srbije</li>
          <li>Ostatak + poštarinu plaćate pri preuzimanju (500-750 RSD poštarina)</li>
        </ol>
      </div>

      <button onClick={onClose} className="btn btn-primary btn-large">
        Zatvori
      </button>
    </div>
  );
};
