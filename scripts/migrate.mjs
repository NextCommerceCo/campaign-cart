// @ts-check
/**
 * Rewrites a page's earlier attributes as attributes v2, touching only the attributes it changes:
 * every other character of the page stays as it was. What it cannot rewrite it leaves as it is,
 * since both sets work on one page, and lists in its notes.
 *
 *   node scripts/migrate.mjs page.html [more.html …]          prints what it would change
 *   node scripts/migrate.mjs --write page.html [more.html …]  writes the pages
 *
 * A `.css` file gets its attribute selectors renamed.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const VOID = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
]);
const TOKEN =
  /<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>|<\/?([a-zA-Z][\w-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>/g;
const ATTR = /(\s+)([^\s=>/]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/g;

/** @typedef {{ space: string, name: string, value: string | undefined, quote: string }} Attr */

/** @param {string} raw @returns {Attr[]} */
function parseAttrs(raw) {
  const attrs = [];
  for (const m of raw.matchAll(ATTR)) {
    const v = m[3];
    const quote = v && (v[0] === '"' || v[0] === "'") ? v[0] : '"';
    attrs.push({
      space: m[1],
      name: m[2].toLowerCase(),
      value: v === undefined ? undefined : v.replace(/^["']|["']$/g, ''),
      quote,
    });
  }
  return attrs;
}

/** @param {Attr[]} attrs */
const renderAttrs = (attrs) =>
  attrs
    .map((a) => {
      if (a.value === undefined) return `${a.space}${a.name}`;
      const q = a.value.includes(a.quote) ? (a.quote === '"' ? "'" : '"') : a.quote;
      return `${a.space}${a.name}=${q}${a.value}${q}`;
    })
    .join('');

/** An element's attributes, edited in place. */
class Tag {
  /** @param {Attr[]} attrs */
  constructor(attrs) {
    this.attrs = attrs;
    this.changed = false;
  }
  /** @param {string} name */
  has(name) {
    return this.attrs.some((a) => a.name === name);
  }
  /** @param {string} name */
  get(name) {
    return this.attrs.find((a) => a.name === name)?.value;
  }
  /** @param {string} name @param {string | undefined} value  `undefined` writes a bare attribute */
  set(name, value) {
    const found = this.attrs.find((a) => a.name === name);
    if (found) {
      if (found.value === value) return;
      found.value = value;
    } else this.attrs.push({ space: ' ', name, value, quote: '"' });
    this.changed = true;
  }
  /** @param {string} name */
  remove(name) {
    const i = this.attrs.findIndex((a) => a.name === name);
    if (i < 0) return;
    this.attrs.splice(i, 1);
    this.changed = true;
  }
  /** @param {string} from @param {string} to @param {string | undefined} [value] */
  rename(from, to, value) {
    const found = this.attrs.find((a) => a.name === from);
    if (!found) return;
    found.name = to;
    if (arguments.length > 2) found.value = value;
    this.changed = true;
  }
}

// ── Paths ──────────────────────────────────────────────────────────────────────────────────────

/** A card's or a toggle's property as the field it is now, or a condition (`{ show }`). */
const OPTION_PROPS = {
  price: 'total',
  total: 'total',
  originalPrice: 'subtotal',
  compare: 'subtotal',
  discountAmount: 'total_discount',
  savings: 'total_discount',
  discountPercentage: 'discount_percentage',
  savingsPercentage: 'discount_percentage',
  savingsOfferPercentage: 'discount_percentage',
  unitPrice: 'price',
  originalUnitPrice: 'original_price',
  quantity: 'quantity',
  name: 'lines.0.product_title',
  image: 'lines.0.image',
  hasDiscount: { show: 'total_discount > 0' },
  hasSavings: { show: 'total_discount > 0' },
  isSelected: { show: 'selected' },
};

const PACKAGE_PROPS = {
  name: 'product_title',
  image: 'image',
  price: 'price',
  unitPrice: 'price',
  total: 'total',
  priceTotal: 'total',
  price_total: 'total',
  quantity: 'quantity',
  qty: 'quantity',
  isRecurring: { show: 'subscription' },
};

const CART = {
  total: 'cart.total',
  subtotal: 'cart.subtotal',
  shipping: 'cart.shipping_method.price',
  totalDiscount: 'cart.total_discount',
  discountAmount: 'cart.total_discount',
  totalDiscountPercentage: 'cart.discount_percentage',
  discountPercentage: 'cart.discount_percentage',
  quantity: 'cart.quantity',
  totalQuantity: 'cart.quantity',
  itemCount: 'cart.lines',
  count: 'cart.lines',
  currency: 'cart.currency',
  discountCode: 'cart.coupons.0',
  hasItems: { show: 'cart.lines' },
  isEmpty: { show: '!cart.lines' },
  hasDiscounts: { show: 'cart.total_discount > 0' },
  hasCoupon: { show: 'cart.coupons' },
  hasFreeShipping: { show: 'cart.shipping_method.price == 0' },
  isFreeShipping: { show: 'cart.shipping_method.price == 0' },
};

const SHIPPING = {
  name: 'cart.shipping_method.name',
  code: 'cart.shipping_method.code',
  cost: 'cart.shipping_method.price',
  price: 'cart.shipping_method.price',
  isFree: { show: 'cart.shipping_method.price == 0' },
};

const ADDRESS_PARTS = {
  line1: 'line1',
  line2: 'line2',
  city: 'city',
  state: 'state',
  postcode: 'postcode',
  zip: 'postcode',
  country: 'country',
  phone: 'phone',
};

const ORDER = {
  number: 'order.number',
  refId: 'order.ref_id',
  ref_id: 'order.ref_id',
  currency: 'order.currency',
  total: 'order.total',
  shipping: 'order.shipping_method.price',
  tax: 'order.tax',
  discounts: 'order.total_discount',
  itemCount: 'order.lines',
  shippingMethod: 'order.shipping_method.name',
  shippingAddress: 'order.shipping_address',
  billingAddress: 'order.billing_address',
  hasItems: { show: 'order.lines' },
  isEmpty: { show: '!order.lines' },
  hasTax: { show: 'order.tax > 0' },
  hasShipping: { show: 'order.shipping_method.price > 0' },
  hasDiscounts: { show: 'order.total_discount > 0' },
  supportsUpsells: { show: 'order.supports_upsells' },
};
const PEOPLE = { firstName: 'first_name', lastName: 'last_name', email: 'email', phone: 'phone' };

/**
 * A 0.5 display path as the path it is now, given the page's selectors and cards. `undefined`
 * when there is no such field (a compare-at price, a value with no v2 field yet).
 * @param {string} path
 * @param {{ card?: { selector: string, card: string }, packageId?: string, toggle?: string, page: Page }} ctx
 * @returns {string | { show: string } | undefined}
 */
function mapPath(path, ctx) {
  const parts = path.replace(/\(\)$/, '').split('.');
  const [root, second = '', ...rest] = parts;
  const prefixed = (prefix, v) =>
    v === undefined
      ? undefined
      : typeof v === 'string'
        ? `${prefix}${v}`
        : { show: v.show.replace(/(^!?)/, `$1${prefix}`).replace(/ (&&|\|\|) /g, ` $1 ${prefix}`) };
  if (parts.length === 1) {
    if (ctx.card) return prefixed(`selector.${ctx.card.selector}.options.${ctx.card.card}.`, OPTION_PROPS[root]);
    if (ctx.toggle) return prefixed(`selector.bump-${ctx.toggle}.`, OPTION_PROPS[root]);
    if (ctx.packageId) return prefixed(`package.${ctx.packageId}.`, PACKAGE_PROPS[root]);
    return CART[root];
  }
  switch (root) {
    case 'cart':
      return parts.length === 2 ? CART[second] : undefined;
    case 'shipping':
      return SHIPPING[second];
    case 'campaign':
    case 'param':
      return path;
    case 'package': {
      const explicit = /^\d+$/.test(second);
      const id = explicit ? second : ctx.packageId;
      const prop = explicit ? rest.join('.') : [second, ...rest].join('.');
      return id ? prefixed(`package.${id}.`, PACKAGE_PROPS[prop]) : undefined;
    }
    case 'bundle': {
      const prop = OPTION_PROPS[rest.join('.')];
      const card = ctx.page.cards.get(second);
      if (card) return prefixed(`selector.${card}.options.${second}.`, prop);
      if (ctx.page.selectors.has(second)) return prefixed(`selector.${second}.`, prop);
      return undefined;
    }
    case 'toggle':
      return prefixed(`selector.bump-${second}.`, OPTION_PROPS[rest.join('.')]);
    case 'order': {
      if (second === 'customer' || second === 'user') {
        const field = PEOPLE[rest[0] ?? ''];
        return field ? `order.user.${field}` : undefined;
      }
      if ((second === 'shippingAddress' || second === 'billingAddress') && rest.length) {
        const part = ADDRESS_PARTS[rest[0]];
        return part ? `order.${second === 'shippingAddress' ? 'shipping' : 'billing'}_address.${part}` : undefined;
      }
      return rest.length ? undefined : ORDER[second];
    }
    default:
      return undefined;
  }
}

/** A 0.5 condition as a v2 one, or `undefined`. */
function mapCondition(source, ctx) {
  const m = /^\s*(!?)\s*([\w.]+?)(?:\(\))?\s*(?:(==|!=)\s*(['"]?)(.*?)\4)?\s*$/.exec(source);
  if (!m) return undefined;
  const [, not, path, op, , literal] = m;
  const mapped = mapPath(path, ctx);
  if (mapped === undefined) return undefined;
  if (typeof mapped === 'object') {
    if (op) return undefined;
    return not ? `!(${mapped.show})` : mapped.show;
  }
  return op ? `${mapped} ${op} ${/^[\w.]+$/.test(literal) ? literal : `'${literal}'`}` : `${not}${mapped}`;
}

// ── Pages ──────────────────────────────────────────────────────────────────────────────────────

/** @typedef {{ cards: Map<string, string>, selectors: Set<string>, kept: Set<string>, offerKept?: string, notes: string[] }} Page */

const json = (raw) => {
  try {
    return JSON.parse(raw ?? '');
  } catch {
    return undefined;
  }
};

const FIELDS = {
  fname: 'first_name',
  lname: 'last_name',
  address1: 'line1',
  address2: 'line2',
  province: 'state',
  postal: 'postcode',
  phone_number: 'phone',
  phone: 'phone',
};
const KEEP_FIELDS = new Set([
  'email',
  'first_name',
  'phone',
  'last_name',
  'country',
  'line1',
  'line2',
  'city',
  'state',
  'postcode',
  'accepts_marketing',
]);

/**
 * Rewrites one element. `stack` holds its ancestors (nearest last), each with its 0.5 attributes
 * as they were.
 * @param {string} name @param {Tag} tag @param {Array<{ name: string, attrs: Map<string, string | undefined> }>} stack @param {Page} page
 */
function rewrite(name, tag, stack, page) {
  const up = (attr) => [...stack].reverse().find((s) => s.attrs.has(attr));
  const cardEl = tag.has('data-next-bundle-card') ? undefined : up('data-next-bundle-card');
  const ctx = {
    page,
    card: cardEl && {
      card: cardEl.attrs.get('data-next-bundle-id') ?? '',
      selector: cardEl.attrs.get('__selector') ?? 'default',
    },
    toggle: up('data-next-toggle-card')?.attrs.get('data-next-package-id'),
    packageId: up('data-next-package-id')?.attrs.get('data-next-package-id'),
  };
  const note = (what) => page.notes.push(what);
  const selectorOf = (attrs) =>
    attrs.has('data-next-bundle-selector') ? (attrs.get('data-next-selector-id') ?? 'default') : undefined;
  const keptId = [
    selectorOf(new Map(tag.attrs.map((a) => [a.name, a.value]))),
    ...stack.map((s) => selectorOf(s.attrs)),
    tag.get('data-next-selector-id'),
    tag.get('data-next-bundle-slots-for'),
    tag.get('data-next-bundle-qty-for'),
  ].find((id) => id !== undefined && page.kept.has(id));
  if (keptId !== undefined || (page.offerKept && (tag.has('data-next-upsell') || up('data-next-upsell'))))
    return note(
      `selector "${keptId ?? page.offerKept}" and what reads it stay on the earlier attributes (variant slots have no v2 form here)`,
    );
  const inTemplate = stack.some(
    (s) => s.name === 'template' || s.attrs.has('data-next-cart-summary') || s.attrs.has('data-next-order-items'),
  );

  if (tag.has('data-next-bundle-selector')) {
    const id = tag.get('data-next-selector-id') ?? 'default';
    tag.remove('data-next-bundle-selector');
    if (tag.has('data-next-selector-id')) tag.rename('data-next-selector-id', 'data-next-selector');
    else tag.set('data-next-selector', id);
    if (tag.get('data-next-selection-mode') === 'select')
      tag.rename('data-next-selection-mode', 'data-next-defer', undefined);
    else tag.remove('data-next-selection-mode');
    tag.remove('data-next-upsell-context');
  }

  if (tag.has('data-next-bundle-card')) {
    const items = json(tag.get('data-next-bundle-items'));
    const id = tag.get('data-next-bundle-id');
    if (!Array.isArray(items) || !id) {
      note(`a bundle card without ${id ? 'readable data-next-bundle-items' : 'data-next-bundle-id'} stays as it is`);
      return;
    }
    tag.remove('data-next-bundle-card');
    tag.rename('data-next-bundle-id', 'data-next-option');
    tag.rename(
      'data-next-bundle-items',
      'data-next-items',
      items.map((i) => (Number(i.quantity ?? 1) === 1 ? `${i.packageId}` : `${i.packageId}x${i.quantity}`)).join(', '),
    );
    if (items.some((i) => i.configurable)) tag.set('data-next-slots', undefined);
    const vouchers = json(tag.get('data-next-bundle-vouchers'));
    if (Array.isArray(vouchers)) tag.rename('data-next-bundle-vouchers', 'data-next-vouchers', vouchers.join(', '));
  }

  if (tag.has('data-next-toggle-card')) {
    const id = tag.get('data-next-package-id');
    const sync = ['data-next-package-sync', 'data-next-product-sync', 'data-next-is-upsell'].filter((a) => tag.has(a));
    if (!id || sync.length) {
      note(
        `order bump ${id ?? '?'} stays on data-next-toggle-card${sync.length ? ` (${sync.join(', ')} have no v2 form)` : ''}`,
      );
    } else {
      const qty = tag.get('data-next-quantity');
      tag.remove('data-next-toggle-card');
      tag.set('data-next-option', `bump-${id}`);
      tag.set('data-next-items', qty && qty !== '1' ? `${id}x${qty}` : id);
      tag.remove('data-next-package-id');
      tag.remove('data-next-quantity');
    }
  }

  if (tag.has('data-next-selected') && !tag.has('data-next-bundle-card') && !tag.has('data-next-toggle-card')) {
    if (tag.get('data-next-selected') === 'false') tag.remove('data-next-selected');
    else if (tag.get('data-next-selected') === 'true') tag.set('data-next-selected', undefined);
  }

  const optionProp = (attr, base) => {
    const prop = tag.get(attr);
    if (prop === undefined) return;
    const mapped = OPTION_PROPS[prop];
    if (!base || mapped === undefined) return note(`${attr}="${prop}" stays as it is`);
    if (typeof mapped === 'object') tag.rename(attr, 'data-next-show', mapped.show.replace(/^(!?)/, `$1${base}`));
    else tag.rename(attr, 'data-next-query', `${base}${mapped}`);
  };
  const bump =
    ctx.toggle && !up('data-next-toggle-card')?.attrs.get('__kept') ? `selector.bump-${ctx.toggle}.` : undefined;
  if (tag.has('data-next-bundle-display'))
    optionProp('data-next-bundle-display', ctx.card && `selector.${ctx.card.selector}.options.${ctx.card.card}.`);
  if (tag.has('data-next-toggle-display')) optionProp('data-next-toggle-display', bump);
  if (tag.has('data-next-toggle-image') && bump) {
    tag.remove('data-next-toggle-image');
    tag.set('data-next-query', `${bump}lines.0.image`);
  }

  for (const attr of ['data-next-show', 'data-next-hide']) {
    if (!tag.has(attr) || inTemplate) continue;
    const source = tag.get(attr) ?? '';
    if (/[a-z0-9]_[a-z0-9]|^[!\s(]*(selector|checkout|errors)\./.test(source) && !/[A-Z]/.test(source)) continue;
    const mapped = mapCondition(source, ctx);
    if (mapped === undefined) note(`${attr}="${source}" stays as it is`);
    else tag.set(attr, mapped);
  }
  if (tag.has('data-next-display') && !inTemplate) {
    const path = tag.get('data-next-display') ?? '';
    const mapped = mapPath(path, ctx);
    if (mapped === undefined) note(`data-next-display="${path}" stays as it is (no v2 field)`);
    else if (typeof mapped === 'object') tag.rename('data-next-display', 'data-next-show', mapped.show);
    else tag.rename('data-next-display', 'data-next-query', mapped);
  }

  if (tag.get('data-next-action') === 'add-to-cart') {
    tag.set('data-next-action', 'addItem');
    if (tag.get('data-next-clear-cart') === 'true') tag.rename('data-next-clear-cart', 'data-next-replace', undefined);
    else tag.remove('data-next-clear-cart');
    tag.rename('data-next-url', 'data-next-go');
  }

  const step = tag.get('data-next-quantity');
  if ((step === 'increase' || step === 'decrease') && !inTemplate) {
    const by = tag.get('data-step') ?? '1';
    tag.set('data-next-action', 'setQuantity');
    tag.set('data-next-quantity', `${step === 'increase' ? '+' : '-'}${by}`);
    tag.remove('data-step');
    tag.rename('data-min', 'data-next-min-quantity');
    tag.rename('data-max', 'data-next-max-quantity');
    if (!tag.has('data-next-package-id') && ctx.packageId) tag.set('data-next-package-id', ctx.packageId);
  }
  if (tag.has('data-next-remove-item') && !inTemplate) {
    tag.remove('data-next-remove-item');
    tag.set('data-next-action', 'removeItem');
    if (!tag.has('data-next-package-id') && ctx.packageId) tag.set('data-next-package-id', ctx.packageId);
  }

  if (tag.has('data-next-bundle-qty-for'))
    tag.rename('data-next-bundle-qty-for', 'data-next-for', `selector.${tag.get('data-next-bundle-qty-for')}`);
  for (const [attr, delta] of [
    ['data-next-quantity-increase', '+1'],
    ['data-next-quantity-decrease', '-1'],
  ]) {
    if (!tag.has(attr)) continue;
    tag.remove(attr);
    tag.set('data-next-action', 'setQuantity');
    tag.set('data-next-quantity', delta);
    if (ctx.card) tag.set('data-next-selector-id', ctx.card.selector);
  }
  if (tag.has('data-next-quantity-display')) {
    tag.remove('data-next-quantity-display');
    tag.set('data-next-query', ctx.card ? `selector.${ctx.card.selector}.quantity` : 'quantity');
  }

  if (tag.has('data-next-upsell') && tag.get('data-next-upsell') !== undefined) {
    const id = tag.get('data-next-package-id');
    if (id) {
      const qty = tag.get('data-next-quantity');
      tag.remove('data-next-upsell');
      tag.set('data-next-option', `offer-${id}`);
      tag.set('data-next-items', qty && qty !== '1' ? `${id}x${qty}` : id);
      tag.remove('data-next-package-id');
      tag.remove('data-next-quantity');
    } else {
      tag.remove('data-next-upsell');
      tag.set('__offer', page.offerSelector ?? undefined);
    }
  }
  const upsellAction = tag.get('data-next-upsell-action');
  if (upsellAction !== undefined) {
    const accept = upsellAction === 'add' || upsellAction === 'accept';
    tag.remove('data-next-upsell-action');
    tag.set('data-next-action', accept ? 'acceptUpsell' : 'skipUpsell');
    for (const old of ['data-next-url', 'data-next-next-url', 'data-os-next-url']) tag.rename(old, 'data-next-go');
    const offer = up('__offer');
    const selector = offer?.attrs.get('__offer');
    if (selector) tag.set('data-next-selector-id', selector);
    const meta = accept ? page.metas.accept : page.metas.decline;
    if (!tag.has('data-next-go') && meta) tag.set('data-next-go', meta);
  }

  const field = tag.get('data-next-checkout-field');
  if (field !== undefined && !stack.some((s) => s.attrs.get('data-next-component')?.includes('billing'))) {
    const key = FIELDS[field] ?? field;
    const v2 = KEEP_FIELDS.has(key)
      ? key
      : field === 'cc-number'
        ? 'card.number'
        : field === 'cvv'
          ? 'card.cvv'
          : undefined;
    if (v2) tag.rename('data-next-checkout-field', 'data-next-field', v2);
    else note(`data-next-checkout-field="${field}" stays as it is`);
    if (tag.get('data-next-required') === 'true') tag.rename('data-next-required', 'required', undefined);
  }
  if (name === 'form' && tag.has('data-next-checkout')) {
    const next = tag.get('data-next-checkout-step');
    if (next) {
      tag.remove('data-next-checkout-step');
      tag.set('data-next-step', undefined);
      tag.set('data-next-go', next);
    } else if (page.metas.success && !tag.has('data-next-go')) tag.set('data-next-go', page.metas.success);
  }
  if (tag.get('data-next-express-checkout') === 'container')
    tag.rename('data-next-express-checkout', 'data-next-express', undefined);

  if (tag.has('data-next-coupon'))
    note('data-next-coupon stays as it is (v2: form[data-next-action="applyCoupon"] with data-next-field="code")');
  if (tag.has('data-next-cart-summary'))
    note('data-next-cart-summary stays as it is (v2: data-next-each="cart.lines")');
  if (tag.has('data-next-order-items')) note('data-next-order-items stays as it is (v2: data-next-each="order.lines")');
  if (tag.has('data-next-payment-method'))
    note(`data-next-payment-method="${tag.get('data-next-payment-method')}" stays as it is (v2: data-next-payment)`);
}

const CSS = [
  ['data-next-bundle-selector', 'data-next-selector'],
  ['data-next-bundle-card', 'data-next-option'],
  ['data-next-toggle-card', 'data-next-option'],
  ['data-next-checkout-field', 'data-next-field'],
  ['data-next-express-checkout="container"', 'data-next-express'],
];

/** Attribute selectors renamed in a stylesheet. @param {string} css */
export function migrateCss(css) {
  return CSS.reduce((s, [from, to]) => s.replaceAll(`[${from}`, `[${to}`), css);
}

const meta = (html, name) =>
  new RegExp(`<meta\\s+name=["']${name}["']\\s+content=["']([^"']*)["'][^>]*>`, 'i').exec(html)?.[1];

/**
 * Rewrites a page. Returns the new HTML and what it left on the earlier attributes.
 * @param {string} html
 * @returns {{ html: string, notes: string[] }}
 */
export function migrate(html) {
  /** @type {Page & { metas: Record<string, string | undefined>, offerSelector?: string }} */
  const page = {
    cards: new Map(),
    selectors: new Set(),
    kept: new Set(),
    notes: [],
    metas: {
      success: meta(html, 'next-success-url') ?? meta(html, 'next-next-url') ?? meta(html, 'os-next-page'),
      accept: meta(html, 'next-upsell-accept-url'),
      decline: meta(html, 'next-upsell-decline-url'),
    },
  };
  // First pass: which ids are selectors and which are cards, for bundle.<id> paths.
  const stack0 = [];
  for (const m of html.matchAll(TOKEN)) {
    const [whole, , name, raw = '', self] = m;
    if (!name) continue;
    const tagName = name.toLowerCase();
    if (whole.startsWith('</')) {
      const at = stack0.map((s) => s.name).lastIndexOf(tagName);
      if (at >= 0) stack0.length = at;
      continue;
    }
    const attrs = new Map(parseAttrs(raw).map((a) => [a.name, a.value]));
    if (attrs.has('data-next-bundle-selector')) {
      const id = attrs.get('data-next-selector-id') ?? 'default';
      page.selectors.add(id);
      if (attrs.has('data-next-bundle-slot-template-id') || attrs.has('data-next-bundle-slot-template'))
        page.kept.add(id);
      page.offerSelector ??= [...stack0].reverse().some((s) => s.attrs.has('data-next-upsell')) ? id : undefined;
    }
    if (attrs.has('data-next-bundle-card')) {
      const selector = [...stack0].reverse().find((s) => s.attrs.has('data-next-bundle-selector'));
      page.cards.set(attrs.get('data-next-bundle-id') ?? '', selector?.attrs.get('data-next-selector-id') ?? 'default');
    }
    if (attrs.has('data-next-bundle-slots-for')) page.kept.add(attrs.get('data-next-bundle-slots-for') ?? 'default');
    if (!VOID.has(tagName) && !self) stack0.push({ name: tagName, attrs });
  }
  for (const id of page.kept) page.selectors.delete(id);
  for (const [card, selector] of page.cards) if (page.kept.has(selector)) page.cards.delete(card);
  if (page.offerSelector && page.kept.has(page.offerSelector)) page.offerKept = page.offerSelector;

  const stack = [];
  const out = html.replace(TOKEN, (whole, raw0, name, raw = '', self) => {
    if (raw0 === 'style')
      return whole.replace(/(<style\b[^>]*>)([\s\S]*)(<\/style\s*>)/i, (_, a, css, b) => `${a}${migrateCss(css)}${b}`);
    if (!name) return whole;
    const tagName = name.toLowerCase();
    if (whole.startsWith('</')) {
      const at = stack.map((s) => s.name).lastIndexOf(tagName);
      if (at >= 0) stack.length = at;
      return whole;
    }
    if (
      tagName === 'meta' &&
      /name=["'](next-success-url|next-upsell-accept-url|next-upsell-decline-url)["']/i.test(whole)
    )
      return whole;
    const attrs = parseAttrs(raw);
    const before = new Map(attrs.map((a) => [a.name, a.value]));
    if (before.has('data-next-bundle-card')) {
      const selector = [...stack].reverse().find((s) => s.attrs.has('data-next-bundle-selector'));
      before.set('__selector', selector?.attrs.get('data-next-selector-id') ?? 'default');
    }
    const tag = new Tag(attrs);
    rewrite(tagName, tag, stack, page);
    if (before.has('data-next-toggle-card') && tag.has('data-next-toggle-card')) before.set('__kept', '1');
    const offer = tag.get('__offer');
    if (tag.has('__offer')) {
      tag.remove('__offer');
      before.set('__offer', offer);
    }
    if (!VOID.has(tagName) && !self) stack.push({ name: tagName, attrs: before });
    return tag.changed ? `<${name}${renderAttrs(tag.attrs)}${self ? ' /' : ''}>` : whole;
  });
  return { html: out, notes: [...new Set(page.notes)] };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  for (const file of args.filter((a) => a !== '--write')) {
    const source = readFileSync(file, 'utf8');
    const result = file.endsWith('.css') ? { html: migrateCss(source), notes: [] } : migrate(source);
    const changed = result.html !== source;
    console.log(`${file}: ${changed ? (write ? 'rewritten' : 'would change') : 'nothing to change'}`);
    for (const n of result.notes) console.log(`  · ${n}`);
    if (write && changed) writeFileSync(file, result.html);
  }
}
