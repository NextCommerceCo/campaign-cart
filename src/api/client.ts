/**
 * API Client for NextCommerce Campaigns API
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
import { Logger, createLogger } from '@/core/logger';
import type { IApiClient } from './client.types';

/**
 * The one implementation of `IApiClient` (`@/api/client.types`).
 *
 * Owns everything shared by every call — the base URL, the `Authorization` header,
 * rate-limit handling, error enrichment, and telling an aborted request apart from a
 * failed one — so no endpoint method repeats it and no feature touches `fetch`.
 *
 * **Do not construct one.** `src/client.ts` builds the single instance this page uses;
 * ask it with `getApiClient()`. Twelve places used to run `new ApiClient(…)` themselves,
 * which produced a dozen identical clients.
 *
 * **Depend on `IApiClient`, not on this class**, wherever you only need to call the
 * API: it is what lets a test supply a compiler-checked fake instead of mocking the
 * module by path. The interface is intentionally not re-exported from `src/index.ts` —
 * that is the frozen public surface — so import it from `@/api/client.types`.
 *
 * Because the instance is shared, **every field here must stay per-page, not per-caller**.
 * A cache, an in-flight map or an abort controller added to this class would silently be
 * shared by every holder — that state belongs in the caller.
  * @category Core
 */
export class ApiClient implements IApiClient {
  private baseURL = 'https://campaigns.apps.29next.com';
  private apiKey: string;
  private logger: Logger;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.logger = createLogger('ApiClient');
  }

  // Campaign endpoints
  public async getCampaigns(currency?: string): Promise<Campaign> {
    const queryString = currency ? `?currency=${currency}` : '';
    return this.request<Campaign>(`/api/v1/campaigns/${queryString}`);
  }

  // Cart endpoints
  public async createCart(
    data: CartBase & { currency?: string }
  ): Promise<Cart> {
    return this.request<Cart>('/api/v1/carts/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

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
  public async createOrder(
    data: CreateOrder & { currency?: string }
  ): Promise<Order> {
    return this.request<Order>('/api/v1/orders/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public async getOrder(refId: string): Promise<Order> {
    return this.request<Order>(`/api/v1/orders/${refId}/`);
  }

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

    let errorMessage: string | undefined;
    let retryAfter: number | undefined;

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Handle rate limiting
      if (response.status === 429) {
        retryAfter = parseInt(response.headers.get('Retry-After') || '60');
        errorMessage = `Rate limited. Retry after ${retryAfter} seconds`;
        this.logger.warn(errorMessage);

        throw new Error(errorMessage);
      }

      // Handle other errors
      if (!response.ok) {
        errorMessage = `API Error: ${response.status} ${response.statusText}`;

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

  /**
   * Re-keys this client in place.
   *
   * **Not part of `IApiClient`, and not for feature code.** There is one client per
   * page, so this changes the credentials of every holder at once — including holders
   * that cached the instance and will never ask for it again. Use `getApiClient(newKey)`
   * from [`@/client`](../client.ts), which builds a client for that key; it reads the key
   * back off the instance, so calling this behind its back gets the shared client
   * replaced on the next call rather than silently reused.
   */
  public setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  /** The key this client authenticates with. */
  public getApiKey(): string {
    return this.apiKey;
  }
}

function isAbortError(error: unknown, signal?: AbortSignal | null): boolean {
  if (signal?.aborted) return true;
  if (!(error instanceof Error)) return false;
  return error.name === 'AbortError' || /aborted|abort/i.test(error.message);
}
