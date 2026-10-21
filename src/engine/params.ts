export const ONE_SHOT_PARAMS = ['reset', 'forcePackageId', 'debug', 'debugger', 'payment_failed'];

const ATTRIBUTION = /^(utm_\w+|gclid|gbraid|wbraid|fbclid|ttclid|msclkid|clickid|evclid|affid|aff|sub\d|subaffiliate\d|funnel|currency)$/;

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
