# ☕ Kafe za Vas - Modern Coffee Capsule Shop

A production-ready, mobile-first e-commerce frontend for coffee capsules, built for the Serbian market. Connects to the [Coffee API v2.0](https://kafeshop-api.netlify.app) backend for real-time product data.

## 🚀 Features

### ✨ **Modern & User-Friendly**

- **Mobile-First Design** - Optimized for all screen sizes
- **Fast & Responsive** - Instant loading with smart caching
- **Dark Theme** - Beautiful, modern UI with coffee-inspired colors
- **Shopping Cart** - Full cart management with localStorage persistence
- **Advanced Filtering** - Filter by system, brand, search, and more
- **Real-Time Data** - Connected to Coffee API v2.0 with 40+ data fields per product
- **Product Details** - Complete product information including ratings, reviews, allergens

### 🛠️ **Tech Stack**

- **React 18** - Modern hooks and functional components
- **TypeScript** - Full type safety
- **Sass/SCSS** - Advanced styling with CSS variables
- **Vite** - Lightning-fast build tool
- **Context API** - Clean state management
- **LocalStorage** - Persistent cart data

### 📦 **Product Data**

Each product displays:
- High-quality images
- Brand and product name
- Pricing in RSD with per-capsule calculation
- Pod count and intensity level
- Star ratings and review counts
- Stock availability status
- Sale/discount badges

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│  React Frontend (Vite)                      │
│  • TypeScript                               │
│  • Context API (Cart)                       │
│  • SCSS Modules                             │
│  • Mobile-First Design                      │
└──────────────────┬──────────────────────────┘
                   │
                   ▼ REST API
┌─────────────────────────────────────────────┐
│  Coffee API v2.0                            │
│  https://kafeshop-api.netlify.app/api       │
│  • Database-backed                          │
│  • Daily auto-sync                          │
│  • GBP → RSD conversion                     │
│  • Advanced filtering                       │
└─────────────────────────────────────────────┘
```

## 📦 Installation

### 1. Clone and Install

```bash
git clone <repository-url>
cd coffee-shop
npm install
```

### 2. Configure Environment

Create a `.env` file (or copy from `.env.example`):

```env
VITE_API_BASE_URL=https://kafeshop-api.netlify.app/api
```

### 3. Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### 4. Build for Production

```bash
npm run build
```

The optimized build will be in the `dist/` folder.

## 🎨 Features Overview

### 🏠 Home Page

- **Header** - Logo, cart badge with item count and total
- **Filter Bar** - Search input and system category buttons
- **Product Grid** - Responsive grid layout (4 columns on desktop, 2 on mobile)
- **Load More** - Pagination with "Load More" button
- **Footer** - Copyright and branding

### 🛍️ Product Cards

Each product card shows:
- Product image with hover effects
- Brand name
- Product name (2-line truncation)
- Rating with star and review count
- Intensity badge
- Pod count badge
- Price in RSD
- Price per capsule
- Add to cart button (changes to "✓ In Cart" when added)
- Sale badge for discounted items
- Out of stock badge when unavailable

### 🛒 Shopping Cart

- Persistent cart using localStorage
- Add/remove products
- Update quantities
- Real-time total calculation
- Cart badge shows item count and total in header

### 🔍 Search & Filters

- **Search** - Real-time search across all products
- **System Filters** - Dolce Gusto, Nespresso, Tassimo, Lavazza, Senseo, etc.
- **Combined Filtering** - Search + system filter work together

### 📱 Mobile Optimizations

- Touch-friendly buttons and cards
- Responsive grid (2 columns on mobile)
- Sticky header and filter bar
- Optimized font sizes
- Simplified cart display on mobile
- Gesture-friendly scrolling

## 🎯 Component Structure

```
src/
├── components/
│   ├── Header.tsx           # Top navigation with cart
│   ├── Header.scss
│   ├── FilterBar.tsx        # Search + system filters
│   ├── FilterBar.scss
│   ├── ProductCard.tsx      # Individual product display
│   ├── ProductCard.scss
│   ├── LoadingSkeleton.tsx  # Loading state UI
│   └── LoadingSkeleton.scss
├── context/
│   └── CartContext.tsx      # Cart state management
├── hooks/
│   └── useCart.ts          # Cart hook
├── services/
│   └── api.ts              # API service layer
├── types/
│   └── index.ts            # TypeScript definitions
├── constants/
│   └── systems.ts          # Pod system categories
├── styles/
│   └── globals.scss        # Global styles & CSS variables
├── App.tsx                 # Main app component
├── App.scss
└── main.tsx               # App entry point
```

## 🔧 API Integration

The app uses a service layer (`services/api.ts`) to communicate with the Coffee API:

```typescript
// Example: Get products with filters
const response = await apiService.getProducts({
  system: 'dolce-gusto',
  search: 'cappuccino',
  page: 1,
  limit: 20,
  currency: 'rsd',
  in_stock: true
});
```

### Available API Methods

- `getProducts(filters)` - Get paginated products
- `getProduct(id)` - Get single product details
- `searchProducts(query)` - Search products
- `getBrands()` - Get all brands
- `getSystems()` - Get all systems
- `getFeaturedProducts()` - Get popular products
- `getSaleProducts()` - Get products on sale

## 🎨 Styling

### CSS Variables (Theme)

The app uses CSS custom properties for easy theming:

```scss
:root {
  --bg-primary: #0f0f0f;        // Main background
  --bg-secondary: #1a1a1a;      // Secondary background
  --card-bg: #222222;            // Card background
  --text-primary: #f5f5f5;       // Main text
  --text-secondary: #a0a0a0;     // Secondary text
  --accent-color: #d4a574;       // Coffee/gold accent
  --accent-hover: #c4956a;       // Hover state
  --success-color: #4caf50;      // Success (in cart)
  --error-color: #f44336;        // Error/out of stock
  --border-color: #333333;       // Borders
}
```

### Responsive Breakpoints

- **Desktop**: 1400px max-width container
- **Tablet**: < 768px
- **Mobile**: < 480px

## 🚀 Deployment

### Deploy to Netlify

1. Connect your GitHub repository to Netlify
2. Configure build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
3. Add environment variables in Netlify dashboard
4. Deploy!

### Deploy to Vercel

```bash
npm install -g vercel
vercel
```

## 📊 Performance Optimizations

- **Lazy Loading** - Images load on demand
- **Code Splitting** - Vite automatically splits bundles
- **Debounced Search** - Prevents excessive API calls
- **Memoization** - useCallback for expensive operations
- **Skeleton Screens** - Loading states for better UX
- **LocalStorage Cache** - Cart persists across sessions

## 🔐 Security

- Environment variables for sensitive config
- HTTPS-only API communication
- No sensitive data in localStorage
- XSS protection with React's built-in escaping

## 🐛 Error Handling

- Loading states for all async operations
- Error boundaries for graceful failures
- User-friendly error messages
- Retry buttons for failed requests
- Empty states when no results found

## 📝 Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

## 🤝 Contributing

This project connects to the Coffee API backend. For backend changes, see the Coffee API repository.

## 📄 License

ISC

---

**Built with ❤️ for coffee lovers in Serbia** ☕
