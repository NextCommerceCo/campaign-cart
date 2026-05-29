/**
 * Thin, store-free HTTP client for the NextCommerce Campaigns API.
 *
 * `ApiClient` wraps the REST endpoints (campaigns, carts, orders, prospect
 * carts, address autocomplete) with auth, JSON encoding, rate-limit handling,
 * and abort support. It holds no application state — the SDK's Zustand stores
 * call it and own the resulting data. Construct one with your public API key.
 *
 * @example
 * ```ts
 * const client = new ApiClient('pk_live_...');
 * const campaign = await client.getCampaigns('USD');
 * ```
 */

import type {
  Campaign,
  Cart,
  Order,
  CartBase,
  CreateOrder,
  AddUpsellLine,
  AddressAutocomplete,
  CartCalculateSummary,
  CartSummary,
} from '@/types/api';
import { Logger, createLogger } from '@/utils/logger';

export class ApiClient {
  private baseURL = 'https://campaigns.apps.29next.com';
  private apiKey: string;
  private logger: Logger;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.logger = createLogger('ApiClient');
  }

  // Campaign endpoints
  /**
   * Fetches the campaign for the configured API key, including its packages,
   * offers, and shipping methods.
   *
   * @param currency - Optional ISO 4217 code (e.g. `'USD'`) to price the
   *                   campaign in. Defaults to the campaign's base currency.
   * @returns The campaign data.
   *
   * @example
   * ```ts
   * const campaign = await client.getCampaigns('EUR');
   * console.log(campaign.packages.length);
   * ```
   */
  public async getCampaigns(currency?: string): Promise<Campaign> {
    const queryString = currency ? `?currency=${currency}` : '';
    return this.request<Campaign>(`/api/v1/campaigns/${queryString}`);
  }

  // Cart endpoints
  /**
   * Creates a server-side cart from a set of lines.
   *
   * @param data - The cart payload (lines and optional attribution), plus an
   *               optional `currency` ISO 4217 code.
   * @returns The created cart, including server-calculated totals.
   *
   * @example
   * ```ts
   * const cart = await client.createCart({
   *   lines: [{ package_id: 2, quantity: 1 }],
   *   user: { first_name: 'Ada', last_name: 'Lovelace', language: 'en' },
   *   currency: 'USD',
   * });
   * ```
   */
  public async createCart(
    data: CartBase & { currency?: string }
  ): Promise<Cart> {
    return this.request<Cart>('/api/v1/carts/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Calculates cart totals (subtotal, discounts, shipping, tax) server-side
   * without creating a persistent cart. Useful for live previews as the user
   * changes lines, quantities, or vouchers.
   *
   * @param data - The lines, optional vouchers, currency, and shipping method.
   * @param signal - Optional `AbortSignal` to cancel a superseded request.
   * @param options - Set `upsell: true` to price the summary as a
   *                  post-purchase upsell.
   * @returns The calculated summary.
   *
   * @example
   * ```ts
   * const controller = new AbortController();
   * const summary = await client.calculateSummary(
   *   { lines: [{ package_id: 2, quantity: 2 }], vouchers: ['SAVE10'] },
   *   controller.signal
   * );
   * ```
   */
  public async calculateSummary(
    data: CartCalculateSummary,
    signal?: AbortSignal,
    options?: { upsell?: boolean }
  ): Promise<CartSummary> {
    const endpoint = options?.upsell
      ? '/api/v1/carts/calculate/?upsell=true'
      : '/api/v1/carts/calculate/';
    return this.request<CartSummary>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
      signal,
    });
  }

  // Order endpoints
  /**
   * Creates an order from the cart lines and checkout details. This is the
   * call that takes payment and produces a confirmable order.
   *
   * @param data - The full order payload: lines, addresses, shipping method,
   *               payment detail, and `success_url` / `payment_failed_url`.
   * @returns The created order, including its `ref_id` and line items.
   *
   * @example
   * ```ts
   * const order = await client.createOrder({
   *   lines: [{ package_id: 2, quantity: 1 }],
   *   shipping_method: 1,
   *   payment_detail: { payment_method: 'card_token', card_token: 'tok_...' },
   *   success_url: 'https://shop.example/receipt',
   * });
   * console.log(order.ref_id);
   * ```
   */
  public async createOrder(
    data: CreateOrder & { currency?: string }
  ): Promise<Order> {
    return this.request<Order>('/api/v1/orders/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Retrieves an existing order by its reference id.
   *
   * @param refId - The order's `ref_id` returned by {@link ApiClient.createOrder}.
   * @returns The order.
   *
   * @example
   * ```ts
   * const order = await client.getOrder(order.ref_id);
   * ```
   */
  public async getOrder(refId: string): Promise<Order> {
    return this.request<Order>(`/api/v1/orders/${refId}/`);
  }

  /**
   * Adds post-purchase upsell line(s) to an existing order.
   *
   * @param refId - The order's `ref_id`.
   * @param data - The upsell lines to add (and optional payment detail).
   * @returns The updated order, with the new upsell lines marked `is_upsell`.
   *
   * @example
   * ```ts
   * const updated = await client.addUpsell(order.ref_id, {
   *   lines: [{ package_id: 7, quantity: 1 }],
   * });
   * ```
   */
  public async addUpsell(refId: string, data: AddUpsellLine): Promise<Order> {
    return this.request<Order>(`/api/v1/orders/${refId}/upsells/`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Prospect Cart endpoints
  public async createProspectCart(data: any): Promise<any> {
    return this.request('/api/v1/prospect-carts/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public async updateProspectCart(cartId: string, data: any): Promise<any> {
    return this.request(`/api/v1/prospect-carts/${cartId}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  public async getProspectCart(cartId: string): Promise<any> {
    return this.request(`/api/v1/prospect-carts/${cartId}/`);
  }

  public async abandonProspectCart(cartId: string): Promise<any> {
    return this.request(`/api/v1/prospect-carts/${cartId}/abandon/`, {
      method: 'POST',
    });
  }

  public async convertProspectCart(cartId: string): Promise<any> {
    return this.request(`/api/v1/prospect-carts/${cartId}/convert/`, {
      method: 'POST',
    });
  }

  public async getAddressesAutocomplete(
    query_text: string,
    country?: string,
    language?: string,
    signal?: AbortSignal
  ): Promise<any> {
    const params = new URLSearchParams({ query_text });

    if (country) params.append('country', country);
    if (language) params.append('language', language);

    return this.request<AddressAutocomplete>(
      `/api/v1/addresses/autocomplete/?${params.toString()}`,
      { signal }
    );
  }

  // Get request type from endpoint
  private getRequestType(endpoint: string): string {
    if (endpoint.includes('/campaigns')) return 'campaign';
    if (endpoint.includes('/upsells')) return 'upsell';
    if (endpoint.includes('/orders')) return 'order';
    if (endpoint.includes('/prospect-carts')) return 'prospect_cart';
    if (endpoint.includes('/carts')) return 'cart';
    if (endpoint.includes('/addresses')) return 'addresses';
    return 'campaign'; // default
  }

  // Get error type from status code
  private getErrorType(
    status: number
  ): 'network' | 'rate_limit' | 'auth' | 'server_error' | 'client_error' {
    if (status === 0) return 'network';
    if (status === 429) return 'rate_limit';
    if (status === 401 || status === 403) return 'auth';
    if (status >= 500) return 'server_error';
    if (status >= 400) return 'client_error';
    return 'network';
  }

  // Generic request handler with error handling and rate limiting
  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const method = options?.method || 'GET';
    const url = `${this.baseURL}${endpoint}`;

    const headers = {
      Authorization: this.apiKey,
      'Content-Type': 'application/json',
      ...options?.headers,
    };

    this.logger.debug(`API Request: ${method} ${url}`);

    const startTime = performance.now();
    let statusCode = 0;
    let errorMessage: string | undefined;
    let errorType:
      | 'network'
      | 'rate_limit'
      | 'auth'
      | 'server_error'
      | 'client_error'
      | undefined;
    let retryAfter: number | undefined;

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });
      const duration = performance.now() - startTime;
      statusCode = response.status;

      // Handle rate limiting
      if (response.status === 429) {
        retryAfter = parseInt(response.headers.get('Retry-After') || '60');
        errorMessage = `Rate limited. Retry after ${retryAfter} seconds`;
        errorType = 'rate_limit';
        this.logger.warn(errorMessage);

        throw new Error(errorMessage);
      }

      // Handle other errors
      if (!response.ok) {
        errorMessage = `API Error: ${response.status} ${response.statusText}`;
        errorType = this.getErrorType(response.status);

        // Try to parse error response body
        let errorData: any = {};
        try {
          const text = await response.text();
          if (text) {
            errorData = JSON.parse(text);
          }
        } catch (parseError) {
          this.logger.warn('Failed to parse error response body');
        }

        this.logger.error(errorMessage, errorData);

        // Create enhanced error with response data
        const error = new Error(errorMessage) as any;
        error.status = response.status;
        error.statusText = response.statusText;
        error.responseData = errorData;
        throw error;
      }

      const data = await response.json();

      this.logger.debug(`API Response: ${response.status}`, data);

      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (isAbortError(error, options?.signal)) {
        this.logger.debug('API request aborted:', message);
      } else {
        this.logger.error('API request failed:', message);
      }

      throw error;
    }
  }

  // Update API key
  public setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  // Get current API key
  public getApiKey(): string {
    return this.apiKey;
  }
}

function isAbortError(error: unknown, signal?: AbortSignal | null): boolean {
  if (signal?.aborted) return true;
  if (!(error instanceof Error)) return false;
  return error.name === 'AbortError' || /aborted|abort/i.test(error.message);
}
