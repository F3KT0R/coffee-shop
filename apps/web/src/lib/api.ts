import type {
  AdminCustomer,
  AdminDashboard,
  LoyaltyResponse,
  AdminOrderDetail,
  AdminOrderSummary,
  ApiErrorBody,
  CartIssue,
  CartLineInput,
  CartQuoteResponse,
  CatalogMetaResponse,
  CheckoutInput,
  CreateOrderResponse,
  OrderStatus,
  OrderView,
  Paginated,
  ProcurementResponse,
  ShippingResponse,
  ProductDetailResponse,
  ProductListResponse,
  ShopConfigResponse,
  SyncRunView,
} from '@kafeshop/core';

/** Error with the server's code and (Serbian) message; `status` 0 means the request never got an answer. */
export class ApiError extends Error {
  override name = 'ApiError';
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields: Record<string, string> = {},
    readonly issues: CartIssue[] = [],
  ) {
    super(message);
  }

  /** Worth retrying automatically: network failure, timeout, or the server (re)starting. */
  get transient(): boolean {
    return this.status === 0 || this.status === 502 || this.status === 503 || this.status === 504;
  }
}

// The free-tier API sleeps when idle and needs up to ~50 s to wake up; don't give up before that.
const TIMEOUT_MS = 60_000;

async function request<T>(
  path: string,
  init: { method?: string; body?: unknown; signal?: AbortSignal; headers?: Record<string, string> } = {},
): Promise<T> {
  const signals = [AbortSignal.timeout(TIMEOUT_MS), ...(init.signal ? [init.signal] : [])];
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: init.method ?? 'GET',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.any(signals),
    });
  } catch (error) {
    if (init.signal?.aborted) throw error;
    throw new ApiError(
      0,
      'NETWORK',
      'Nema veze sa serverom. Proverite internet konekciju i pokušajte ponovo.',
    );
  }

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const body = isJson ? ((await response.json()) as unknown) : null;
  if (response.ok) return body as T;

  const error = (body as ApiErrorBody | null)?.error;
  if (error) throw new ApiError(response.status, error.code, error.message, error.fields, error.issues);
  // A non-JSON 5xx comes from the proxy while the API is starting up.
  throw new ApiError(
    response.status,
    'UNAVAILABLE',
    response.status >= 500
      ? 'Server se upravo pokreće. Pokušajte ponovo za nekoliko sekundi.'
      : `Neočekivan odgovor servera (${response.status}).`,
  );
}

function query(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

export interface ProductListParams {
  category?: string;
  system?: string;
  brand?: string;
  kind?: string;
  intensity?: string;
  diet?: string;
  q?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
}

export const api = {
  config: (signal?: AbortSignal) => request<ShopConfigResponse>('/config', { signal }),
  meta: (context: { category?: string; system?: string }, signal?: AbortSignal) =>
    request<CatalogMetaResponse>(`/catalog/meta${query(context)}`, { signal }),
  products: (params: ProductListParams, signal?: AbortSignal) =>
    request<ProductListResponse>(`/products${query({ ...params })}`, { signal }),
  product: (slug: string, signal?: AbortSignal) =>
    request<ProductDetailResponse>(`/products/${encodeURIComponent(slug)}`, { signal }),
  quote: (items: CartLineInput[], signal?: AbortSignal) =>
    request<CartQuoteResponse>('/cart/quote', { method: 'POST', body: { items }, signal }),
  createOrder: (input: CheckoutInput, idempotencyKey: string) =>
    request<CreateOrderResponse>('/orders', {
      method: 'POST',
      body: input,
      headers: { 'Idempotency-Key': idempotencyKey },
    }),
  loyalty: (email: string, signal?: AbortSignal) =>
    request<LoyaltyResponse>('/loyalty', { method: 'POST', body: { email }, signal }),
  order: (number: string, token: string, signal?: AbortSignal) =>
    request<OrderView>(`/orders/${encodeURIComponent(number)}${query({ t: token })}`, { signal }),

  admin: {
    login: (password: string) =>
      request<{ ok: true }>('/admin/login', { method: 'POST', body: { password } }),
    logout: () => request<{ ok: true }>('/admin/logout', { method: 'POST', body: {} }),
    session: (signal?: AbortSignal) => request<{ ok: true }>('/admin/session', { signal }),
    dashboard: (signal?: AbortSignal) => request<AdminDashboard>('/admin/dashboard', { signal }),
    customers: (signal?: AbortSignal) => request<{ items: AdminCustomer[] }>('/admin/customers', { signal }),
    orders: (params: { status?: string; q?: string; page?: number }, signal?: AbortSignal) =>
      request<Paginated<AdminOrderSummary>>(`/admin/orders${query(params)}`, { signal }),
    order: (number: string, signal?: AbortSignal) =>
      request<AdminOrderDetail>(`/admin/orders/${encodeURIComponent(number)}`, { signal }),
    resendEmail: (number: string) =>
      request<AdminOrderDetail>(`/admin/orders/${encodeURIComponent(number)}/email`, { method: 'POST' }),
    setStatus: (number: string, status: OrderStatus, note?: string) =>
      request<AdminOrderDetail>(`/admin/orders/${encodeURIComponent(number)}/status`, {
        method: 'POST',
        body: { status, note: note || undefined },
      }),
    setInstagram: (number: string, handle: string) =>
      request<AdminOrderDetail>(`/admin/orders/${encodeURIComponent(number)}/instagram`, {
        method: 'POST',
        body: { handle },
      }),
    shipping: (signal?: AbortSignal) => request<ShippingResponse>('/admin/shipping', { signal }),
    procurement: (signal?: AbortSignal) => request<ProcurementResponse>('/admin/procurement', { signal }),
    sendTestEmail: () => request<{ sentTo: string }>('/admin/email-test', { method: 'POST' }),
    markOrdered: (orders: string[]) =>
      request<{ updated: string[]; skipped: string[] }>('/admin/procurement/mark-ordered', {
        method: 'POST',
        body: { orders },
      }),
    syncRuns: (signal?: AbortSignal) =>
      request<{ items: SyncRunView[]; running: boolean }>('/admin/sync-runs', { signal }),
    startSync: () => request<{ started: boolean }>('/admin/sync', { method: 'POST', body: {} }),
  },
};
