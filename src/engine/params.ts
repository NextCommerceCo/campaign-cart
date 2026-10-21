export const ONE_SHOT_PARAMS = [
  'reset',
  'forcePackageId',
  'debug',
  'debugger',
  'payment_failed',
  'ref_id',
  'order_ref_id',
];

const ATTRIBUTION =
  /^(utm_\w+|gclid|gbraid|wbraid|fbclid|ttclid|msclkid|clickid|evclid|affid|aff|sub\d|subaffiliate\d|funnel|currency)$/;

export function parseForcePackages(raw: string | undefined): Array<{ packageId: number; quantity: number }> {
  if (!raw) return [];
  return raw
    .split(',')
    .map((part) => part.split(':').map(Number))
    .filter(([id]) => id && id > 0)
    .map(([id, qty]) => ({ packageId: id!, quantity: qty && qty > 0 ? qty : 1 }));
}

export function keptParams(params: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(params).filter(([key]) => !ONE_SHOT_PARAMS.includes(key)));
}

export function nextUrl(target: string, current: URL, params: Record<string, string>): string {
  const url = new URL(target, current);
  const sameSite = url.origin === current.origin;
  for (const [key, value] of Object.entries(keptParams(params))) {
    if ((sameSite || ATTRIBUTION.test(key)) && !url.searchParams.has(key)) url.searchParams.set(key, value);
  }
  return url.toString();
}
