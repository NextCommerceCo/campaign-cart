import { describe, expect, it } from 'vitest';
import { ApiError, errorCode } from '../../src/engine/api';

describe('errorCode', () => {
  it('says why a request failed, with the HTTP status when the API answered', () => {
    const api = (status: number, body?: unknown) => errorCode(new ApiError(`POST /x → ${status}`, status, body));
    expect(api(502)).toEqual({ code: 'server', status: 502 });
    expect(api(404)).toEqual({ code: 'rejected', status: 404 });
    expect(api(400, { message: 'Bad voucher' })).toEqual({ code: 'rejected', status: 400 });
    expect(api(401)).toEqual({ code: 'auth', status: 401 });
    expect(api(429)).toEqual({ code: 'too_many_requests', status: 429 });
    expect(api(400, { payment_response_code: '51' })).toEqual({ code: 'declined', status: 400 });
    expect(errorCode(new DOMException('aborted', 'AbortError'))).toEqual({ code: 'timeout' });
    expect(errorCode(new TypeError('Failed to fetch'))).toEqual({ code: 'network' });
  });
});
