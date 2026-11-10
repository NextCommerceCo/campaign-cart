import { ApiError, orderError } from '../../engine/runtime/api';

const UNSAID = ['invalid_order', 'rejected', 'failed'];
const PAYMENT = /(^|\.)(payment|card)/;

function entries(said: unknown, path = ''): Array<[string, string]> {
  if (typeof said === 'string') return [[path, said]];
  if (!said || typeof said !== 'object') return [];
  return Object.entries(said).flatMap(([key, value]) =>
    entries(value, Array.isArray(said) ? path : path ? `${path}.${key}` : key),
  );
}

/**
 * An order the API refused by request field (`{"lines": ["…"]}`, or the same under `message`):
 * the first field it named, and the error with the API's text in its message, without payment fields.
 */
export function refusalOf(err: unknown): { field: string; err: ApiError } | undefined {
  if (!(err instanceof ApiError)) return undefined;
  const shown = orderError(err);
  if (shown.message || !UNSAID.includes(shown.code)) return undefined;
  const { message } = (err.body ?? {}) as { message?: unknown };
  const named = entries(Array.isArray(message) ? message : err.body).filter(([path]) => path && path !== 'ref_id');
  if (!named[0]) return undefined;
  const said = named
    .filter(([path]) => !PAYMENT.test(path))
    .map(([path, text]) => `${path}: ${text}`)
    .join('; ')
    .slice(0, 300);
  return {
    field: named[0][0].split('.')[0]!,
    err: said ? new ApiError(`${err.message}: ${said}`, err.status, err.body) : err,
  };
}
