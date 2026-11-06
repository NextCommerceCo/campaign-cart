import type { Address, User } from '../engine/events/checkout';
import type { SelectorOption } from '../engine/events/selectors';
import { carried, type Detail, type Priced } from './stream';
import { type Child, h } from './view';

type Data = Record<string, unknown>;
type Section = [heading: string, body: Child[]];

const MONEY = /(^|_)(price|amount|total|subtotal|discount|tax)$/;
/** The money keys "What it carried" shows, left out of Details when it shows them. */
const PRICED = [
  'subtotal',
  'total_discount',
  'discount_percentage',
  'coupons',
  'tax',
  'total',
  'currency',
  'quantity',
  'price',
  'original_price',
  'original_total',
];
const LABELS: Record<string, string> = {
  line1: 'Address',
  line2: 'Address line 2',
  postcode: 'Postcode',
  ref_id: 'Order',
};
const CODES: Record<string, string> = { blank: 'Missing', invalid: 'Not valid', not_selected: 'Not chosen' };
const ADDRESS: Array<keyof Address> = [
  'first_name',
  'last_name',
  'line1',
  'line2',
  'city',
  'state',
  'postcode',
  'country',
];
const USER: Array<keyof User> = ['first_name', 'last_name', 'email', 'phone', 'accepts_marketing', 'language'];

const label = (key: string) => LABELS[key] ?? (key.charAt(0).toUpperCase() + key.slice(1)).replace(/_/g, ' ');
const scalar = (v: unknown) => v === null || ['string', 'number', 'boolean'].includes(typeof v);
const isObject = (v: unknown): v is Data => !!v && typeof v === 'object' && !Array.isArray(v);

/** An event's payload as sections: what it carried, its options, who and where, what went wrong, then the rest. */
export function eventDetail(
  name: string,
  d: Data,
  money: (value: number) => string,
  title: (packageId: number) => string,
): Pick<Detail, 'sections' | 'fields'> {
  const value = (key: string, v: unknown) =>
    typeof v === 'boolean' ? (v ? 'Yes' : 'No') : typeof v === 'number' && MONEY.test(key) ? money(v) : String(v);
  const list = (entries: Array<[string, unknown]>) => {
    const shown = entries.filter(([, v]) => scalar(v) && v !== '');
    return shown.length
      ? h('dl', 'sfields', ...shown.flatMap(([k, v]) => [h('dt', {}, label(k)), h('dd', {}, value(k, v))]))
      : null;
  };
  const address = (a: Partial<Address>) =>
    h(
      'address',
      'kaddr',
      ...[[a.first_name, a.last_name], [a.line1], [a.line2], [a.city, a.state, a.postcode], [a.country], [a.phone]]
        .map((parts) => parts.filter(Boolean).join(' '))
        .filter(Boolean)
        .map((text) => h('span', {}, text)),
    );

  const own = name.startsWith('address.');
  const person = name.startsWith('user.');
  const user = (person ? d : d.user) as User | undefined;
  const priced = (Array.isArray(d.lines) ? d : isObject(d.cart) ? d.cart : undefined) as Priced | undefined;
  const options = (d.options ?? []) as SelectorOption[];
  const changes = (d.changes ?? []) as Array<{ package_id: number; from: number; to: number }>;
  const error = d.error as Data | undefined;
  const errors = (d.errors ?? {}) as Record<string, { code: string; message?: string }>;
  const discounts = (d.discounts ?? []) as Array<{ name: string; amount: number; code?: string }>;
  const sections: Section[] = [
    ['What went wrong', [error && list(Object.entries(error))]],
    [
      'What stopped it',
      [
        Object.keys(errors).length > 0 &&
          list(
            Object.entries(errors).map(
              ([field, e]) => [field, e.message ?? CODES[e.code] ?? e.code] as [string, unknown],
            ),
          ),
      ],
    ],
    ['Changed', changes.map((c) => h('p', {}, `${title(c.package_id)} ${c.from} → ${c.to}`))],
    ['What it carried', priced?.lines?.length || priced?.total !== undefined ? carried(priced!, money) : []],
    [
      'Options',
      options.length
        ? [
            h(
              'table',
              'sitems',
              h('tr', {}, ...['Option', 'Qty', 'Total', ''].map((t) => h('th', {}, t))),
              ...options.map((o) =>
                h(
                  'tr',
                  {},
                  h('td', {}, o.option_id),
                  h('td', {}, String(o.quantity)),
                  h(
                    'td',
                    {},
                    typeof o.original_total === 'number' &&
                      typeof o.total === 'number' &&
                      o.original_total > o.total &&
                      h('s', {}, money(o.original_total)),
                    typeof o.total === 'number' ? money(o.total) : '',
                  ),
                  h('td', {}, o.selected ? 'Selected' : ''),
                ),
              ),
            ),
          ]
        : [],
    ],
    ['Discounts', discounts.map((x) => h('p', {}, `${x.name}${x.code ? ` (${x.code})` : ''} · −${money(x.amount)}`))],
    ['Customer', [user && list(USER.map((k) => [k, user[k]]))]],
    [
      own ? `${label(String(d.type ?? 'shipping'))} address` : 'Shipping address',
      [own ? address(d as Partial<Address>) : isObject(d.shipping_address) && address(d.shipping_address)],
    ],
    [
      'Billing address',
      [
        d.billing_same_as_shipping === true && isObject(d.shipping_address)
          ? h('p', {}, 'Same as shipping')
          : isObject(d.billing_address) && address(d.billing_address),
      ],
    ],
  ];
  const skip = new Set([
    'billing_same_as_shipping',
    ...(priced === d ? PRICED : []),
    ...(own ? [...ADDRESS, 'phone', 'type'] : []),
    ...(person ? USER : []),
  ]);
  return {
    sections: sections.filter(([, body]) => body.some(Boolean)),
    fields: Object.fromEntries(
      Object.entries(d)
        .filter(([k, v]) => !skip.has(k) && scalar(v) && v !== '')
        .map(([k, v]) => [label(k), value(k, v)]),
    ),
  };
}
