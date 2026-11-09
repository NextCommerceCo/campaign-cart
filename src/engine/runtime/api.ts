import type { Logger } from './log';
import type { Line, CartSummary } from '../cart/types';
import type { AddressSuggestion, ApiOrder, CheckoutError, OpenCart, OrderBody, ProspectBody, Send } from '../types';
import type { Failure } from '../events/sdk';

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
    private sessionId: () => string,
  ) {}

  calculate(
    body: { lines: Line[]; vouchers: string[]; currency?: string; shipping_method?: number },
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

  createOrder(body: OrderBody): Promise<ApiOrder> {
    return this.request<ApiOrder>(`${this.base}/api/v1/orders/`, { method: 'POST', body: JSON.stringify(body) });
  }

  getOrder(refId: string, signal?: AbortSignal): Promise<ApiOrder> {
    return this.request<ApiOrder>(`${this.base}/api/v1/orders/${encodeURIComponent(refId)}/`, { signal });
  }

  addUpsell(refId: string, body: { lines: Line[]; currency?: string; vouchers?: string[] }): Promise<ApiOrder> {
    return this.request<ApiOrder>(`${this.base}/api/v1/orders/${encodeURIComponent(refId)}/upsells/`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  autocomplete(query: string, country: string, signal?: AbortSignal): Promise<{ results?: AddressSuggestion[] }> {
    const params = new URLSearchParams({ query_text: query, ...(country && { country }) });
    return this.request(`${this.base}/api/v1/addresses/autocomplete/?${params}`, { signal });
  }

  private async request<T>(url: string, init: RequestInit = {}): Promise<T> {
    const route = `${init.method ?? 'GET'} ${url.slice(this.base.length).split('?')[0]}`;
    const started = Date.now();
    const res = await this.send(url, {
      ...init,
      headers: {
        Authorization: this.apiKey,
        'Content-Type': 'application/json',
        'X-Next-Campaign-Session-Id': this.sessionId(),
        ...init.headers,
      },
    }).catch((err: unknown) => {
      this.log.debug(`api ${route} failed`, err);
      throw err;
    });
    this.log.debug(`api ${route} → ${res.status} in ${Date.now() - started} ms`);
    const text = await res.text();
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {}
    if (!res.ok) throw new ApiError(`${route} → ${res.status}`, res.status, body);
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

export function failureOf(err: unknown): Failure & { message: string } {
  const message = err instanceof Error ? err.message : String(err);
  if (err instanceof Error && 'status' in err && typeof err.status === 'number') {
    const status = err.status;
    const body = (err instanceof ApiError && err.body && typeof err.body === 'object' ? err.body : {}) as ErrorBody;
    if (body.payment_response_code || body.payment_details)
      return {
        code: 'declined',
        status,
        message,
        ...(body.payment_response_code && { decline_code: body.payment_response_code }),
      };
    const code = byStatus(status);
    return { code: code === 'failed' ? 'rejected' : code, status, message };
  }
  if (err instanceof DOMException && (err.name === 'AbortError' || err.name === 'TimeoutError'))
    return { code: 'timeout', message };
  return { code: 'network', message };
}

/** A failed order or upsell request as a Failure, with the API's own message when it gave one. */
export function orderFailure(err: unknown): Failure {
  const { message } = orderError(err);
  return { ...failureOf(err), ...(message && { message }) };
}

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
