import React from 'react';
import { useCart } from '../hooks/useCart';
import './Header.scss';

interface HeaderProps {
  onCheckout: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onCheckout }) => {
  const { cart } = useCart();

  return (
    <header className="header">
      <div className="header__container">
        <div className="header__logo">
          <img src="/coffee.png" alt="Logo" className="header__logo-img" />
          <h1>Kafe za Vas</h1>
        </div>

        <nav className="header__nav">
          <button className="header__cart-btn" onClick={onCheckout} aria-label="Korpa">
            <span className="cart-icon">🛒</span>
            {cart.itemCount > 0 && (
              <span className="cart-badge">{cart.itemCount}</span>
            )}
            <span className="cart-text">
              {cart.total.toLocaleString('sr-RS')} RSD
            </span>
          </button>
        </nav>
      </div>
    </header>
  );
};
