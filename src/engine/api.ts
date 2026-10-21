import type { ApiLine, CartSummary, Order, OrderBody, ProspectBody, Send } from './types';

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
    private send: Send,
    private base: string,
  ) {}

  calculate(
    body: { lines: ApiLine[]; vouchers: string[]; currency?: string; shipping_method?: number },
    { signal, upsell }: { signal?: AbortSignal; upsell?: boolean } = {},
  ): Promise<CartSummary> {
    return this.request<CartSummary>(`${this.base}/api/v1/carts/calculate/${upsell ? '?upsell=true' : ''}`, {
      method: 'POST',
      body: JSON.stringify(body),
      signal,
    });
  }

  createCart(body: ProspectBody): Promise<unknown> {
    return this.request(`${this.base}/api/v1/carts/`, { method: 'POST', body: JSON.stringify(body) });
  }

  createOrder(body: OrderBody): Promise<Order> {
    return this.request<Order>(`${this.base}/api/v1/orders/`, { method: 'POST', body: JSON.stringify(body) });
  }

  private async request<T>(url: string, init: RequestInit = {}): Promise<T> {
    const res = await this.send(url, {
      ...init,
      headers: { Authorization: this.apiKey, 'Content-Type': 'application/json', ...init.headers },
    });
    const text = await res.text();
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {}
    if (!res.ok) throw new ApiError(`${init.method ?? 'GET'} ${url} → ${res.status}`, res.status, body);
    return body as T;
  }
}
