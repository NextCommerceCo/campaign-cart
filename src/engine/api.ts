import type { Campaign, CartSummary } from './types';

export interface ApiLine {
  package_id: number;
  quantity: number;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class Api {
  constructor(
    private apiKey: string,
    private fetchImpl: typeof fetch,
    private base: string,
  ) {}

  getCampaign(currency?: string): Promise<Campaign> {
    return this.request<Campaign>(`${this.base}/api/v1/campaigns/${currency ? `?currency=${encodeURIComponent(currency)}` : ''}`);
  }

  calculate(
    body: { lines: ApiLine[]; vouchers: string[]; currency?: string; shipping_method?: number },
    signal?: AbortSignal,
  ): Promise<CartSummary> {
    return this.request<CartSummary>(`${this.base}/api/v1/carts/calculate/`, {
      method: 'POST',
      body: JSON.stringify(body),
      signal,
    });
  }

  async request<T>(url: string, init: RequestInit = {}): Promise<T> {
    const res = await this.fetchImpl(url, {
      ...init,
      headers: { Authorization: this.apiKey, 'Content-Type': 'application/json', ...init.headers },
    });
    const text = await res.text();
    const body: unknown = text ? JSON.parse(text) : null;
    if (!res.ok) throw new ApiError(`${init.method ?? 'GET'} ${url} → ${res.status}`, res.status, body);
    return body as T;
  }
}
