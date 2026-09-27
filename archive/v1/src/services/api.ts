import { Product, ApiResponse, ProductFilters } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://kafeshop-api.netlify.app/api';

class ApiService {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async fetcher<T>(endpoint: string, options?: RequestInit): Promise<T> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        mode: 'cors',
        credentials: 'omit',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...options?.headers,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Response Error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
          url: `${this.baseUrl}${endpoint}`
        });
        throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  /**
   * Get all products with optional filtering
   */
  async getProducts(filters: ProductFilters = {}): Promise<ApiResponse<Product[]>> {
    const params = new URLSearchParams();

    // Default values
    params.append('currency', filters.currency || 'rsd');
    params.append('page', String(filters.page || 1));

    // Optional filters
    if (filters.system) params.append('system', filters.system);
    if (filters.brand) params.append('brand', filters.brand);
    if (filters.min_price) params.append('min_price', String(filters.min_price));
    if (filters.max_price) params.append('max_price', String(filters.max_price));
    if (filters.intensity) params.append('intensity', filters.intensity);
    if (filters.in_stock !== undefined) params.append('in_stock', String(filters.in_stock));
    if (filters.search) params.append('search', filters.search);
    if (filters.sort) params.append('sort', filters.sort);
    if (filters.order) params.append('order', filters.order);

    return this.fetcher<ApiResponse<Product[]>>(`/products?${params.toString()}`);
  }

  /**
   * Get a single product by ID, slug, or SKU
   */
  async getProduct(identifier: string, currency: 'gbp' | 'rsd' = 'rsd'): Promise<Product> {
    const params = new URLSearchParams({ currency });
    return this.fetcher<Product>(`/products/${identifier}?${params.toString()}`);
  }

  /**
   * Search products
   */
  async searchProducts(query: string, filters: ProductFilters = {}): Promise<ApiResponse<Product[]>> {
    return this.getProducts({ ...filters, search: query });
  }

  /**
   * Get all available systems
   */
  async getSystems() {
    try {
      const response = await this.fetcher<{ data: Array<{
        id: string;
        name: string;
        slug: string;
        description: string;
        product_count: number;
        brand_count: number;
      }>, total: number }>('/systems');
      return response.data;
    } catch (error) {
      console.error('Error fetching systems:', error);
      return [];
    }
  }

  /**
   * Get all available brands, optionally filtered by system
   */
  async getBrands(system?: string) {
    try {
      const endpoint = system ? `/brands?system=${system}` : '/brands';
      const response = await this.fetcher<{ data: Array<{
        id: string;
        name: string;
        slug: string;
        product_count: number;
        systems: string[];
      }>, total: number, filters: { system: string } }>(endpoint);
      return response.data;
    } catch (error) {
      console.error('Error fetching brands:', error);
      return [];
    }
  }

  /**
   * Get products by system
   */
  async getProductsBySystem(system: string, page: number = 1, limit: number = 20): Promise<ApiResponse<Product[]>> {
    return this.getProducts({ system, page, limit });
  }

  /**
   * Get featured/popular products
   */
  async getFeaturedProducts(limit: number = 12): Promise<ApiResponse<Product[]>> {
    return this.getProducts({
      sort: 'popularity',
      order: 'desc',
      limit,
      in_stock: true
    });
  }

  /**
   * Get products on sale
   */
  async getSaleProducts(page: number = 1, limit: number = 20): Promise<ApiResponse<Product[]>> {
    return this.getProducts({
      page,
      limit,
      sort: 'price',
      order: 'asc'
    }).then(response => ({
      ...response,
      data: response.data.filter(p => p.on_sale)
    }));
  }
}

// Export singleton instance
export const apiService = new ApiService();
export default apiService;
