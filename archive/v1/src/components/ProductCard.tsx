import React from 'react';
import { Product } from '../types';
import { useCart } from '../hooks/useCart';
import './ProductCard.scss';

interface ProductCardProps {
  product: Product;
  onClick?: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onClick }) => {
  const { addToCart, updateQuantity, getCartItem, isInCart } = useCart();
  const cartItem = getCartItem(product.id);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToCart(product, 1);
  };

  const handleIncrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (cartItem) {
      updateQuantity(product.id, cartItem.quantity + 1);
    } else {
      addToCart(product, 1);
    }
  };

  const handleDecrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (cartItem) {
      if (cartItem.quantity > 1) {
        updateQuantity(product.id, cartItem.quantity - 1);
      } else {
        updateQuantity(product.id, 0);
      }
    }
  };

  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('sr-RS', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  return (
    <article
      className={`product-card ${!product.in_stock ? 'out-of-stock' : ''}`}
      onClick={() => onClick?.(product)}
    >
      {product.on_sale && (
        <div className="product-card__badge sale-badge">AKCIJA</div>
      )}
      {!product.in_stock && (
        <div className="product-card__badge stock-badge">Nema na stanju</div>
      )}

      <div className="product-card__image-wrapper">
        <img
          src={product.image_url}
          alt={product.name}
          className="product-card__image"
          loading="lazy"
        />
      </div>

      <div className="product-card__content">
        {product.system && (
          <p className="product-card__system">{product.system.replace('-', ' ')}</p>
        )}

        <h3 className="product-card__name">{product.name}</h3>

        {product.pod_count && product.pod_count > 0 && (
          <p className="product-card__subtitle">{product.pod_count} kapsula</p>
        )}

        <div className="product-card__footer">
          <div className="product-card__pricing">
            {product.on_sale && product.sale_price_rsd ? (
              <>
                <span className="price sale">{formatPrice(product.sale_price_rsd)} RSD</span>
                <span className="price original">{formatPrice(product.price_rsd)} RSD</span>
              </>
            ) : (
              <span className="price">{formatPrice(product.price_rsd)} RSD</span>
            )}
          </div>

          {!product.in_stock ? (
            <button
              className="product-card__cart-btn disabled"
              disabled
            >
              Nema na stanju
            </button>
          ) : isInCart(product.id) && cartItem ? (
            <div className="product-card__quantity-controls">
              <button
                className="quantity-btn decrement"
                onClick={handleDecrement}
                aria-label="Smanji količinu"
              >
                −
              </button>
              <span className="quantity-display">{cartItem.quantity}</span>
              <button
                className="quantity-btn increment"
                onClick={handleIncrement}
                aria-label="Povećaj količinu"
              >
                +
              </button>
            </div>
          ) : (
            <button
              className="product-card__cart-btn"
              onClick={handleAddToCart}
            >
              + Dodaj
            </button>
          )}
        </div>
      </div>
    </article>
  );
};
