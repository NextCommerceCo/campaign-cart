/**
 * `data-next-checkout-field` names that mean the same field. `first_name` and `last_name`
 * are the names the orders API and the address service use, and the ones a page should
 * write; `fname` and `lname` are the SDK's older names, still accepted everywhere, and the
 * names it keeps the values under, so a checkout stored under them still restores.
 */
const SDK_NAME: Readonly<Record<string, string>> = {
  first_name: 'fname',
  last_name: 'lname',
};

const BILLING = 'billing-';

const split = (name: string): [prefix: string, base: string] =>
  name.startsWith(BILLING) ? [BILLING, name.slice(BILLING.length)] : ['', name];

/** The name the SDK keeps a field under: `first_name` → `fname`, `billing-last_name` → `billing-lname`. */
export function sdkCheckoutFieldName(name: string): string {
  const [prefix, base] = split(name);
  const sdk = Object.prototype.hasOwnProperty.call(SDK_NAME, base)
    ? SDK_NAME[base]
    : undefined;
  return sdk ? `${prefix}${sdk}` : name;
}

/** Every name a page may write for the field the SDK keeps under `name`, that one first. */
export function checkoutFieldNames(name: string): string[] {
  const [prefix, base] = split(sdkCheckoutFieldName(name));
  const aliases = Object.entries(SDK_NAME)
    .filter(([, sdk]) => sdk === base)
    .map(([page]) => `${prefix}${page}`);
  return [`${prefix}${base}`, ...aliases];
}
