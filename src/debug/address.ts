import type { CheckoutState, FormatPart } from '../checkout/state/types';

const PLAIN: FormatPart[][] = [
  [{ field: 'first_name' }, { text: ' ' }, { field: 'last_name' }],
  [{ field: 'line1' }],
  [{ field: 'line2' }],
  [{ field: 'city' }, { text: ' ' }, { field: 'state' }, { text: ' ' }, { field: 'postcode' }],
  [{ field: 'country' }],
];
const LATIN = /^[\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]*$/u;

export function writeLines(lines: FormatPart[][], values: Record<string, string>): string[] {
  return lines.flatMap((line) => {
    if (!line.some((part) => 'field' in part)) return [line.map((part) => ('text' in part ? part.text : '')).join('')];
    const has = (part: FormatPart) => 'field' in part && !!values[part.field]?.trim();
    let out = '';
    let pending: string | undefined;
    let written = false;
    line.forEach((part, i) => {
      if ('text' in part) {
        const starts = line.slice(0, i).every((before) => 'text' in before);
        if ((written || starts) && line.slice(i + 1).some(has)) pending = part.text;
        return;
      }
      if (!has(part)) return;
      out += (pending ?? '') + values[part.field]!.trim();
      pending = undefined;
      written = true;
    });
    return out ? [out] : [];
  });
}

export function writtenAddress(checkout: CheckoutState, prefix: '' | 'billing_'): string[] {
  const field = (name: string) => checkout.fields[prefix + name]?.trim() ?? '';
  const code = field('country');
  const rules = checkout.rules[code];
  const values = {
    first_name: field('first_name'),
    last_name: field('last_name'),
    line1: field('line1'),
    line2: field('line2'),
    city: field('city'),
    postcode: field('postcode'),
    state: rules?.states?.find((s) => s.code === field('state'))?.name ?? field('state'),
    country: rules?.country.name ?? checkout.countries.find((c) => c.code === code)?.name ?? code,
  };
  const latin = LATIN.test(Object.values(values).join(''));
  const format = (latin && rules?.address?.format_latin) || rules?.address?.format;
  return writeLines(format?.length ? format : PLAIN, values);
}
