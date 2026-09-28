/** Response contracts shared by the API and the web app. */
import type { CartIssue, CartQuote } from './cart.js';
import type { CategorySlug, DrinkKind, Product, ProductSummary } from './catalog.js';
import type { LoyaltyStatus } from './loyalty.js';
import type { OrderStatus } from './orders.js';

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    /** Field-level validation messages, keyed by dotted path ("customer.email"). */
    fields?: Record<string, string>;
    /** Present on cart problems so the client can show exactly which lines changed. */
    issues?: CartIssue[];
  };
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export type ProductListResponse = Paginated<ProductSummary>;

export interface ProductDetailResponse {
  product: Product;
  related: ProductSummary[];
}

export interface FacetCount {
  value: string;
  label: string;
  count: number;
}

export interface CatalogMetaResponse {
  categories: (FacetCount & { value: CategorySlug })[];
  systems: FacetCount[];
  brands: FacetCount[];
  kinds: (FacetCount & { value: DrinkKind })[];
  productCount: number;
  lastSyncAt: string | null;
}

export interface ShopConfigResponse {
  ordersOpen: boolean;
  /** Shown while orders are closed. */
  closedMessage: string;
  deliveryEstimate: string;
  postageNote: string;
  /** Where customers send their order number (Instagram profile or DM link), if configured. */
  instagramUrl: string | null;
  /** Whether customers get emails (order confirmation, status updates); the copy must not promise them otherwise. */
  emailEnabled: boolean;
}

export type CartQuoteResponse = CartQuote;

/** What the customer can see about their own order (via its private link). */
export interface OrderView {
  number: string;
  status: OrderStatus;
  statusHistory: { status: OrderStatus; at: string }[];
  createdAt: string;
  customer: {
    fullName: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    postalCode: string;
  };
  lines: {
    sku: string;
    slug: string;
    name: string;
    brand: string;
    image: string | null;
    unitPriceRsd: number;
    quantity: number;
    lineTotalRsd: number;
  }[];
  subtotalRsd: number;
  /** Kafe klub discount applied to this order. */
  discountRsd: number;
  loyaltyTier: string | null;
  /** Paid to the courier on delivery (plus postage). */
  totalRsd: number;
  deliveryEstimate: string;
  postageNote: string;
}

export interface CreateOrderResponse {
  number: string;
  /** Private token for the order status link; knowing the number alone is not enough. */
  accessToken: string;
}

export interface AdminOrderSummary {
  number: string;
  status: OrderStatus;
  createdAt: string;
  customerName: string;
  city: string;
  itemCount: number;
  totalRsd: number;
  loyaltyTier: string | null;
  /** Customer's Instagram username, entered by the owner from the chat. */
  instagramHandle: string | null;
}

export interface AdminOrderDetail extends Omit<OrderView, 'statusHistory'> {
  customerNote: string;
  accessToken: string;
  instagramHandle: string | null;
  events: {
    type: string;
    message: string | null;
    fromStatus: OrderStatus | null;
    toStatus: OrderStatus | null;
    actor: string;
    at: string;
  }[];
  allowedTransitions: OrderStatus[];
  /** Landed cost of the goods at order time (UK price actually paid + transport), RSD. */
  costRsd: number;
  /** totalRsd - costRsd. An estimate: exchange rates move until the goods are bought. */
  profitRsd: number;
}

/** One SKU to buy at KaffeK, summed over all confirmed orders that haven't been ordered yet. */
/**
 * Summed KaffeK product weights of a shipment. The courier bills the real weight, outer carton
 * included, so comparing the two measures the packaging overhead.
 */
export interface ShipmentWeight {
  totalKg: number;
  boxes: number;
  /** Boxes whose weight KaffeK doesn't list, counted at `fallbackKg` each. */
  estimatedBoxes: number;
  fallbackKg: number;
  transportGbpPerKg: number;
  /** Latest stored GBP sell rate, null before the first sync. */
  gbpRsdRate: number | null;
}

export interface ProcurementItem {
  sku: string;
  /** KaffeK's internal product id, used by the "add to KaffeK basket" button. Null = add by hand. */
  kaffekId: number | null;
  name: string;
  brand: string;
  slug: string;
  sourceUrl: string | null;
  quantity: number;
  orders: string[];
  /** Current availability at KaffeK (null if the product left the catalog). */
  inStockAtSource: boolean | null;
  unitCostRsd: number;
}

export interface ProcurementResponse {
  orders: { number: string; customerName: string; createdAt: string; totalRsd: number }[];
  items: ProcurementItem[];
  totalCostRsd: number;
  totalRevenueRsd: number;
  weight: ShipmentWeight;
}

export interface SyncRunView {
  id: string;
  trigger: string;
  status: 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  startedAt: string;
  finishedAt: string | null;
  fetched: number;
  upserted: number;
  retired: number;
  skipped: number;
  complete: boolean;
  gbpRsdRate: number | null;
  error: string | null;
}

export interface HealthResponse {
  ok: boolean;
  database: 'up' | 'down';
  catalog: { activeProducts: number; lastSyncAt: string | null; stale: boolean } | null;
  version: string;
}

/** Kafe klub status for an email (shown at checkout). */
export type LoyaltyResponse = LoyaltyStatus;

export interface AdminDashboard {
  /** Orders per status. */
  counts: Record<OrderStatus, number>;
  ordersToday: number;
  ordersLast7Days: number;
  /** Open orders (not delivered/cancelled): what customers will pay and the estimated profit. */
  openRevenueRsd: number;
  openProfitRsd: number;
  /** Delivered orders in the current calendar month. */
  monthRevenueRsd: number;
  monthProfitRsd: number;
  latest: AdminOrderSummary[];
  lastSyncAt: string | null;
  emailEnabled: boolean;
}

export interface AdminCustomer {
  email: string;
  name: string;
  phone: string;
  city: string;
  orders: number;
  completedOrders: number;
  /** Sum of delivered orders. */
  spentRsd: number;
  lastOrderAt: string;
  tier: string | null;
  instagramHandle: string | null;
}

/** An order that has been bought at KaffeK and is waiting to be sent to the customer. */
export interface ShippingOrder {
  number: string;
  createdAt: string;
  fullName: string;
  phone: string;
  email: string;
  address: string;
  postalCode: string;
  city: string;
  note: string;
  instagramHandle: string | null;
  /** Cash the courier collects for the goods (postage is added by the courier). */
  totalRsd: number;
  itemCount: number;
  lines: { brand: string; name: string; quantity: number }[];
}

export interface ShippingResponse {
  items: ShippingOrder[];
  /** Weight of everything bought at KaffeK and not yet sent on, i.e. the package in transit. */
  weight: ShipmentWeight;
}
