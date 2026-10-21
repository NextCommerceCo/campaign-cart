import { ApiError } from './api';
import type { CheckoutError } from './types';

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
  if (Array.isArray(body.message)) return { code: 'rejected', message: body.message.join('. ') };
  if (typeof body.message === 'string') return { code: 'rejected', message: body.message };
  if (body.payment_response_code || body.payment_details) {
    return { code: 'declined', decline: body.payment_response_code, message: body.payment_details };
  }
  if (body.errors) return { code: 'rejected', message: Object.values(body.errors).flat().join('. ') };
  return { code: err.status === 400 ? 'invalid_order' : byStatus(err.status) };
}
