import { describe, expect, it } from 'vitest';
import { ApiError, failureOf } from '../../src/engine/api';

describe('failureOf', () => {
  const api = (status: number, body?: unknown) => failureOf(new ApiError(`POST /x → ${status}`, status, body));

  it('says why a request failed, with the HTTP status when the API answered', () => {
    const message = (status: number) => ({ status, message: `POST /x → ${status}` });
    expect(api(502)).toEqual({ code: 'server', ...message(502) });
    expect(api(404)).toEqual({ code: 'rejected', ...message(404) });
    expect(api(400, { message: 'Bad voucher' })).toEqual({ code: 'rejected', ...message(400) });
    expect(api(401)).toEqual({ code: 'auth', ...message(401) });
    expect(api(429)).toEqual({ code: 'too_many_requests', ...message(429) });
    expect(failureOf(Object.assign(new Error('campaign request failed: 403'), { status: 403 }))).toEqual({
      code: 'auth',
      status: 403,
      message: 'campaign request failed: 403',
    });
    expect(failureOf(new DOMException('aborted', 'AbortError'))).toEqual({ code: 'timeout', message: 'aborted' });
    expect(failureOf(new TypeError('Failed to fetch'))).toEqual({ code: 'network', message: 'Failed to fetch' });
  });

  it('gives the gateway’s decline code for a declined card', () => {
    expect(api(400, { payment_response_code: '51', payment_details: 'Insufficient funds' })).toEqual({
      code: 'declined',
      status: 400,
      message: 'POST /x → 400',
      decline_code: '51',
    });
    expect(api(400, { payment_details: 'Declined' })).toEqual({
      code: 'declined',
      status: 400,
      message: 'POST /x → 400',
    });
  });
});
