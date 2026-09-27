// Product Types based on coffee-api v2.0
export interface Product {
  id: string;
  sku: string;
  name: string;
  slug: string;
  brand: string;
  system: string;
  description?: string;
  description_sr?: string;

  // Images
  image_url: string;
  images?: string[];

  // Pricing
  price_gbp: number;
  price_rsd: number;
  sale_price_gbp?: number;
  sale_price_rsd?: number;
  price_per_cup_rsd?: number;
  on_sale: boolean;

  // Product details
  pod_count?: number;
  intensity?: string; // Light, Medium, Strong, Very Strong
  coffee_style?: string;
  coffee_blend?: string;
  origin?: string;
  roast?: string;
  tasting_notes?: string[];

  // Dietary & Allergens
  allergens?: string[];
  dietary_info?: string[];

  // Reviews & Ratings
  rating?: number;
  review_count?: number;

  // Availability
  in_stock: boolean;
  stock_level?: string;

  // Metadata
  categories?: string[];
  tags?: string[];
  related_products?: string[];

  // Timestamps
  created_at?: string;
  updated_at?: string;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ApiResponse<T> {
  data: T;
  pagination?: PaginationInfo;
  error?: string;
}

export interface ProductFilters {
  page?: number;
  limit?: number;
  system?: string;
  brand?: string;
  min_price?: number;
  max_price?: number;
  intensity?: string;
  in_stock?: boolean;
  search?: string;
  sort?: 'name' | 'price' | 'rating' | 'popularity';
  order?: 'asc' | 'desc';
  currency?: 'gbp' | 'rsd';
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Cart {
  items: CartItem[];
  total: number;
  itemCount: number;
}

export interface ShippingInfo {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  note?: string;
}

export interface Order {
  id: string;
  items: CartItem[];
  shipping: ShippingInfo;
  subtotal: number;
  reservationFee: number;
  status: 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered';
  paymentMethod: 'ips' | 'paypal' | 'bank-transfer';
  paymentProof?: string;
  createdAt: string;
}

export interface PaymentSlipData {
  recipientName: string;
  recipientAccount: string;
  amount: number;
  currency: string;
  purpose: string;
  referenceNumber: string;
}

export interface OrderEmailData {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  items: string;
  subtotal: number;
  reservationFee: number;
  paymentMethod: string;
  orderDate: string;
}

export type CoffeeSystem =
  | 'dolce-gusto'
  | 'nespresso'
  | 'tassimo'
  | 'senseo'
  | 'a-modo-mio'
  | 'nes-pro'
  | 'yogi-tea'
  | 'syrup';

// System from API
export interface System {
  id: string;
  name: string;
  slug: string;
  description: string;
  product_count: number;
  brand_count: number;
}

export interface SystemsResponse {
  data: System[];
  total: number;
}

// Brand from API
export interface Brand {
  id: string;
  name: string;
  slug: string;
  product_count: number;
  systems: string[];
}

export interface BrandsResponse {
  data: Brand[];
  total: number;
  filters: {
    system: string;
  };
}

// Legacy interface for backwards compatibility
export interface SystemCategory {
  id: string;
  type: string; // Changed from CoffeeSystem to allow dynamic systems
  name: string;
  icon?: string;
}
