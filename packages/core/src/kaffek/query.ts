/**
 * KaffeK runs Magento 2 and exposes the public storefront GraphQL API at /graphql. The UK shop is a
 * separate Magento store view selected with the `Store` header -- without it the API answers for the
 * Danish store (DKK prices). Everything the shop needs comes from this one paged query, so a full sync
 * is ~12 requests instead of crawling ~1,000 HTML product pages.
 */
export const KAFFEK_GRAPHQL_URL = 'https://kaffek.co.uk/graphql';
export const KAFFEK_UK_STORE_CODE = 'kaffekapslencouk';
export const KAFFEK_BASE_URL = 'https://kaffek.co.uk';

/**
 * `custom_attributesV2` is filtered to `used_in_product_listing` on purpose: the unfiltered list makes
 * Magento throw "Internal server error" for a handful of products (which nulls the field for them), and
 * it also carries internal fields such as purchase cost and margin that have no business in our database.
 * The listing subset has every attribute the shop uses and has proven stable.
 *
 * Magento offers no unique sort key here (only position/price/relevance), so page boundaries are not
 * guaranteed stable while the catalog changes. The sync compensates: it de-duplicates by SKU and only
 * treats a pass as authoritative (allowed to retire products) when it saw every item in `total_count`.
 */
export const KAFFEK_PRODUCTS_QUERY = /* GraphQL */ `
  query KafeshopCatalog($page: Int!, $pageSize: Int!) {
    products(filter: { price: { from: "0" } }, pageSize: $pageSize, currentPage: $page) {
      total_count
      page_info {
        current_page
        total_pages
      }
      items {
        __typename
        sku
        uid
        name
        url_key
        ... on SimpleProduct {
          weight
        }
        stock_status
        quantity
        review_count
        rating_summary
        price_range {
          minimum_price {
            regular_price {
              value
              currency
            }
            final_price {
              value
              currency
            }
          }
        }
        short_description {
          html
        }
        media_gallery {
          url
          position
          disabled
        }
        custom_attributesV2(filters: { used_in_product_listing: true }) {
          items {
            code
            ... on AttributeValue {
              value
            }
            ... on AttributeSelectedOptions {
              selected_options {
                label
              }
            }
          }
        }
      }
    }
  }
`;
