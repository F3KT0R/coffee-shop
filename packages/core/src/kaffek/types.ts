/** Raw item shape returned by KAFFEK_PRODUCTS_QUERY. Fields are nullable wherever Magento may null them. */
export interface KaffekMoney {
  value: number | null;
  currency: string | null;
}

export type KaffekAttribute =
  { code: string; value: string | null } | { code: string; selected_options: { label: string }[] | null };

export interface KaffekItem {
  __typename: string;
  sku: string;
  /** base64 of Magento's numeric product id -- the id KaffeK's own add-to-cart form uses. */
  uid?: string | null;
  /** Shipping weight in kg (simple products only). */
  weight?: number | null;
  name: string | null;
  url_key: string | null;
  stock_status: 'IN_STOCK' | 'OUT_OF_STOCK' | null;
  quantity: number | null;
  review_count: number | null;
  rating_summary: number | null;
  price_range: {
    minimum_price: {
      regular_price: KaffekMoney;
      final_price: KaffekMoney;
    };
  } | null;
  short_description: { html: string | null } | null;
  media_gallery: { url: string | null; position: number | null; disabled: boolean | null }[] | null;
  custom_attributesV2: { items: KaffekAttribute[] } | null;
}

export interface KaffekProductsPage {
  total_count: number;
  page_info: { current_page: number; total_pages: number };
  items: (KaffekItem | null)[];
}
