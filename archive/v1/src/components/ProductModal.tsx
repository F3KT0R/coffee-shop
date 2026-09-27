import React, { useEffect } from 'react';
import { Product } from '../types';
import { useCart } from '../hooks/useCart';
import './ProductModal.scss';

interface ProductModalProps {
  product: Product;
  onClose: () => void;
}

export const ProductModal: React.FC<ProductModalProps> = ({ product, onClose }) => {
  const { addToCart, isInCart, updateQuantity, getCartItem } = useCart();

  useEffect(() => {
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('sr-RS', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const getPricePerCup = (): string | null => {
    if (product.pod_count && product.pod_count > 0) {
      const pricePerCup = product.price_rsd / product.pod_count;
      return formatPrice(pricePerCup);
    }
    return null;
  };

  const handleAddToCart = () => {
    addToCart(product, 1);
  };

  const handleQuantityChange = (newQuantity: number) => {
    if (newQuantity > 0) {
      updateQuantity(product.id, newQuantity);
    }
  };

  const cartItem = getCartItem(product.id);
  const currentQuantity = cartItem?.quantity || 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="product-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Zatvori">
          ✕
        </button>

        <div className="product-modal__content">
          <div className="product-modal__image-section">
            {product.on_sale && (
              <div className="product-modal__badge sale-badge">AKCIJA</div>
            )}
            {!product.in_stock && (
              <div className="product-modal__badge stock-badge">Nema na stanju</div>
            )}
            <div className="product-modal__image-wrapper">
              <img
                src={product.image_url}
                alt={product.name}
                className="product-modal__image"
              />
            </div>
            {product.images && product.images.length > 1 && (
              <div className="product-modal__thumbnails">
                {product.images.slice(0, 4).map((img, idx) => (
                  <img key={idx} src={img} alt={`${product.name} ${idx + 1}`} />
                ))}
              </div>
            )}
          </div>

          <div className="product-modal__details">
            <div className="product-modal__header">
              <span className="product-modal__brand">{product.brand}</span>
              {product.rating && (
                <div className="product-modal__rating">
                  <span className="star">★</span>
                  <span>{product.rating.toFixed(1)}</span>
                  {product.review_count && (
                    <span className="review-count">({product.review_count} recenzija)</span>
                  )}
                </div>
              )}
            </div>

            <h2 className="product-modal__name">{product.name}</h2>

            <div className="product-modal__badges">
              <span className="badge system">{product.system}</span>
              {product.intensity && (
                <span className="badge intensity">{product.intensity}</span>
              )}
              {product.pod_count && (
                <span className="badge pods">{product.pod_count} kapsula</span>
              )}
            </div>

            {(product.description_sr || product.description) && (
              <div className="product-modal__description">
                <h3>Opis proizvoda</h3>
                <p>{product.description_sr || product.description}</p>
              </div>
            )}

            {product.tasting_notes && product.tasting_notes.length > 0 && (
              <div className="product-modal__tasting-notes">
                <h3>Note ukusa</h3>
                <div className="notes">
                  {product.tasting_notes.map((note, idx) => (
                    <span key={idx} className="note">{note}</span>
                  ))}
                </div>
              </div>
            )}

            {product.coffee_style && (
              <div className="product-modal__info-row">
                <span className="label">Stil kafe:</span>
                <span className="value">{product.coffee_style}</span>
              </div>
            )}

            {product.origin && (
              <div className="product-modal__info-row">
                <span className="label">Poreklo:</span>
                <span className="value">{product.origin}</span>
              </div>
            )}

            <div className="product-modal__footer">
              <div className="product-modal__pricing">
                {product.on_sale && product.sale_price_rsd ? (
                  <>
                    <span className="price original">{formatPrice(product.price_rsd)} RSD</span>
                    <span className="price sale">{formatPrice(product.sale_price_rsd)} RSD</span>
                  </>
                ) : (
                  <span className="price">{formatPrice(product.price_rsd)} RSD</span>
                )}
                {getPricePerCup() && (
                  <span className="price-per-cup">{getPricePerCup()} RSD/kapsula</span>
                )}
              </div>

              <div className="product-modal__actions">
                {isInCart(product.id) ? (
                  <div className="quantity-control">
                    <button
                      onClick={() => handleQuantityChange(currentQuantity - 1)}
                      aria-label="Smanji količinu"
                    >
                      −
                    </button>
                    <span className="quantity">{currentQuantity}</span>
                    <button
                      onClick={() => handleQuantityChange(currentQuantity + 1)}
                      aria-label="Povećaj količinu"
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <button
                    className="add-to-cart-btn"
                    onClick={handleAddToCart}
                    disabled={!product.in_stock}
                  >
                    {product.in_stock ? '+ Dodaj u korpu' : 'Nema na stanju'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
