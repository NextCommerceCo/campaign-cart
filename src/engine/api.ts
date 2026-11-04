import type { Logger } from './log';
import type { AddressSuggestion, OrderBody, ProspectBody } from '../checkout/state/types';
import type { ApiLine, CartSummary } from './cart/types';
import type { CheckoutError, OpenCart, Order, Send } from './types';

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
    private log: Logger,
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

  createCart(body: ProspectBody): Promise<OpenCart> {
    return this.request<OpenCart>(`${this.base}/api/v1/carts/`, { method: 'POST', body: JSON.stringify(body) });
  }

  createOrder(body: OrderBody): Promise<Order> {
    return this.request<Order>(`${this.base}/api/v1/orders/`, { method: 'POST', body: JSON.stringify(body) });
  }

  getOrder(refId: string, signal?: AbortSignal): Promise<Order> {
    return this.request<Order>(`${this.base}/api/v1/orders/${encodeURIComponent(refId)}/`, { signal });
  }

  addUpsell(refId: string, body: { lines: ApiLine[]; currency?: string; vouchers?: string[] }): Promise<Order> {
    return this.request<Order>(`${this.base}/api/v1/orders/${encodeURIComponent(refId)}/upsells/`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  autocomplete(query: string, country: string, signal?: AbortSignal): Promise<{ results?: AddressSuggestion[] }> {
    const params = new URLSearchParams({ query_text: query, ...(country && { country }) });
    return this.request(`${this.base}/api/v1/addresses/autocomplete/?${params}`, { signal });
  }

  private async request<T>(url: string, init: RequestInit = {}): Promise<T> {
    const call = `api ${init.method ?? 'GET'} ${url.slice(this.base.length).split('?')[0]}`;
    const started = Date.now();
    const res = await this.send(url, {
      ...init,
      headers: { Authorization: this.apiKey, 'Content-Type': 'application/json', ...init.headers },
    }).catch((err: unknown) => {
      this.log.debug(`${call} failed`, err);
      throw err;
    });
    this.log.debug(`${call} → ${res.status} in ${Date.now() - started} ms`);
    const text = await res.text();
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {}
    if (!res.ok) throw new ApiError(`${init.method ?? 'GET'} ${url} → ${res.status}`, res.status, body);
    return body as T;
  }
}

interface ErrorBody {
  message?: string | string[];
  payment_response_code?: string;
  payment_details?: string;
  errors?: Record<string, string | string[]>;
}

const byStatus = (status: number) =>
  status === 429
    ? 'too_many_requests'
    : status === 401 || status === 403
      ? 'auth'
      : status >= 500
        ? 'server'
        : 'failed';

export function orderError(err: unknown): CheckoutError {
  if (!(err instanceof ApiError)) return { code: 'failed' };
  const body = (err.body && typeof err.body === 'object' ? err.body : {}) as ErrorBody;
  if (Array.isArray(body.message)) {
    const texts = (body.message as unknown[]).map((m) =>
      typeof m === 'string' ? m : String((m as { message?: unknown })?.message ?? ''),
    );
    return { code: 'rejected', message: texts.filter(Boolean).join('. ') };
  }
  if (typeof body.message === 'string') return { code: 'rejected', message: body.message };
  if (body.payment_response_code || body.payment_details) {
    return { code: 'declined', decline: body.payment_response_code, message: body.payment_details };
  }
  if (body.errors) return { code: 'rejected', message: Object.values(body.errors).flat().join('. ') };
  return { code: err.status === 400 ? 'invalid_order' : byStatus(err.status) };
}
