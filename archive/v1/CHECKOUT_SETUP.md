# Checkout System Setup Guide

This guide will help you set up the complete checkout system with email notifications and payment processing.

## Features

✅ **Reservation Fee System** - Customers pay minimum 1000 RSD or order total (whichever is less)
✅ **Multiple Payment Methods** - IPS QR Code, PayPal, Bank Transfer
✅ **Email Notifications** - Automatic emails to both admin and customer
✅ **Payment Proof Upload** - Customers can upload screenshots of payment
✅ **Serbian Banking Integration** - IPS QR code generation for Serbian banks
✅ **Order Tracking** - Unique order numbers for each transaction

## Setup Instructions

### 1. Install Dependencies

Dependencies are already installed, but if you need to reinstall:

```bash
npm install
```

### 2. Configure EmailJS (Free)

EmailJS provides free email notifications without needing your own backend.

#### Step 1: Create EmailJS Account
1. Go to [https://www.emailjs.com/](https://www.emailjs.com/)
2. Sign up for free account (300 emails/month free tier)

#### Step 2: Add Email Service
1. Go to **Email Services** tab
2. Click **Add New Service**
3. Choose **Gmail** (recommended)
4. Connect your Gmail account
5. Note your **Service ID**

#### Step 3: Create Email Templates

Create **two templates** in the **Email Templates** section:

**Template 1: Admin Order Notification** (`VITE_EMAILJS_TEMPLATE_ORDER`)

```
Subject: Nova porudžbina - {{order_number}}

Stigla je nova porudžbina!

Broj porudžbine: {{order_number}}
Datum: {{order_date}}

PODACI KUPCA:
Ime: {{customer_name}}
Email: {{customer_email}}
Telefon: {{customer_phone}}

ADRESA ZA DOSTAVU:
{{shipping_address}}

STAVKE:
{{items_list}}

PLAĆANJE:
Ukupno: {{subtotal}} RSD
Rezervacioni depozit: {{reservation_fee}} RSD
Način plaćanja: {{payment_method}}

Proverite uplatu i kontaktirajte kupca kada stigne pošiljka!
```

**Template 2: Customer Order Confirmation** (`VITE_EMAILJS_TEMPLATE_CUSTOMER`)

**IMPORTANT**: Use HTML format for this template to display the product table with images.

```html
Subject: Potvrda porudžbine - {{order_number}}

<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
  <!-- Header -->
  <div style="background: linear-gradient(135deg, #6B4423 0%, #8B5A3C 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="margin: 0; font-size: 24px;">☕ Hvala na porudžbini!</h1>
    <p style="margin: 10px 0 0 0; opacity: 0.9;">Vaša porudžbina je uspešno kreirana</p>
  </div>

  <!-- Content -->
  <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <p style="color: #2c3e50; font-size: 16px; margin-bottom: 10px;">Zdravo <strong>{{customer_name}}</strong>,</p>
    <p style="color: #7f8c8d; margin-bottom: 20px;">Broj porudžbine: <strong style="color: #27ae60;">{{order_number}}</strong></p>

    <!-- Products Table -->
    <h3 style="color: #2c3e50; border-bottom: 2px solid #6B4423; padding-bottom: 10px; margin-bottom: 20px;">📦 Vaša porudžbina</h3>
    {{{items_list}}}

    <!-- Payment Info -->
    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-top: 25px;">
      <h3 style="color: #2c3e50; margin-top: 0;">💳 Plaćanje</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr style="border-bottom: 1px solid #e0e0e0;">
          <td style="padding: 10px 0; color: #7f8c8d;">Ukupna vrednost:</td>
          <td style="padding: 10px 0; text-align: right; font-weight: 600; color: #2c3e50;">{{subtotal}} RSD</td>
        </tr>
        <tr style="border-bottom: 1px solid #e0e0e0;">
          <td style="padding: 10px 0; color: #7f8c8d;">Plaćeni rezervacioni depozit:</td>
          <td style="padding: 10px 0; text-align: right; font-weight: 700; color: #27ae60;">{{reservation_fee}} RSD ✓</td>
        </tr>
        <tr style="border-bottom: 1px dashed #e0e0e0;">
          <td style="padding: 10px 0; color: #7f8c8d;">Za platiti pri preuzimanju:</td>
          <td style="padding: 10px 0; text-align: right; font-weight: 600; color: #2c3e50;">Ostatak + Poštarina</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; color: #7f8c8d;">Način plaćanja:</td>
          <td style="padding: 10px 0; text-align: right; font-weight: 600; color: #2c3e50;">{{payment_method}}</td>
        </tr>
      </table>
      <div style="background: #fff3cd; padding: 12px; border-radius: 6px; margin-top: 15px; border-left: 3px solid #f39c12;">
        <p style="color: #856404; font-size: 13px; margin: 0;"><strong>📦 Napomena o poštarini:</strong> Pri preuzimanju paketa potrebno je platiti i trošak poštarine (Pošta Srbije), koji iznosi približno <strong>500-750 RSD</strong>. Tačan iznos zavisi od težine paketa i trenutnih cena Pošte Srbije.</p>
      </div>
    </div>

    <!-- Delivery Info -->
    <div style="background: #e8f5e9; padding: 20px; border-radius: 8px; margin-top: 20px; border-left: 4px solid #27ae60;">
      <h3 style="color: #27ae60; margin-top: 0;">🚚 Isporuka</h3>
      <p style="color: #2c3e50; margin: 10px 0;"><strong>Očekivano vreme:</strong> {{expected_delivery}}</p>
      <p style="color: #7f8c8d; font-size: 14px; margin: 5px 0;">Kontaktiraćemo vas kada pošiljka stigne u Srbiju.</p>
      <p style="color: #7f8c8d; font-size: 14px; margin: 5px 0;">Ostala suma se plaća pri preuzimanju paketa.</p>
    </div>

    <p style="color: #7f8c8d; font-size: 14px; margin-top: 30px; text-align: center;">Hvala što kupujete kod nas! ☕</p>
  </div>

  <!-- Footer -->
  <div style="text-align: center; padding: 20px; color: #95a5a6; font-size: 12px;">
    <p>Kafe za Vas tim</p>
  </div>
</div>
```

#### Step 4: Get Your Public Key
1. Go to **Account** tab
2. Copy your **Public Key**

### 3. Configure Environment Variables

Create a `.env` file in the project root (copy from `.env.example`):

```bash
cp .env.example .env
```

Edit `.env` and add your credentials:

```env
# EmailJS Configuration
VITE_EMAILJS_PUBLIC_KEY=your_actual_public_key
VITE_EMAILJS_SERVICE_ID=service_xyz123
VITE_EMAILJS_TEMPLATE_ORDER=template_admin_abc
VITE_EMAILJS_TEMPLATE_CUSTOMER=template_customer_def
VITE_ADMIN_EMAIL=your-kafeshop-email@gmail.com

# Payment Configuration
VITE_BANK_ACCOUNT=160-123456-78
VITE_RECIPIENT_NAME=Your Full Name
VITE_PAYPAL_ME=https://paypal.me/yourusername
```

### 4. Set Up PayPal.me (Optional)

1. Go to [https://www.paypal.me](https://www.paypal.me)
2. Create your personalized link (e.g., `paypal.me/yourusername`)
3. Add the link to `.env`

## How It Works

### Customer Journey:

1. **Browse & Add to Cart** - Customer selects products
2. **Click Checkout** - Opens checkout modal
3. **Enter Shipping Info** - Fill out delivery details
4. **Choose Payment Method**:
   - **IPS QR Code** - Scan with banking app
   - **PayPal** - Pay via PayPal.me link
   - **Bank Transfer** - Manual transfer with slip details
5. **Upload Payment Proof** - Screenshot of payment confirmation
6. **Submit Order** - Emails sent to both admin and customer

### Admin Workflow:

1. **Receive Email** - Get order details with customer info
2. **Verify Payment** - Check payment screenshot
3. **Order from Kaffekapslen** - Purchase items
4. **Ship to London** - Receive at your storage unit
5. **Forward to Serbia** - Ship via Serbian Post
6. **Collect Remaining Payment** - Customer pays balance on delivery

## Payment Methods

### IPS QR Code (Serbian Banking)
- Generates QR code compatible with all Serbian banking apps
- Customer scans and confirms payment
- Most convenient for Serbian customers

### PayPal
- Converts RSD to EUR automatically (~117:1 rate)
- International payment option
- Good for diaspora customers

### Bank Transfer
- Traditional payment slip
- Customer transfers manually
- Provides all necessary details

## Reservation Fee Logic

```typescript
reservationFee = Math.min(1000, orderTotal);
```

- Orders ≥ 1000 RSD: Customer pays 1000 RSD deposit
- Orders < 1000 RSD: Customer pays full amount
- Balance paid on delivery (cash on delivery)

## Testing

### Test Without EmailJS:
The system will work without EmailJS configured - it will log order details to console instead of sending emails.

### Test With EmailJS:
1. Configure EmailJS credentials
2. Place a test order
3. Check your admin email
4. Check customer email (use your own email for testing)

## Important Files

```
src/
├── components/
│   └── Checkout/
│       ├── CheckoutModal.tsx       # Main checkout flow
│       ├── ShippingForm.tsx        # Customer info form
│       ├── PaymentSelection.tsx    # Payment method selection
│       ├── OrderConfirmation.tsx   # Success screen
│       └── *.scss                  # Styles
├── services/
│   ├── email.ts                    # EmailJS integration
│   └── payment.ts                  # Payment slip & QR generation
└── types/index.ts                  # TypeScript interfaces

.env                                # Your configuration (DO NOT COMMIT)
.env.example                        # Template for configuration
```

## Security Notes

⚠️ **Important:**
- Never commit `.env` file to git
- `.env.example` is safe to commit (no secrets)
- EmailJS Public Key is safe to expose (it's meant for client-side)
- Don't share your OTP Banka account number publicly

## Customization

### Change Reservation Fee Amount:
Edit `src/services/payment.ts`:
```typescript
export const calculateReservationFee = (orderTotal: number): number => {
  return Math.min(1500, orderTotal); // Change 1000 to your preferred amount
};
```

### Change EUR Exchange Rate:
Edit `src/services/payment.ts`:
```typescript
const amountEUR = (amount / 120).toFixed(2); // Change 117 to current rate
```

### Modify Email Templates:
Edit templates in EmailJS dashboard - changes take effect immediately.

## Troubleshooting

### Emails Not Sending?
- Check EmailJS credentials in `.env`
- Verify service is active in EmailJS dashboard
- Check browser console for errors
- Ensure you haven't exceeded free tier limit (300/month)

### QR Code Not Working?
- Verify bank account format: `160-XXXXXX-XX`
- Ensure recipient name matches bank account
- Test with your own banking app

### PayPal Link Not Working?
- Verify PayPal.me link is active
- Check exchange rate calculation
- Ensure link format: `https://paypal.me/username`

## Support

If you encounter issues:
1. Check browser console for errors
2. Verify all `.env` variables are set
3. Test each payment method individually
4. Review EmailJS dashboard for failed sends

## Next Steps

1. ✅ Complete EmailJS setup
2. ✅ Test with a real order
3. ✅ Customize email templates
4. ✅ Add your bank details
5. ✅ Set up PayPal.me link
6. 🚀 Launch and start taking orders!

---

**Need help?** The system is designed to be self-contained and work without any external backend. Perfect for your manual fulfillment process!
