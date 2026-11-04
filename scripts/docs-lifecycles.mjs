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
    <text x="${c.cx}" y="${y + 25}" style="fill: ${C.fg}; font-size: ${title.length > 14 ? 14 : 16}px; font-weight: 600">${esc(title)}</text>
    ${lines}`,
  };
}

const label = (x, y, text, { anchor = 'start', code = false, size } = {}) =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" style="fill: ${code ? C.code : C.fg}; font-size: ${size ?? (code ? 12 : 13)}px${code ? '; font-family: var(--clean-font-mono, ui-monospace, monospace)' : ''}">${esc(text)}</text>`;

/** A choice point: the arrow into it splits by a condition. */
const choice = (x, y) =>
  `<path d="M${x} ${y - 12} L${x + 12} ${y} L${x} ${y + 12} L${x - 12} ${y} Z" style="fill: ${C.fill}; stroke: ${C.muted}; stroke-width: 1.5" />`;

/** A label of `[text, code]` parts, such as `no ` and `payment_complete_url`. */
const mixed = (x, y, parts) =>
  `<text x="${x}" y="${y}" style="fill: ${C.fg}; font-size: 13px">${parts
    .map(([text, isCode]) =>
      isCode
        ? `<tspan style="fill: ${C.code}; font-size: 12px; font-family: var(--clean-font-mono, ui-monospace, monospace)">${esc(text)}</tspan>`
        : esc(text),
    )
    .join('')}</text>`;

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
const toSide = (row, title, { dashed = false } = {}) => {
  const y = rowY(row) + 18;
  return [
    arrow(`M${MAIN.x + MAIN.w} ${y} H${SIDE.x - 6}`, { dashed }),
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
const loopUp = (from, to, title, events = [], { x = 170, fromH = H, at = 29 } = {}) => {
  const y1 = rowY(from) + fromH / 2;
  const y2 = rowY(to) + at;
  const mid = (y1 + y2) / 2 - (events.length * 17) / 2;
  return [
    arrow(`M${MAIN.x} ${y1} H${x} V${y2} H${MAIN.x - 6}`, { dashed: true }),
    label(x - 12, mid, title, { anchor: 'end' }),
    ...events.map((e, i) => label(x - 12, mid + 20 + i * 17, e, { anchor: 'end', code: true })),
  ];
};

/** Each `[action, result]` error is a line under the drawing: `sdk.error · action → result`. */
function svg(name, { title, desc, rows, boxes, parts, note, errors = [] }) {
  const top = Math.max(...boxes.map((b) => rowY(b.row) + box(b).h)) + 34;
  const lines = [
    ...[note ?? []].flat().map((line) => `<tspan style="fill: ${C.muted}">${esc(line)}</tspan>`),
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
    desc: 'empty, then calculating after a package is added (cart.updated, cart.calculating), then priced when the prices arrive (cart.removed and cart.added for the packages that changed, then cart.calculated). A page that opens with a saved cart starts at calculating (cart.calculating only). Pricing that fails sends sdk.error and moves to unpriced; the next change prices again. A change sends cart.updated, then cart.calculating; while calculating, cart.updated only. Removing the last package, or clearing the cart, empties it (cart.updated, then cart.removed).',
    rows: 3,
    boxes: [
      { row: 0, title: 'empty', sub: ['no lines'] },
      { row: 1, title: 'calculating', sub: ['prices on the way'], tone: 'active' },
      { row: 2, title: 'priced', sub: ['the cart carries prices'], tone: 'success' },
      { col: 'side', row: 1, title: 'unpriced', sub: [code('sdk.error')], tone: 'failure' },
    ],
    parts: () => [
      down(0, 1, 'add a package', ['cart.updated', 'cart.calculating']),
      down(1, 2, 'prices arrive', ['cart.removed, cart.added', 'cart.calculated']),
      toSide(1, 'pricing fails', { dashed: true }),
      fromSide(1, 'a change'),
      loopUp(2, 1, 'a change', ['cart.updated', 'cart.calculating']),
      [
        arrow(`M60 ${rowY(0) + 20} V${rowY(1) + 14} H${MAIN.x - 6}`),
        label(72, rowY(0) + 34, 'a page opens', { size: 12 }),
        label(72, rowY(0) + 50, 'with a saved cart', { size: 12 }),
        label(72, rowY(0) + 70, 'cart.calculating', { code: true }),
      ],
    ],
    note: [
      'cart.removed, cart.added: only the packages that changed since the last report, also when pricing fails',
      'A change sends cart.updated, then cart.calculating (from unpriced too); while calculating, cart.updated only',
      'Removing the last package, or clearing the cart, empties it: cart.updated, then cart.removed',
    ],
    errors: [['cart.calculate', 'unpriced; the summary keeps its earlier totals']],
  },
  sdk: {
    title: 'SDK lifecycle',
    desc: 'starting, then ready (sdk.ready, once a page) when the campaign is in: at once from a copy this browser saved in the last 10 minutes, else when the API answers. If the API fails and there is no saved copy, the SDK stops at failed (sdk.error, action campaign.load) without sdk.ready; with a copy it stays ready and still sends that sdk.error. Both set html data-next-error="campaign". Once ready, a step that fails sends sdk.error and the SDK stays ready.',
    rows: 2,
    boxes: [
      { row: 0, title: 'starting', sub: ['loading the campaign'] },
      { row: 1, title: 'ready', sub: [code('sdk.ready')], tone: 'success' },
      { col: 'side', row: 0, title: 'failed', sub: [code('sdk.error')], tone: 'failure' },
    ],
    parts: () => [down(0, 1, 'a saved copy, or the API answers'), toSide(0, 'fails, no copy', { dashed: true })],
    note: [
      'A copy saved in this browser in the last 10 minutes makes it ready at once; an API failure then sends sdk.error',
      'Once ready, a failed step sends sdk.error and the SDK stays ready',
      "A listener added later still gets the page's earlier sdk.error events",
    ],
    errors: [
      ['campaign.load', 'failed without a saved copy, else stays ready · data-next-error="campaign"'],
      ['storage.write', 'works on without saving across pages'],
    ],
  },
  selectors: {
    title: 'Selector lifecycle',
    desc: "A selector is registered and picks its option (selector.selected): ?forceBundleId, the one in the cart, data-next-selected, else the first. Options with no price from the last 10 minutes are calculated (selector.calculating), then priced (selector.calculated); when every price is from the last 10 minutes it goes straight to priced. Picking another option sends selector.selected. Changing the picked option's quantity or a slot sends selector.selected and calculates again; a coupon change calculates again without selector.selected. Pricing that fails sends sdk.error and moves to unpriced: each option keeps its last price, else the package price; the next change calculates again.",
    rows: 3,
    boxes: [
      { row: 0, title: 'picked', sub: [code('selector.selected')] },
      { row: 1, title: 'calculating', sub: ['prices on the way'], tone: 'active' },
      { row: 2, title: 'priced', sub: ['every option has a price'], tone: 'success' },
      { col: 'side', row: 1, title: 'unpriced', sub: [code('sdk.error')], tone: 'failure' },
    ],
    parts: () => {
      const right = MAIN.x + MAIN.w;
      return [
        down(0, 1, 'options need a price', ['selector.calculating']),
        down(1, 2, 'prices arrive', ['selector.calculated']),
        toSide(1, 'pricing fails', { dashed: true }),
        fromSide(1, 'quantity, slot'),
        [label((right + SIDE.x) / 2, rowY(1) + 77, 'or coupon', { anchor: 'middle', size: 12 })],
        loopUp(2, 1, 'quantity or slot', ['selector.selected', 'selector.calculating']),
        [
          arrow(`M${right} ${rowY(0) + 29} H712 V${rowY(2) + 46} H${right + 6}`),
          label(700, rowY(2) - 40, 'every price is from', { anchor: 'end', size: 12 }),
          label(700, rowY(2) - 24, 'the last 10 minutes', { anchor: 'end', size: 12 }),
          label(700, rowY(2) - 7, 'selector.calculated', { anchor: 'end', code: true }),
        ],
        [
          arrow(`M${right} ${rowY(2) + 12} H470 V${rowY(2) + 30} H${right + 6}`),
          label(482, rowY(2) + 16, 'another option', { size: 12 }),
          label(482, rowY(2) + 32, 'selector.selected', { code: true }),
        ],
      ];
    },
    note: [
      'Swap mode (the default) also puts the picked option in the cart: cart.updated follows',
      'A coupon change calculates every option again, without selector.selected',
      'A toggle sends selector.selected when switched on and selector.deselected when switched off',
    ],
    errors: [['selector.calculate', 'unpriced: each option keeps its last price, else the package price']],
  },
  coupons: {
    title: 'Coupon lifecycle',
    desc: 'A code is entered and checked against the cart. When it takes money off, or the cart is still empty, it is applied (cart.updated, then coupon.applied). When it takes nothing off it is denied (coupon.denied) and the cart does not change. A code applied to an empty cart is checked once the cart is first priced, and denied then if it takes nothing off (coupon.denied, then cart.updated as it comes off). Removing an applied code sends cart.updated, then coupon.removed. Clearing the cart takes every code off with cart.updated only.',
    rows: 3,
    boxes: [
      { row: 0, title: 'entered', sub: ['checked against the cart'] },
      { row: 1, title: 'applied', sub: [code('coupon.applied')], tone: 'success' },
      { row: 2, title: 'removed', sub: [code('coupon.removed')] },
      { col: 'side', row: 0, title: 'denied', sub: [code('coupon.denied')], tone: 'failure' },
    ],
    parts: () => [
      down(0, 1, 'takes money off, or the cart is empty', ['cart.updated']),
      down(1, 2, 'the code is taken off', ['cart.updated']),
      toSide(0, 'no discount', { dashed: true }),
      [
        arrow(`M${MAIN.x + MAIN.w} ${rowY(1) + 29} H${SIDE.cx} V${rowY(0) + H + 6}`, { dashed: true }),
        label(SIDE.cx - 12, rowY(1) - 10, 'no discount once', { anchor: 'end', size: 12 }),
        label(SIDE.cx - 12, rowY(1) + 6, 'first priced', { anchor: 'end', size: 12 }),
      ],
    ],
    note: [
      'Denied once priced, the code comes off the cart: cart.updated',
      'Applied or taken off, a cart with packages is priced again: cart.calculating, cart.calculated',
      'Clearing the cart takes every code off with cart.updated, without coupon.removed',
    ],
    errors: [['coupon.check', 'the code is not applied; applyCoupon resolves false']],
  },
  checkout: {
    title: 'Checkout lifecycle',
    desc: 'The checkout form opens with a cart (checkout.started). While the shopper fills it, user.created, user.updated, address.entered, address.updated, shipping.selected and payment.selected arrive in any order. A submit, or an express button, starts submitting: the cart is frozen while the form, the cart and the card are checked. A check that fails sends checkout.submitted with valid false and goes back to filling. Checks that pass send checkout.submitted with valid true and place the order. A refused order sends order.failed and goes back to filling. A created order sends order.created once. Without a payment_complete_url it is paid and the shopper is redirected to the next page (next-success-url, or the order status page); with one the shopper is redirected there to pay (PayPal, 3-D Secure, …): paid, the gateway redirects them to the next page; failed, back to the checkout with the cart kept (order.failed). The next page sends order.loaded, then order.paid once per order. A paid order empties the cart.',
    rows: 6,
    rowYs: [16, 196, 336, 516, 601, 766],
    boxes: [
      { row: 0, title: 'open', sub: [code('checkout.started')] },
      { row: 1, title: 'filling', sub: ['user, address, payment'], tone: 'active' },
      { row: 2, title: 'submitting', sub: ['the cart is frozen'], tone: 'waiting' },
      { row: 3, title: 'placing', sub: ['the order is sent'], tone: 'waiting' },
      { row: 5, title: 'paid', sub: [code('order.loaded'), code('order.paid')], tone: 'success' },
      { col: 'side', row: 4, title: 'awaiting payment', sub: ['paying at the gateway'], tone: 'waiting' },
    ],
    parts: () => {
      const right = MAIN.x + MAIN.w;
      const filling = rowY(1);
      const placing = rowY(3);
      const gateway = rowY(4);
      const fork = gateway + 29;
      return [
        down(0, 1, 'the shopper fills the form'),
        down(1, 2, 'submit, or an express button'),
        loopUp(2, 1, 'a check fails', ['checkout.submitted', 'valid: false'], { x: 180, at: 40 }),
        down(2, 3, 'the checks pass', ['checkout.submitted', 'valid: true']),
        [
          arrow(`M${MAIN.x} ${placing + 29} H24 V${filling + 16} H${MAIN.x - 6}`, { dashed: true }),
          label(36, placing - 56, 'not created'),
          label(36, placing - 36, 'order.failed', { code: true }),
        ],
        [
          arrow(`M${MAIN.cx} ${placing + H} V${fork - 18}`),
          label(MAIN.cx - 14, placing + H + 26, 'order.created', { anchor: 'end', code: true }),
          choice(MAIN.cx, fork),
        ],
        [
          arrow(`M${MAIN.cx} ${fork + 12} V${rowY(5) - 6}`),
          mixed(MAIN.cx + 14, fork + 58, [
            ['no ', false],
            ['payment_complete_url', true],
          ]),
          label(MAIN.cx + 14, fork + 76, 'redirected to the next page'),
        ],
        [
          arrow(`M${MAIN.cx + 12} ${fork} H${SIDE.x - 6}`),
          label((MAIN.cx + 12 + SIDE.x) / 2, fork - 8, 'payment_complete_url', { anchor: 'middle', code: true }),
          label((MAIN.cx + 12 + SIDE.x) / 2, fork + 18, 'redirected to it', { anchor: 'middle', size: 12 }),
        ],
        [
          arrow(`M${SIDE.cx} ${gateway + H} V${rowY(5) + 29} H${right + 6}`),
          label((right + SIDE.cx) / 2, rowY(5) + 5, 'paid: redirected', { anchor: 'middle', size: 12 }),
          label((right + SIDE.cx) / 2, rowY(5) + 21, 'to the next page', { anchor: 'middle', size: 12 }),
        ],
        [
          arrow(`M${SIDE.cx} ${gateway} V${rowY(0) + 29} H${right + 6}`, { dashed: true }),
          label((right + SIDE.cx) / 2, rowY(0) + 5, 'payment fails:', { anchor: 'middle', size: 12 }),
          label((right + SIDE.cx) / 2, rowY(0) + 21, 'redirected back', { anchor: 'middle', size: 12 }),
          label((right + SIDE.cx) / 2, rowY(0) + 45, 'order.failed', { anchor: 'middle', code: true }),
        ],
      ];
    },
    note: [
      'The next page is next-success-url: order.loaded, then order.paid once per order; without it, neither comes',
      'After a failed payment, checkout.started and order.failed come in either order',
      'A paid order empties the cart without cart events; while payment is awaited the cart is kept',
      'checkout.started comes on every checkout page load with a cart: each step, a reload, a return',
      'A multi-step form (data-next-checkout-step) checks each step on submit, then opens the next step',
    ],
    errors: [
      ['user.save', 'no Open Cart yet; tried again on the next field change'],
      ['address.rules', 'falls back to the campaign countries and simpler checks'],
      ['address.autocomplete', 'no address suggestions'],
      ['order.create', 'not created: back to filling, with order.failed'],
      ['order.load', 'on the next page: no order.loaded or order.paid; after a gateway the cart is kept'],
    ],
  },
  'checkout/user': {
    title: 'User lifecycle',
    desc: 'Lead capture. There is no user until the shopper has entered what data-next-lead asks for, checked each time the shopper leaves a field they changed: by default a first and last name of at least two characters each and a valid email. Then the checkout saves them with an Open Cart and sends user.created, once per tab until an order is paid. If saving fails it sends sdk.error and tries again on the next field change. After that, a change that is still valid sends user.updated and an invalid one sends nothing; the Open Cart keeps the first details, the order takes the latest. With data-next-lead off it never saves.',
    rows: 3,
    boxes: [
      { row: 0, title: 'no user yet', sub: ['details not complete'] },
      { row: 1, title: 'saving', sub: ['creating the Open Cart'], tone: 'waiting' },
      { row: 2, title: 'created', sub: [code('user.created')], tone: 'success' },
      { col: 'side', row: 1, title: 'not saved', sub: [code('sdk.error')], tone: 'failure' },
    ],
    parts: () => {
      const right = MAIN.x + MAIN.w;
      return [
        down(0, 1, 'a name and a valid email are in'),
        down(1, 2, 'saved'),
        toSide(1, 'save fails', { dashed: true }),
        fromSide(1, 'next change'),
        [
          arrow(`M${right} ${rowY(2) + 18} H470 V${rowY(2) + 42} H${right + 6}`),
          label(482, rowY(2) + 24, 'changes, still valid', { size: 12 }),
          label(482, rowY(2) + 41, 'user.updated', { code: true }),
        ],
      ];
    },
    note: [
      'data-next-lead="phone": a phone instead of the email · "email+phone": both · "off": never saves',
      'Once per tab until an order is paid · the Open Cart keeps the first details',
    ],
    errors: [['user.save', 'not saved; tried again on the next field change']],
  },
  'checkout/address': {
    title: 'Address lifecycle',
    desc: 'For each type, shipping and billing, checked when the shopper leaves a field they changed, once checkout.started has fired. Nothing is sent until every field the country requires is valid, and so is each optional field the shopper filled. Then address.entered, once per type per tab until an order is paid. A later valid change, the phone included, sends address.updated; an invalid change sends nothing and the last valid address is kept. Billing counts only while separate from shipping.',
    rows: 2,
    boxes: [
      { row: 0, title: 'incomplete', sub: ['a field is missing or wrong'] },
      { row: 1, title: 'entered', sub: [code('address.entered')], tone: 'success' },
    ],
    parts: () => {
      const right = MAIN.x + MAIN.w;
      return [
        down(0, 1, 'every field is valid'),
        [
          arrow(`M${right} ${rowY(1) + 18} H470 V${rowY(1) + 42} H${right + 6}`),
          label(482, rowY(1) + 24, 'changes, still valid', { size: 12 }),
          label(482, rowY(1) + 41, 'address.updated', { code: true }),
        ],
      ];
    },
    note: [
      'Per type, once per tab until an order is paid · billing only while separate from shipping',
      'An invalid change sends nothing; the last valid address is kept · checked once checkout.started has fired',
    ],
    errors: [
      ['address.rules', 'falls back to the campaign countries and simpler checks'],
      ['address.autocomplete', 'no address suggestions'],
    ],
  },
  orders: {
    title: 'Order lifecycle',
    desc: 'The checkout creates the order (order.created). Without a payment_complete_url it is paid at once and the shopper is redirected to the next page: order.loaded, then order.paid the first time. With one, the shopper is redirected to the gateway: paid, the gateway redirects to the next page (order.loaded, order.paid) and the cart kept for it is emptied; failed, back to the checkout with the cart kept (order.failed, stage payment). Each later page that opens the order sends order.loaded. A refused order is never created: order.failed with stage order.',
    rows: 3,
    boxes: [
      { row: 0, title: 'created', sub: [code('order.created')] },
      { row: 1, title: 'awaiting payment', sub: ['paying at the gateway'], tone: 'waiting' },
      { row: 2, title: 'paid', sub: [code('order.loaded'), code('order.paid')], tone: 'success' },
      {
        col: 'side',
        row: 1,
        title: 'payment failed',
        sub: [code('order.failed'), 'the cart is kept'],
        tone: 'failure',
      },
    ],
    parts: () => {
      const right = MAIN.x + MAIN.w;
      return [
        [
          arrow(`M${MAIN.cx} ${rowY(0) + H} V${rowY(1) - 6}`),
          mixed(MAIN.cx + 14, rowY(0) + 112, [
            ['has a ', false],
            ['payment_complete_url', true],
          ]),
          label(MAIN.cx + 14, rowY(0) + 130, 'redirected to the gateway'),
        ],
        [
          arrow(`M${MAIN.cx} ${rowY(1) + H} V${rowY(2) - 6}`),
          label(MAIN.cx + 14, rowY(1) + 112, 'paid: redirected to the next page'),
          label(MAIN.cx + 14, rowY(1) + 130, 'the cart kept for it is emptied', { size: 12 }),
        ],
        [
          arrow(`M${MAIN.x} ${rowY(0) + 29} H120 V${rowY(2) + 29} H${MAIN.x - 6}`),
          label(108, rowY(1) + 20, 'paid at once:', { anchor: 'end' }),
          label(108, rowY(1) + 38, 'redirected to', { anchor: 'end' }),
          label(108, rowY(1) + 56, 'the next page', { anchor: 'end' }),
        ],
        [
          arrow(`M${right} ${rowY(1) + 18} H${SIDE.x - 6}`, { dashed: true }),
          label((right + SIDE.x) / 2, rowY(1) - 6, 'payment fails:', { anchor: 'middle', size: 12 }),
          label((right + SIDE.x) / 2, rowY(1) + 10, 'redirected back', { anchor: 'middle', size: 12 }),
        ],
        [
          arrow(`M${right} ${rowY(2) + 18} H470 V${rowY(2) + 46} H${right + 6}`),
          label(482, rowY(2) + 26, 'each later page', { size: 12 }),
          label(482, rowY(2) + 43, 'order.loaded', { code: true }),
        ],
      ];
    },
    note: [
      'order.paid comes once per order in this browser · only a page with ref_id or order_ref_id loads the order',
      "Without next-success-url, an order paid at once goes to the store's order status page: neither event comes",
    ],
    errors: [
      ['order.create', 'not created: order.failed with stage order; the shopper stays on the checkout'],
      ['order.load', 'no order.loaded or order.paid; the page shows no order values'],
    ],
  },
  upsells: {
    title: 'Upsell lifecycle',
    desc: 'An offer is shown (upsell.viewed, once a page). Accepting posts it to the order: upsell.accepted with the updated order, then the shopper is redirected to the next page, which sends order.loaded with the offer in upsells. Skipping sends upsell.skipped and moves on. When adding fails, such as a decline, sdk.error then upsell.failed are sent and the shopper is redirected on after a second. An offer already accepted on that page sends nothing and moves on. If the order cannot load or take upsells, the offer stays hidden and upsell.viewed is not sent.',
    rows: 3,
    boxes: [
      { row: 0, title: 'shown', sub: [code('upsell.viewed')] },
      { row: 1, title: 'adding', sub: ['the offer is sent'], tone: 'active' },
      { row: 2, title: 'accepted', sub: [code('upsell.accepted')], tone: 'success' },
      { col: 'side', row: 0, title: 'skipped', sub: [code('upsell.skipped')] },
      { col: 'side', row: 1, title: 'failed', sub: [code('sdk.error'), code('upsell.failed')], tone: 'failure' },
    ],
    parts: () => [
      down(0, 1, 'accept'),
      down(1, 2, 'added to the order'),
      toSide(0, 'skip'),
      toSide(1, 'adding fails', { dashed: true }),
    ],
    note: [
      'Accepted, skipped or failed, the shopper is redirected to the next page (failed: after a second)',
      'An offer already accepted on that page sends nothing; redirected to the next page',
      'The next page sends order.loaded, with an accepted offer in upsells once',
    ],
    errors: [['upsell.add', 'failed: upsell.failed; redirected to the next page after a second']],
  },
  promotions: {
    title: 'Promotion lifecycle',
    desc: 'Starts when the page calls next.exitIntent({ image | template }). The popup waits: on a desktop until the mouse leaves through the top of the window; on a touch screen, with mobileScrollTrigger (or disableOnMobile false), until the shopper scrolls past 30% of a screen and back up more than 100px. It opens (promotion.viewed). A click on its image or a data-exit-intent-action button sends promotion.clicked and closes it; apply-coupon applies its code first (coupon.applied or coupon.denied). Esc or the overlay sends promotion.closed with reason dismissed; the × of showCloseButton sends it with reason closed. It waits again while it has opened fewer than maxTriggers times this tab session (default 1).',
    rows: 3,
    boxes: [
      { row: 0, title: 'waiting', sub: ['for the shopper to leave'] },
      { row: 1, title: 'open', sub: [code('promotion.viewed')], tone: 'active' },
      { row: 2, title: 'clicked', sub: [code('promotion.clicked')], tone: 'success' },
      { col: 'side', row: 1, title: 'closed', sub: [code('promotion.closed')] },
    ],
    parts: () => {
      const right = MAIN.x + MAIN.w;
      return [
        down(0, 1, 'mouse out the top, or scroll back up'),
        down(1, 2, 'image or button clicked'),
        toSide(1, 'Esc, overlay, ×'),
        loopUp(2, 0, 'under maxTriggers'),
        [
          arrow(`M${SIDE.cx} ${rowY(1)} V${rowY(0) + 29} H${right + 6}`, { dashed: true }),
          label((right + SIDE.cx) / 2, rowY(0) + 21, 'under maxTriggers', { anchor: 'middle', size: 12 }),
        ],
      ];
    },
    note: [
      'Starts when the page calls next.exitIntent({ image | template }) · opens up to maxTriggers times a tab session (1)',
      'apply-coupon waits for its code and the new price: coupon.applied (or coupon.denied) first, then promotion.clicked',
      'reason: dismissed (Esc, overlay) or closed (the × of showCloseButton)',
    ],
  },
};

for (const [name, spec] of Object.entries(LIFECYCLES)) {
  ROWS = spec.rowYs;
  const [group, part] = name.split('/');
  const stem = part ?? (group === 'carts' ? 'cart' : group.replace(/s$/, ''));
  writeFileSync(`${ROOT}/${group}/${stem}-lifecycle.svg`, svg(name.replace('/', '-'), spec));
}
