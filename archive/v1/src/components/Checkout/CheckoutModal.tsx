import React, { useState } from 'react';
import { useCart } from '../../context/CartContext';
import { ShippingForm } from './ShippingForm';
import { PaymentSelection } from './PaymentSelection';
import { OrderConfirmation } from './OrderConfirmation';
import type { ShippingInfo, Order } from '../../types';
import './CheckoutModal.scss';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type CheckoutStep = 'shipping' | 'payment' | 'confirmation';

export const CheckoutModal: React.FC<CheckoutModalProps> = ({ isOpen, onClose }) => {
  const { cart, clearCart } = useCart();
  const [step, setStep] = useState<CheckoutStep>('shipping');
  const [shippingInfo, setShippingInfo] = useState<ShippingInfo | null>(null);
  const [order, setOrder] = useState<Order | null>(null);

  if (!isOpen) return null;

  const handleShippingSubmit = (info: ShippingInfo) => {
    setShippingInfo(info);
    setStep('payment');
  };

  const handlePaymentComplete = (completedOrder: Order) => {
    setOrder(completedOrder);
    setStep('confirmation');
    clearCart();
  };

  const handleClose = () => {
    setStep('shipping');
    setShippingInfo(null);
    setOrder(null);
    onClose();
  };

  return (
    <div className="checkout-modal-overlay" onClick={handleClose}>
      <div className="checkout-modal" onClick={(e) => e.stopPropagation()}>
        <button className="checkout-modal__close" onClick={handleClose} aria-label="Zatvori">
          ✕
        </button>

        <div className="checkout-modal__header">
          <h2>Porudžbina</h2>
          <div className="checkout-steps">
            <div className={`step ${step === 'shipping' ? 'active' : 'completed'}`}>
              1. Dostava
            </div>
            <div className={`step ${step === 'payment' ? 'active' : step === 'confirmation' ? 'completed' : ''}`}>
              2. Plaćanje
            </div>
            <div className={`step ${step === 'confirmation' ? 'active' : ''}`}>
              3. Potvrda
            </div>
          </div>
        </div>

        <div className="checkout-modal__content">
          {step === 'shipping' && (
            <ShippingForm cart={cart} onSubmit={handleShippingSubmit} onBack={handleClose} />
          )}

          {step === 'payment' && shippingInfo && (
            <PaymentSelection
              cart={cart}
              shippingInfo={shippingInfo}
              onComplete={handlePaymentComplete}
              onBack={() => setStep('shipping')}
            />
          )}

          {step === 'confirmation' && order && (
            <OrderConfirmation order={order} onClose={handleClose} />
          )}
        </div>
      </div>
    </div>
  );
};
