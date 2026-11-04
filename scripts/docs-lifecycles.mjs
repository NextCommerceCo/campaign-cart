// @ts-check
/**
 * Draws each Event Reference group's lifecycle as a top-down SVG next to its `lifecycle.md`, in
 * the docs site's own colors so it follows the light and dark theme. The flows are written below;
 * run `npm run docs:lifecycles` after changing one and commit the SVGs. The tables in each
 * `lifecycle.md` say the same in text.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'docs/guides/event-reference');
const C = {
  fg: 'var(--clean-fg, #111827)',
  muted: 'var(--clean-fg-muted, #6b7280)',
  fill: 'var(--clean-bg-muted, #f4f6f9)',
  neutral: 'var(--clean-border, #d7dce5)',
  active: 'var(--clean-accent, #2563eb)',
  success: 'var(--color-emerald-500, #10b981)',
  failure: 'var(--color-rose-500, #e11d48)',
  waiting: 'var(--color-amber-500, #f59e0b)',
  code: 'var(--clean-accent, #2563eb)',
};
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Rows of the main column and the side column.
const MAIN = { x: 220, w: 220, cx: 330 };
const SIDE = { x: 540, w: 160, cx: 620 };
let ROWS;
const rowY = (i) => ROWS?.[i] ?? 16 + i * 180;
const H = 58;

function box({ col = 'main', row, title, sub = [], tone = 'neutral' }) {
  const c = col === 'main' ? MAIN : SIDE;
  const y = rowY(row);
  const h = H + Math.max(0, sub.length - 1) * 15;
  const lines = sub
    .map(
      (s, i) =>
        `<text x="${c.cx}" y="${y + 45 + i * 15}" style="fill: ${s.code ? C.code : C.muted}; font-size: 12px${s.code ? '; font-family: var(--clean-font-mono, ui-monospace, monospace)' : ''}">${esc(s.text ?? s)}</text>`,
    )
    .join('\n    ');
  return {
    h,
    svg: `<rect x="${c.x}" y="${y}" width="${c.w}" height="${h}" rx="10" style="fill: ${C.fill}; stroke: ${C[tone]}; stroke-width: 1.5" />
    <text x="${c.cx}" y="${y + 25}" style="fill: ${C.fg}; font-size: 16px; font-weight: 600">${esc(title)}</text>
    ${lines}`,
  };
}

const label = (x, y, text, { anchor = 'start', code = false, size } = {}) =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" style="fill: ${code ? C.code : C.fg}; font-size: ${size ?? (code ? 12 : 13)}px${code ? '; font-family: var(--clean-font-mono, ui-monospace, monospace)' : ''}">${esc(text)}</text>`;

/** A labelled arrow: `d` is the path, `labels` are [x, y, text, options]. */
const arrow = (d, { dashed = false } = {}) =>
  `<path d="${d}" marker-end="url(#ARROW)" style="fill: none; stroke: ${C.muted}; stroke-width: 1.5${dashed ? '; stroke-dasharray: 5 4' : ''}" />`;

// Standard pieces, in the coordinates above.
const down = (from, to, title, events = [], { boxH = H } = {}) => {
  const y1 = rowY(from) + boxH;
  const y2 = rowY(to) - 6;
  const mid = (y1 + y2) / 2 - (events.length * 17) / 2;
  return [
    arrow(`M${MAIN.cx} ${y1} V${y2}`),
    label(MAIN.cx + 14, mid, title),
    ...events.map((e, i) => label(MAIN.cx + 14, mid + 20 + i * 17, e, { code: true })),
  ];
};
const toSide = (row, title) => {
  const y = rowY(row) + 18;
  return [
    arrow(`M${MAIN.x + MAIN.w} ${y} H${SIDE.x - 6}`),
    label((MAIN.x + MAIN.w + SIDE.x) / 2, y - 8, title, { anchor: 'middle', size: 12 }),
  ];
};
const fromSide = (row, title) => {
  const y = rowY(row) + 42;
  return [
    arrow(`M${SIDE.x} ${y} H${MAIN.x + MAIN.w + 6}`, { dashed: true }),
    label((MAIN.x + MAIN.w + SIDE.x) / 2, y + 19, title, { anchor: 'middle', size: 12 }),
  ];
};
const loopUp = (from, to, title, events = [], { x = 170, fromH = H } = {}) => {
  const y1 = rowY(from) + fromH / 2;
  const y2 = rowY(to) + 29;
  const mid = (y1 + y2) / 2 - (events.length * 17) / 2;
  return [
    arrow(`M${MAIN.x} ${y1} H${x} V${y2} H${MAIN.x - 6}`, { dashed: true }),
    label(x - 12, mid, title, { anchor: 'end' }),
    ...events.map((e, i) => label(x - 12, mid + 20 + i * 17, e, { anchor: 'end', code: true })),
  ];
};

/** Each `[action, result]` error is a line under the drawing: `sdk.error · action → result`. */
function svg(name, { title, desc, rows, boxes, parts, note, errors = [] }) {
  const top = rowY(rows - 1) + 58 + 34;
  const lines = [
    ...(note ? [`<tspan style="fill: ${C.muted}">${esc(note)}</tspan>`] : []),
    ...errors.map(
      ([action, result]) =>
        `<tspan style="fill: ${C.failure}; font-family: var(--clean-font-mono, ui-monospace, monospace)">sdk.error · ${esc(action)}</tspan><tspan style="fill: ${C.muted}"> → ${esc(result)}</tspan>`,
    ),
  ];
  const height = top + (lines.length ? lines.length * 20 - 6 : -18);
  const id = `${name}-lifecycle`;
  const drawn = boxes.map((b) => box(b).svg).join('\n    ');
  const body = parts().flat().join('\n    ').replaceAll('#ARROW', `#${id}-arrow`);
  const footer = lines
    .map(
      (line, i) => `\n  <text x="360" y="${top + i * 20}" text-anchor="middle" style="font-size: 12px">${line}</text>`,
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 ${height}" width="720" height="${height}" role="img" aria-labelledby="${id}-title ${id}-desc" style="font-family: var(--clean-font-body, system-ui, sans-serif)">
  <title id="${id}-title">${esc(title)}</title>
  <desc id="${id}-desc">${esc(desc)}</desc>
  <defs>
    <marker id="${id}-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" style="fill: ${C.muted}" />
    </marker>
  </defs>
  <g>
    ${body}
  </g>
  <g text-anchor="middle">
    ${drawn}
  </g>${footer}
</svg>
`;
}

const code = (text) => ({ text, code: true });

const LIFECYCLES = {
  carts: {
    title: 'Cart lifecycle',
    desc: 'empty, then calculating after a package is added (cart.updated, cart.calculating), then priced when the prices arrive (cart.removed, cart.added, cart.calculated). Pricing that fails moves calculating to unpriced (sdk.error); the next change goes back to calculating. A change to a priced cart goes back to calculating (cart.updated, cart.calculating). Removing the last package empties the cart from any state (cart.updated, cart.removed).',
    rows: 3,
    boxes: [
      { row: 0, title: 'empty', sub: ['no lines'] },
      { row: 1, title: 'calculating', sub: ['prices on the way'], tone: 'active' },
      { row: 2, title: 'priced', sub: ['the cart carries prices'], tone: 'success' },
      {
        col: 'side',
        row: 1,
        title: 'unpriced',
        sub: [code('cart.calculate')],
        tone: 'failure',
      },
    ],
    parts: () => [
      down(0, 1, 'add a package', ['cart.updated', 'cart.calculating']),
      down(1, 2, 'prices arrive', ['cart.removed · cart.added', 'cart.calculated']),
      toSide(1, 'pricing fails'),
      fromSide(1, 'next change'),
      loopUp(2, 1, 'a change', ['cart.updated', 'cart.calculating']),
    ],
    note: 'From any state, removing the last package empties the cart: cart.updated · cart.removed',
    errors: [['cart.calculate', 'unpriced; the summary keeps its earlier totals']],
  },
  sdk: {
    title: 'SDK lifecycle',
    desc: "starting, then ready once the campaign is in, from the tab's copy or the API (sdk.ready, once). When the campaign cannot load and the tab has no copy, the SDK stops at failed (sdk.error with action load) and never sends sdk.ready. Once ready, an action that fails sends sdk.error and the SDK stays ready.",
    rows: 2,
    boxes: [
      { row: 0, title: 'starting', sub: ['loading the campaign'] },
      { row: 1, title: 'ready', sub: ['values are on the page'], tone: 'success' },
      { col: 'side', row: 0, title: 'failed', sub: [code('campaign.load')], tone: 'failure' },
    ],
    parts: () => [down(0, 1, 'the campaign is in', ['sdk.ready']), toSide(0, 'no campaign')],
    note: 'Once ready, a failed step sends sdk.error and the SDK stays ready',
    errors: [
      ['campaign.load', 'failed, when the tab has no copy of the campaign'],
      ['storage.write', 'works on without saving across pages'],
    ],
  },
  selectors: {
    title: 'Selector lifecycle',
    desc: "A selector is registered and its first option picked (selector.selected), then calculating the options that have no price yet (selector.calculating), then priced (selector.calculated). When every option already has a price from the last 10 minutes it goes straight to priced (selector.calculated). Pricing that fails moves calculating to unpriced (sdk.error) and the options show package prices. Changing the picked option's quantity or a slot sends selector.selected and calculates again.",
    rows: 3,
    boxes: [
      { row: 0, title: 'picked', sub: [code('selector.selected')] },
      { row: 1, title: 'calculating', sub: ['prices on the way'], tone: 'active' },
      { row: 2, title: 'priced', sub: ['every option has a price'], tone: 'success' },
      { col: 'side', row: 1, title: 'unpriced', sub: [code('selector.calculate')], tone: 'failure' },
    ],
    parts: () => [
      down(0, 1, 'options need a price', ['selector.calculating']),
      down(1, 2, 'prices arrive', ['selector.calculated']),
      toSide(1, 'pricing fails'),
      loopUp(2, 1, 'quantity changes', ['selector.selected', 'selector.calculating']),
      [
        arrow(`M${MAIN.x + MAIN.w} ${rowY(0) + 29} H712 V${rowY(2) + 29} H${MAIN.x + MAIN.w + 6}`, { dashed: true }),
        label(700, rowY(2) - 4, 'all prices cached', { anchor: 'end', size: 12 }),
        label(700, rowY(2) + 13, 'selector.calculated', { anchor: 'end', code: true }),
      ],
    ],
    note: 'A toggle sends selector.selected when switched on and selector.deselected when switched off',
    errors: [['selector.calculate', 'unpriced; the options show package prices']],
  },
  coupons: {
    title: 'Coupon lifecycle',
    desc: 'A code is entered and checked against the cart. When it takes money off, or the cart is still empty, it is applied (coupon.applied, then cart.updated). When it takes nothing off it is denied (coupon.denied) and not kept. A code applied to an empty cart is checked after the first price and denied then if it takes nothing off (coupon.denied, cart.updated). Removing an applied code sends coupon.removed.',
    rows: 3,
    boxes: [
      { row: 0, title: 'entered', sub: ['checked against the cart'] },
      { row: 1, title: 'applied', sub: [code('coupon.applied')], tone: 'success' },
      { row: 2, title: 'removed', sub: [code('coupon.removed')] },
      { col: 'side', row: 0, title: 'denied', sub: [code('coupon.denied')], tone: 'failure' },
    ],
    parts: () => [
      down(0, 1, 'takes money off, or the cart is empty', ['cart.updated']),
      down(1, 2, 'removed', ['cart.updated']),
      toSide(0, 'no discount'),
      [
        arrow(`M${MAIN.x + MAIN.w} ${rowY(1) + 29} H${SIDE.cx} V${rowY(0) + H + 6}`, { dashed: true }),
        label(SIDE.cx - 12, rowY(1) - 10, 'checked after the', { anchor: 'end', size: 12 }),
        label(SIDE.cx - 12, rowY(1) + 6, 'first price', { anchor: 'end', size: 12 }),
      ],
    ],
    errors: [['coupon.check', 'the code is not applied; applyCoupon resolves false']],
  },
  checkout: {
    title: 'Checkout lifecycle',
    rowYs: [16, 196, 436, 616],
    desc: 'The checkout form opens with a cart (checkout.started). While the shopper fills it, user.entered, user.updated, address.entered, address.updated, shipping.selected and payment.selected arrive in any order. A submit that fails its checks sends checkout.submitted with valid false and goes back to filling. A submit that passes sends checkout.submitted with valid true and places the order, with the cart frozen. order.created moves to placed and empties the cart without cart events, unless the shopper pays at a payment gateway; order.failed goes back to filling.',
    rows: 4,
    boxes: [
      { row: 0, title: 'open', sub: [code('checkout.started')] },
      {
        row: 1,
        title: 'filling',
        sub: [
          'user.entered',
          'user.updated',
          'address.entered',
          'address.updated',
          'shipping.selected',
          'payment.selected',
        ].map(code),
        tone: 'active',
      },
      { row: 2, title: 'placing', sub: ['the cart is frozen'], tone: 'waiting' },
      { row: 3, title: 'placed', sub: ['next page, or a payment gateway'], tone: 'success' },
      { col: 'side', row: 1, title: 'stopped', sub: [code('valid: false')], tone: 'failure' },
    ],
    parts: () => [
      down(0, 1, 'the shopper fills the form'),
      down(1, 2, 'a submit passes its checks', ['checkout.submitted'], { boxH: H + 75 }),
      down(2, 3, 'the order is created', ['order.created']),
      toSide(1, 'a check fails'),
      fromSide(1, 'fix and submit'),
      loopUp(2, 1, 'refused', ['order.create', 'order.failed']),
    ],
    note: 'A created order empties the cart without cart events, unless the shopper pays at a payment gateway',
    errors: [
      ['user.save', 'no Open Cart yet; tried again on the next field'],
      ['address.rules', 'the campaign countries and simpler checks'],
      ['address.autocomplete', 'no address suggestions'],
      ['order.create', 'refused: back to filling, with order.failed'],
    ],
  },
  orders: {
    title: 'Order lifecycle',
    desc: 'order.created on the checkout page. Paid at once, the next page loads the order (order.loaded, with purchase the first time). When the order is paid at a payment gateway, the shopper comes back: paid, the order page loads it (order.loaded) and the cart kept for the gateway is emptied; failed, the failure page sends order.failed with stage payment, then order.loaded without purchase, and the cart is kept.',
    rows: 3,
    boxes: [
      { row: 0, title: 'created', sub: [code('order.created')] },
      { row: 1, title: 'at the gateway', sub: ['the shopper pays'], tone: 'waiting' },
      { row: 2, title: 'loaded', sub: [code('order.loaded')], tone: 'success' },
      {
        col: 'side',
        row: 2,
        title: 'payment failed',
        sub: [code('order.failed'), code("stage: 'payment'")],
        tone: 'failure',
      },
    ],
    parts: () => [
      down(0, 1, 'payment_complete_url'),
      down(1, 2, 'paid: the order page'),
      [label(MAIN.cx + 14, rowY(1) + 136, 'empties the gateway cart', { size: 12 })],
      [
        arrow(`M${MAIN.x} ${rowY(0) + 29} H120 V${rowY(2) + 29} H${MAIN.x - 6}`),
        label(108, rowY(1) + 20, 'paid at once:', { anchor: 'end' }),
        label(108, rowY(1) + 38, 'the next page', { anchor: 'end' }),
      ],
      [
        arrow(`M${MAIN.x + MAIN.w} ${rowY(1) + 29} H${SIDE.cx} V${rowY(2) - 6}`),
        label(SIDE.cx + 12, rowY(1) + 80, 'payment fails', { size: 12 }),
      ],
    ],
    note: 'purchase comes once, when a paid order first loads · a failed gateway payment is not an sdk.error',
    errors: [['order.load', 'the page has no order values']],
  },
  upsells: {
    title: 'Upsell lifecycle',
    desc: 'An offer is shown (upsell.viewed). Accepting it adds it to the order: upsell.accepted with the updated order, then the next page. Skipping it sends upsell.skipped and moves on. When adding the offer fails, such as a decline, upsell.failed is sent and the shopper can accept again. An offer already accepted on that page is not charged again.',
    rows: 3,
    boxes: [
      { row: 0, title: 'shown', sub: [code('upsell.viewed')] },
      { row: 1, title: 'adding', sub: ['the offer is posted'], tone: 'active' },
      { row: 2, title: 'accepted', sub: [code('upsell.accepted')], tone: 'success' },
      { col: 'side', row: 0, title: 'skipped', sub: [code('upsell.skipped')] },
      { col: 'side', row: 1, title: 'failed', sub: [code('upsell.add'), code('upsell.failed')], tone: 'failure' },
    ],
    parts: () => [
      down(0, 1, 'accept'),
      down(1, 2, 'added to the order'),
      toSide(0, 'skip'),
      toSide(1, 'refused'),
      fromSide(1, 'accept again'),
    ],
    note: 'An offer already accepted on that page is not charged again',
    errors: [['upsell.add', 'failed, with upsell.failed; the shopper can accept again']],
  },
  promotions: {
    title: 'Promotion lifecycle',
    desc: 'The exit-intent popup waits until the mouse leaves the page (or, on a phone with mobileScrollTrigger, a scroll back up). It opens (promotion.viewed). A click on its image or a template button sends promotion.clicked and closes it. Esc or the overlay sends promotion.closed with reason dismissed; the close button sends it with reason closed. It can open again up to maxTriggers times in the session.',
    rows: 3,
    boxes: [
      { row: 0, title: 'waiting', sub: ['for the shopper to leave'] },
      { row: 1, title: 'open', sub: [code('promotion.viewed')], tone: 'active' },
      { row: 2, title: 'clicked', sub: [code('promotion.clicked')], tone: 'success' },
      { col: 'side', row: 1, title: 'closed', sub: [code('promotion.closed')] },
    ],
    parts: () => [
      down(0, 1, 'the mouse leaves the page'),
      down(1, 2, 'image or button clicked'),
      toSide(1, 'Esc or close'),
    ],
    note: 'It can open again, up to maxTriggers times a session · reason: dismissed (Esc, overlay) or closed',
  },
};

for (const [group, spec] of Object.entries(LIFECYCLES)) {
  ROWS = spec.rowYs;
  const file = `${ROOT}/${group}/${group === 'carts' ? 'cart' : group.replace(/s$/, '')}-lifecycle.svg`;
  writeFileSync(file, svg(group, spec));
}
