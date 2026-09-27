import React, { useState } from 'react';
import type { ShippingInfo, Cart } from '../../types';
import './ShippingForm.scss';

interface ShippingFormProps {
  cart: Cart;
  onSubmit: (info: ShippingInfo) => void;
  onBack: () => void;
}

export const ShippingForm: React.FC<ShippingFormProps> = ({ cart, onSubmit, onBack }) => {
  const [formData, setFormData] = useState<ShippingInfo>({
    fullName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    postalCode: '',
    note: '',
  });

  const [errors, setErrors] = useState<Partial<ShippingInfo>>({});

  const validate = (): boolean => {
    const newErrors: Partial<ShippingInfo> = {};

    if (!formData.fullName.trim()) newErrors.fullName = 'Ime i prezime je obavezno';
    if (!formData.email.trim()) newErrors.email = 'Email je obavezan';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      newErrors.email = 'Unesite validan email';
    if (!formData.phone.trim()) newErrors.phone = 'Telefon je obavezan';
    if (!formData.address.trim()) newErrors.address = 'Adresa je obavezna';
    if (!formData.city.trim()) newErrors.city = 'Grad je obavezan';
    if (!formData.postalCode.trim()) newErrors.postalCode = 'Poštanski broj je obavezan';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(formData);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof ShippingInfo]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  return (
    <form className="shipping-form" onSubmit={handleSubmit}>
      <div className="shipping-form__summary">
        <h3>Vaša korpa</h3>
        <div className="cart-items">
          {cart.items.map((item) => (
            <div key={item.product.id} className="cart-item">
              <span>
                {item.product.name} ({item.product.brand})
              </span>
              <span>
                {item.quantity}x × {Number(item.product.price_rsd).toFixed(0)} RSD
              </span>
            </div>
          ))}
        </div>
        <div className="cart-total">
          <strong>Ukupno:</strong>
          <strong>{Number(cart.total).toFixed(0)} RSD</strong>
        </div>
        <div className="postage-info">
          <small>+ Poštarina pri preuzimanju: ~500-750 RSD (Pošta Srbije)</small>
        </div>
      </div>

      <div className="shipping-form__fields">
        <h3>Podaci za dostavu</h3>

        <div className="form-group">
          <label htmlFor="fullName">Ime i prezime *</label>
          <input
            type="text"
            id="fullName"
            name="fullName"
            value={formData.fullName}
            onChange={handleChange}
            className={errors.fullName ? 'error' : ''}
          />
          {errors.fullName && <span className="error-message">{errors.fullName}</span>}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="email">Email *</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={errors.email ? 'error' : ''}
            />
            {errors.email && <span className="error-message">{errors.email}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="phone">Telefon *</label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="+381..."
              className={errors.phone ? 'error' : ''}
            />
            {errors.phone && <span className="error-message">{errors.phone}</span>}
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="address">Adresa *</label>
          <input
            type="text"
            id="address"
            name="address"
            value={formData.address}
            onChange={handleChange}
            className={errors.address ? 'error' : ''}
          />
          {errors.address && <span className="error-message">{errors.address}</span>}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="city">Grad *</label>
            <input
              type="text"
              id="city"
              name="city"
              value={formData.city}
              onChange={handleChange}
              className={errors.city ? 'error' : ''}
            />
            {errors.city && <span className="error-message">{errors.city}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="postalCode">Poštanski broj *</label>
            <input
              type="text"
              id="postalCode"
              name="postalCode"
              value={formData.postalCode}
              onChange={handleChange}
              className={errors.postalCode ? 'error' : ''}
            />
            {errors.postalCode && <span className="error-message">{errors.postalCode}</span>}
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="note">Napomena (opciono)</label>
          <textarea
            id="note"
            name="note"
            value={formData.note}
            onChange={handleChange}
            rows={3}
            placeholder="Posebne instrukcije za dostavu..."
          />
        </div>
      </div>

      <div className="shipping-form__actions">
        <button type="button" onClick={onBack} className="btn btn-secondary">
          Nazad
        </button>
        <button type="submit" className="btn btn-primary">
          Nastavi na plaćanje
        </button>
      </div>
    </form>
  );
};
