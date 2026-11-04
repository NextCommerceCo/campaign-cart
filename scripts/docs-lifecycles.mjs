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

/** A loop on a main box's right side, back into the same state: `y` is where it leaves, `h` how far down it comes back. */
const loopRight = (row, title, events = [], { y = 18, h = 24 } = {}) => {
  const right = MAIN.x + MAIN.w;
  const top = rowY(row) + y;
  return [
    arrow(`M${right} ${top} H470 V${top + h} H${right + 6}`),
    label(482, top + 6, title, { size: 12 }),
    ...events.map((e, i) => label(482, top + 23 + i * 17, e, { code: true })),
  ];
};

const LIFECYCLES = {
  carts: {
    title: 'Cart lifecycle',
    desc: 'empty, then calculating after a package is added (cart.updated, cart.added, then cart.calculating), then priced when the prices arrive (cart.calculated). A page that opens with a saved cart starts at calculating. Pricing that fails sends sdk.error and moves to unpriced; the next change prices again. A change sends cart.updated, then cart.removed and cart.added for the packages it removed or added, then cart.calculating; while calculating, no second cart.calculating. Removing the last package, or clearing the cart, empties it (cart.updated, then cart.removed). A frozen cart refuses changes without events.',
    rows: 3,
    boxes: [
      { row: 0, title: 'empty', sub: ['no lines'] },
      { row: 1, title: 'calculating', sub: [code('cart.calculating')], tone: 'active' },
      { row: 2, title: 'priced', sub: [code('cart.calculated')], tone: 'success' },
      { col: 'side', row: 1, title: 'unpriced', sub: [code('sdk.error')], tone: 'failure' },
    ],
    parts: () => {
      const right = MAIN.x + MAIN.w;
      return [
        down(0, 1, 'add a package', ['cart.updated', 'cart.added']),
        down(1, 2, 'prices arrive'),
        toSide(1, 'pricing fails', { dashed: true }),
        fromSide(1, 'a change'),
        loopUp(2, 1, 'a change', ['cart.updated', 'cart.removed', 'cart.added']),
        [
          arrow(`M60 ${rowY(0) + 20} V${rowY(1) + 14} H${MAIN.x - 6}`),
          label(72, rowY(0) + 34, 'a page opens', { size: 12 }),
          label(72, rowY(0) + 50, 'with a saved cart', { size: 12 }),
        ],
        [
          arrow(`M${right} ${rowY(2) + 46} H712 V${rowY(0) + 29} H${right + 6}`, { dashed: true }),
          label(700, rowY(0) + 96, 'the last package', { anchor: 'end', size: 12 }),
          label(700, rowY(0) + 112, 'removed, or cleared', { anchor: 'end', size: 12 }),
          label(700, rowY(0) + 132, 'cart.updated', { anchor: 'end', code: true }),
          label(700, rowY(0) + 149, 'cart.removed', { anchor: 'end', code: true }),
        ],
      ];
    },
    note: [
      'cart.removed, cart.added: after the change’s cart.updated, only for packages it removed or added',
      'While calculating, a change sends no second cart.calculating; only the latest prices are used',
      'A new shipping method: shipping.selected once the cart is priced with it (after cart.calculated)',
      'A frozen cart, while an order is placed, refuses every change and sends nothing',
    ],
    errors: [['cart.calculate', 'unpriced; the summary keeps its earlier totals']],
  },
  sdk: {
    title: 'SDK lifecycle',
    desc: 'starting, then ready (sdk.ready, once a page, with what the page shows) when the campaign is in: at once from a copy this browser saved in the last 10 minutes, else when the API answers. If the API fails and there is no saved copy, the SDK stops at failed (sdk.error, action campaign.load) without sdk.ready; with a copy it stays ready and still sends that sdk.error. Both set html data-next-error="campaign". Once ready, a step that fails sends sdk.error and the SDK stays ready.',
    rows: 2,
    boxes: [
      { row: 0, title: 'starting', sub: ['loading the campaign'] },
      { row: 1, title: 'ready', sub: [code('sdk.ready')], tone: 'success' },
      { col: 'side', row: 0, title: 'failed', sub: [code('sdk.error')], tone: 'failure' },
    ],
    parts: () => [down(0, 1, 'a saved copy, or the API answers'), toSide(0, 'fails, no copy', { dashed: true })],
    note: [
      'A copy saved in this browser in the last 10 minutes makes it ready at once; an API failure then sends sdk.error',
      'sdk.ready carries what the page shows then, as next.snapshot() does',
      'Once ready, a failed step sends sdk.error and the SDK stays ready',
      'A listener added later gets the page’s earlier events first, except under a 0.4.x name',
    ],
    errors: [
      ['campaign.load', 'failed without a saved copy, else stays ready · data-next-error="campaign"'],
      ['storage.write', 'works on without saving across pages'],
    ],
  },
  selectors: {
    title: 'Selector lifecycle',
    desc: 'A selector is bound and picks its option (selector.viewed, once): ?forceBundleId, the one in the cart, data-next-selected, else the first. Options with no price from the last 10 minutes are calculated (selector.calculating), then priced (selector.calculated); when every price is from the last 10 minutes it is priced at once, and those prices are checked again once a page (selector.calculated again). Picking another option sends selector.selected. Changing the picked option’s quantity or a slot sends selector.updated and prices again; a coupon change prices again without selector.updated. Pricing that fails sends sdk.error and moves to unpriced: each option keeps its last price, else the package price; the next change prices again.',
    rows: 3,
    boxes: [
      { row: 0, title: 'picked', sub: [code('selector.viewed')] },
      { row: 1, title: 'calculating', sub: [code('selector.calculating')], tone: 'active' },
      { row: 2, title: 'priced', sub: [code('selector.calculated')], tone: 'success' },
      { col: 'side', row: 1, title: 'unpriced', sub: [code('sdk.error')], tone: 'failure' },
    ],
    parts: () => {
      const right = MAIN.x + MAIN.w;
      return [
        down(0, 1, 'options need a price'),
        down(1, 2, 'prices arrive'),
        toSide(1, 'pricing fails', { dashed: true }),
        fromSide(1, 'a change'),
        loopUp(2, 1, 'quantity or slot', ['selector.updated']),
        [
          arrow(`M${right} ${rowY(0) + 29} H712 V${rowY(2) + 46} H${right + 6}`),
          label(700, rowY(2) - 40, 'every price is from', { anchor: 'end', size: 12 }),
          label(700, rowY(2) - 24, 'the last 10 minutes', { anchor: 'end', size: 12 }),
        ],
        loopRight(2, 'another option', ['selector.selected'], { y: 12, h: 18 }),
      ];
    },
    note: [
      'Prices from the last 10 minutes are checked again once a page: selector.calculated again',
      'A coupon change prices the options again, without selector.updated',
      'Swap mode (the default) also puts the pick in the cart: cart.updated follows',
      'A toggle: selector.selected when switched on, selector.deselected when its line leaves the cart',
    ],
    errors: [['selector.calculate', 'unpriced: each option keeps its last price, else the package price']],
  },
  coupons: {
    title: 'Coupon lifecycle',
    desc: 'A code entered on a cart with lines is checked: the cart is priced with and without it. When it takes money off it is applied (cart.updated, then coupon.applied); when it takes nothing off, or cannot be checked (sdk.error first), it is denied (coupon.denied) and the cart does not change. A code entered on an empty cart, or before the campaign loads, is held until the cart is first priced, then checked. A code already on the cart, held or being checked is denied at once (duplicate). Removing an applied code sends cart.updated, then coupon.removed; clearing the cart sends cart.updated, cart.removed, then coupon.removed. Removing or clearing drops a held code, or one being checked, without events.',
    rows: 4,
    rowYs: [40, 200, 360, 520],
    boxes: [
      { row: 0, title: 'held', sub: ['waits for the first price'] },
      { row: 1, title: 'checking', sub: ['priced with and without it'], tone: 'active' },
      { row: 2, title: 'applied', sub: [code('coupon.applied')], tone: 'success' },
      { row: 3, title: 'removed', sub: [code('coupon.removed')] },
      { col: 'side', row: 1, title: 'denied', sub: [code('coupon.denied')], tone: 'failure' },
    ],
    parts: () => {
      const gap = (MAIN.x + MAIN.w + SIDE.x) / 2;
      return [
        [
          arrow(`M24 ${rowY(0) + 29} H${MAIN.x - 6}`),
          label(24, rowY(0) + 1, 'entered on an', { size: 12 }),
          label(24, rowY(0) + 17, 'empty cart', { size: 12 }),
        ],
        [
          arrow(`M24 ${rowY(1) + 29} H${MAIN.x - 6}`),
          label(24, rowY(1) + 1, 'entered on a', { size: 12 }),
          label(24, rowY(1) + 17, 'cart with lines', { size: 12 }),
        ],
        [
          arrow(`M${SIDE.cx} ${rowY(0) - 16} V${rowY(1) - 6}`, { dashed: true }),
          label(SIDE.cx - 12, rowY(0) + 40, 'entered again:', { anchor: 'end', size: 12 }),
          label(SIDE.cx - 12, rowY(0) + 56, 'already on the cart,', { anchor: 'end', size: 12 }),
          label(SIDE.cx - 12, rowY(0) + 72, 'held or checking', { anchor: 'end', size: 12 }),
        ],
        down(0, 1, 'the cart is first priced'),
        down(1, 2, 'takes money off', ['cart.updated']),
        down(2, 3, 'removed, or the cart cleared', ['cart.updated']),
        toSide(1, 'no discount', { dashed: true }),
        [
          label(gap, rowY(1) + 38, 'or check fails', { anchor: 'middle', size: 12 }),
          label(gap, rowY(1) + 55, 'sdk.error', { anchor: 'middle', code: true }),
        ],
      ];
    },
    note: [
      'reason: no_discount, duplicate, or check_failed (after sdk.error)',
      'Applied or removed, a cart with lines is priced again: cart.calculating, cart.calculated',
      'removeCoupon: reason shopper · clearing the cart: cart.removed first, then reason cleared',
      'Removing or clearing drops a held code, or one being checked, without events',
      'A held code is kept across pages in this tab · a frozen cart takes no code and sends nothing',
    ],
    errors: [['coupon.check', 'denied with check_failed; applyCoupon resolves false']],
  },
  checkout: {
    title: 'Checkout lifecycle',
    desc: 'The checkout starts when its form is bound and the cart has lines (checkout.started, once per checkout; a later step, a reload or a return from the gateway keeps it). While the shopper fills the form, user.created, user.updated, address.entered, address.updated and payment.selected arrive in any order; a step of a multi-step form that passes its checks sends checkout.continued and opens the next step. A submit, or an express button, starts submitting: the cart is frozen while the form, the cart and the card are checked. A check that fails sends checkout.submitted with valid false and goes back to filling. Checks that pass send checkout.submitted with valid true and place the order. An order not created sends sdk.error, then checkout.failed, and goes back to filling. An order created without a payment_complete_url is paid: order.created, then the shopper is redirected to the next page, which sends order.loaded and order.paid. With one, payment.redirected, then the shopper is redirected to the gateway: paid, the gateway redirects them to the next page; not paid, back to the checkout with the cart kept (payment.failed).',
    rows: 6,
    rowYs: [16, 196, 336, 516, 601, 766],
    boxes: [
      { row: 0, title: 'started', sub: [code('checkout.started')] },
      { row: 1, title: 'filling', sub: ['user, address, payment'], tone: 'active' },
      { row: 2, title: 'submitting', sub: ['the cart is frozen'], tone: 'waiting' },
      { row: 3, title: 'placing', sub: ['the order is sent'], tone: 'waiting' },
      { row: 5, title: 'paid', sub: [code('order.loaded'), code('order.paid')], tone: 'success' },
      { col: 'side', row: 4, title: 'at the gateway', sub: ['see Payments'], tone: 'waiting' },
    ],
    parts: () => {
      const right = MAIN.x + MAIN.w;
      const filling = rowY(1);
      const placing = rowY(3);
      const gateway = rowY(4);
      const fork = gateway + 29;
      const back = 660;
      return [
        down(0, 1, 'the shopper fills the form'),
        down(1, 2, 'submit, or an express button'),
        loopUp(2, 1, 'a check fails', ['checkout.submitted', 'valid: false'], { x: 180, at: 44 }),
        down(2, 3, 'the checks pass', ['checkout.submitted', 'valid: true']),
        [
          arrow(`M60 ${rowY(0) + 14} V${filling + 12} H${MAIN.x - 6}`),
          label(72, rowY(0) + 96, 'a later page of', { size: 12 }),
          label(72, rowY(0) + 112, 'the same checkout', { size: 12 }),
        ],
        [
          arrow(`M${MAIN.x} ${placing + 29} H24 V${filling + 27} H${MAIN.x - 6}`, { dashed: true }),
          label(36, placing - 76, 'not placed'),
          label(36, placing - 56, 'sdk.error', { code: true }),
          label(36, placing - 39, 'checkout.failed', { code: true }),
        ],
        loopRight(1, 'a step passes', ['checkout.continued'], { y: 8, h: 16 }),
        [
          arrow(`M${back} ${gateway} V${filling + 46} H${right + 6}`, { dashed: true }),
          label(back - 12, rowY(2) + 14, 'not paid: redirected back', { anchor: 'end', size: 12 }),
          label(back - 12, rowY(2) + 31, 'payment.failed', { anchor: 'end', code: true }),
        ],
        [arrow(`M${MAIN.cx} ${placing + H} V${fork - 18}`), choice(MAIN.cx, fork)],
        [
          arrow(`M${MAIN.cx} ${fork + 12} V${rowY(5) - 6}`),
          mixed(MAIN.cx + 14, fork + 62, [
            ['no ', false],
            ['payment_complete_url', true],
          ]),
          label(MAIN.cx + 14, fork + 80, 'order.created', { code: true }),
          label(MAIN.cx + 14, fork + 98, 'redirected to the next page'),
        ],
        [
          arrow(`M${MAIN.cx + 12} ${fork} H${SIDE.x - 6}`),
          mixed(MAIN.cx + 26, fork - 8, [
            ['a ', false],
            ['payment_complete_url', true],
          ]),
          label((MAIN.cx + 12 + SIDE.x) / 2, fork + 18, 'payment.redirected', { anchor: 'middle', code: true }),
          label((MAIN.cx + 12 + SIDE.x) / 2, fork + 35, 'redirected to it', { anchor: 'middle', size: 12 }),
        ],
        [
          arrow(`M${SIDE.cx} ${gateway + H} V${rowY(5) + 29} H${right + 6}`),
          label((right + SIDE.cx) / 2, rowY(5) + 5, 'paid: redirected', { anchor: 'middle', size: 12 }),
          label((right + SIDE.cx) / 2, rowY(5) + 21, 'to the next page', { anchor: 'middle', size: 12 }),
        ],
      ];
    },
    note: [
      'checkout.started: once per checkout in this tab; a paid order ends it and the next one starts anew',
      'An express button pays with the wallet’s details: no form checks (0.4.x requireValidation adds them)',
      'The next page is next-success-url: order.loaded, then order.paid once per order',
      "Without it, an order paid at once goes to the store's order status page: neither event comes",
      'A paid order empties the cart without cart events; at the gateway the cart is kept',
      'Back from the gateway without paying (the Back button): filling again, without events',
    ],
    errors: [
      ['user.save', 'no Open Cart yet; tried again on the next field change'],
      ['address.load_rules', 'falls back to the campaign countries and simpler checks'],
      ['address.suggest', 'no address suggestions'],
      ['order.create', 'not placed: checkout.failed; back to filling'],
      ['order.load', 'on the next page: no order.loaded or order.paid'],
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
    parts: () => [
      down(0, 1, 'a name and a valid email are in'),
      down(1, 2, 'saved'),
      toSide(1, 'save fails', { dashed: true }),
      fromSide(1, 'next change'),
      loopRight(2, 'changes, still valid', ['user.updated']),
    ],
    note: [
      'data-next-lead="phone": a phone instead of the email · "email+phone": both · "off": never saves',
      'Once per tab until an order is paid · the Open Cart keeps the first details',
    ],
    errors: [['user.save', 'not saved; tried again on the next field change']],
  },
  'checkout/address': {
    title: 'Address lifecycle',
    desc: 'For each type, shipping and billing, checked when the shopper leaves a field they changed, once the checkout is open on the page (the form is bound and the cart has lines). Nothing is sent until every field the country requires is valid, and so is each optional field the shopper filled. Then address.entered, once per type per tab until an order is paid. A later valid change, the phone included, sends address.updated; an invalid change sends nothing and the last valid address is kept. Billing counts only while separate from shipping.',
    rows: 2,
    boxes: [
      { row: 0, title: 'incomplete', sub: ['a field is missing or wrong'] },
      { row: 1, title: 'entered', sub: [code('address.entered')], tone: 'success' },
    ],
    parts: () => [down(0, 1, 'every field is valid'), loopRight(1, 'changes, still valid', ['address.updated'])],
    note: [
      'Per type, once per tab until an order is paid · billing only while separate from shipping',
      'An invalid change sends nothing; the last valid address is kept · checked once the checkout is open',
    ],
    errors: [
      ['address.load_rules', 'falls back to the campaign countries and simpler checks'],
      ['address.suggest', 'no address suggestions'],
    ],
  },
  payments: {
    title: 'Payment lifecycle',
    desc: 'On the checkout, an order created with a payment_complete_url sends payment.redirected, and the shopper is redirected there to pay; no order.created comes. Paid, the gateway redirects the shopper to the next page, which loads the order (order.loaded, then order.paid once) and empties the cart kept for it. Not paid, the gateway redirects the shopper back to the checkout with payment_failed=true: payment.failed, once per order, with the cart kept and the same checkout. A shopper who comes back without paying, such as with the Back button, gets the checkout again without events.',
    rows: 2,
    rowYs: [90, 270],
    boxes: [
      { row: 0, title: 'at the gateway', sub: ['the shopper pays'], tone: 'waiting' },
      { row: 1, title: 'paid', sub: [code('order.loaded'), code('order.paid')], tone: 'success' },
      {
        col: 'side',
        row: 1,
        title: 'not paid',
        sub: [code('payment.failed'), 'back on the checkout'],
        tone: 'failure',
      },
    ],
    parts: () => {
      const right = MAIN.x + MAIN.w;
      return [
        [
          arrow(`M${MAIN.cx} 8 V${rowY(0) - 6}`),
          mixed(MAIN.cx + 14, 24, [
            ['created with a ', false],
            ['payment_complete_url', true],
          ]),
          label(MAIN.cx + 14, 42, 'payment.redirected', { code: true }),
          label(MAIN.cx + 14, 60, 'redirected to the gateway'),
        ],
        down(0, 1, 'paid: redirected to the next page'),
        [
          arrow(`M${right} ${rowY(0) + 29} H${SIDE.cx} V${rowY(1) - 6}`, { dashed: true }),
          label((right + SIDE.cx) / 2, rowY(0) + 21, 'not paid: redirected back', { anchor: 'middle', size: 12 }),
        ],
      ];
    },
    note: [
      'payment.redirected comes on the checkout before the shopper leaves; order.created does not come',
      'The next page is next-success-url (else /success): order.loaded, then order.paid once per order',
      'payment.failed: once per order, where the URL has payment_failed=true; the order is not loaded',
      'Back on the checkout: the same checkout and cart, no checkout.started; a new submit is a new order',
      'Back from the gateway without paying (the Back button): the checkout again, without events',
    ],
    errors: [['order.load', 'on the next page: no order.loaded or order.paid; the cart is kept']],
  },
  orders: {
    title: 'Order lifecycle',
    desc: 'An order paid at once on the checkout sends order.created there, and the shopper is redirected to the next page; an order paid at a gateway comes back to the next page without it. A page whose URL has ref_id or order_ref_id loads the order: order.loaded, then order.paid the first time this browser loads it paid. If it cannot load, sdk.error. An upsell added to the order sends upsell.accepted, then order.updated. Each later page loads the order again and sends order.loaded.',
    rows: 3,
    rowYs: [110, 290, 450],
    boxes: [
      { row: 0, title: 'loading', sub: ['ref_id in the URL'] },
      { row: 1, title: 'loaded', sub: [code('order.loaded'), code('order.paid')], tone: 'success' },
      { row: 2, title: 'updated', sub: [code('order.updated')] },
      { col: 'side', row: 0, title: 'not loaded', sub: [code('sdk.error')], tone: 'failure' },
    ],
    parts: () => {
      const right = MAIN.x + MAIN.w;
      const gap = (right + SIDE.x) / 2;
      return [
        [
          arrow(`M60 10 V${rowY(0) + 20} H${MAIN.x - 6}`),
          label(72, 30, 'paid at once', { size: 12 }),
          label(72, 48, 'order.created', { code: true }),
          label(72, 66, 'redirected to', { size: 12 }),
          label(72, 82, 'the next page', { size: 12 }),
        ],
        [
          arrow(`M500 10 V${rowY(0) + 14} H${right + 6}`),
          label(512, 30, 'paid at the gateway:', { size: 12 }),
          label(512, 46, 'redirected to', { size: 12 }),
          label(512, 62, 'the next page', { size: 12 }),
        ],
        [
          arrow(`M${right} ${rowY(0) + 44} H${SIDE.x - 6}`, { dashed: true }),
          label(gap, rowY(0) + 36, 'fails', { anchor: 'middle', size: 12 }),
        ],
        down(0, 1, 'the order arrives', [], { boxH: H }),
        down(1, 2, 'an upsell is added', ['upsell.accepted'], { boxH: H + 15 }),
        [
          arrow(`M${MAIN.x} ${rowY(2) + 29} H170 V${rowY(0) + 42} H${MAIN.x - 6}`, { dashed: true }),
          `<path d="M${MAIN.x} ${rowY(1) + 36} H170" style="fill: none; stroke: ${C.muted}; stroke-width: 1.5; stroke-dasharray: 5 4" />`,
          label(158, rowY(1) - 52, 'each later page', { anchor: 'end' }),
        ],
      ];
    },
    note: [
      'order.paid comes once per order in this browser, on the first page that loads it paid',
      'A copy loaded in this tab in the last 15 minutes is used at once, without the API',
      'Paid at the gateway, the next page empties the cart kept for it, without cart events',
      "Without next-success-url, an order paid at once goes to the store's order status page: neither event comes",
    ],
    errors: [['order.load', 'not loaded: no order.loaded or order.paid; offers stay hidden']],
  },
  upsells: {
    title: 'Upsell lifecycle',
    desc: 'An offer is shown (upsell.viewed, once per offer) when the order takes upsells. Accepting sends it to the order. Added, upsell.accepted then order.updated, and the shopper is redirected to the next page. Declined or refused, sdk.error then upsell.failed, and the shopper is redirected on after a second. With no answer (a timeout or a server error), the order is loaded again: if it has the offer, it was accepted; if not, it failed. Skipping sends upsell.skipped and moves on. An offer already accepted on that page sends nothing and moves on.',
    rows: 4,
    rowYs: [16, 196, 330, 480],
    boxes: [
      { row: 0, title: 'shown', sub: [code('upsell.viewed')] },
      { row: 1, title: 'adding', sub: ['the offer is sent'], tone: 'active' },
      {
        row: 3,
        title: 'accepted',
        sub: [code('upsell.accepted'), code('order.updated')],
        tone: 'success',
      },
      { col: 'side', row: 0, title: 'skipped', sub: [code('upsell.skipped')] },
      { col: 'side', row: 2, title: 'failed', sub: [code('sdk.error'), code('upsell.failed')], tone: 'failure' },
    ],
    parts: () => {
      const fork = rowY(2) + 29;
      const gap = (MAIN.cx + 12 + SIDE.x) / 2;
      return [
        down(0, 1, 'accept'),
        toSide(0, 'skip'),
        [arrow(`M${MAIN.cx} ${rowY(1) + H} V${fork - 18}`), choice(MAIN.cx, fork)],
        [
          arrow(`M${MAIN.cx} ${fork + 12} V${rowY(3) - 6}`),
          label(MAIN.cx + 14, fork + 44, 'added, or no answer'),
          label(MAIN.cx + 14, fork + 62, 'and the order has it'),
        ],
        [
          arrow(`M${MAIN.cx + 12} ${fork} H${SIDE.x - 6}`, { dashed: true }),
          label(gap, fork - 8, 'declined, refused,', { anchor: 'middle', size: 12 }),
          label(gap, fork + 18, 'or not on the order', { anchor: 'middle', size: 12 }),
        ],
      ];
    },
    note: [
      'No answer (a timeout or a server error): the order is loaded again to see if it has the offer',
      'Then the next page: accepted after a moment, skipped at once, failed after a second',
      'upsell.viewed: once per offer, when the order takes upsells and the offer’s price is in',
      'An offer already accepted on this page sends nothing; one with nothing to add logs a warning',
    ],
    errors: [['upsell.add', 'failed: upsell.failed; redirected to the next page after a second']],
  },
  promotions: {
    title: 'Promotion lifecycle',
    desc: 'Starts when the page calls next.exitIntent({ image | template }). The popup waits: on a desktop until the mouse leaves through the top of the window; on a touch screen, with mobileScrollTrigger (or disableOnMobile false), until the shopper scrolls past 30% of a screen and back up more than 100px. It opens (promotion.viewed). A click on its image or a data-exit-intent-action button sends promotion.clicked, runs its action, and closes it (promotion.closed, reason clicked); apply-coupon does not wait for its code. Esc or the overlay sends promotion.closed with reason dismissed; the × of showCloseButton with reason close_button. It waits again while it has opened fewer than maxTriggers times this tab session (default 1).',
    rows: 3,
    boxes: [
      { row: 0, title: 'waiting', sub: ['for the shopper to leave'] },
      { row: 1, title: 'open', sub: [code('promotion.viewed')], tone: 'active' },
      { row: 2, title: 'closed', sub: [code('promotion.closed')] },
    ],
    parts: () => {
      const right = MAIN.x + MAIN.w;
      return [
        down(0, 1, 'mouse out the top, or scroll back up'),
        down(1, 2, 'image or button clicked', ['promotion.clicked']),
        [
          arrow(`M${right} ${rowY(1) + 29} H530 V${rowY(2) + 29} H${right + 6}`),
          label(542, rowY(1) + 104, 'Esc, the overlay,', { size: 12 }),
          label(542, rowY(1) + 120, 'or the × button', { size: 12 }),
        ],
        loopUp(2, 0, 'under maxTriggers'),
      ];
    },
    note: [
      'Starts when the page calls next.exitIntent({ image | template }) · opens up to maxTriggers times a tab session (1)',
      'reason: clicked (after promotion.clicked), dismissed (Esc, overlay), close_button (×); none when the page removes it',
      'promotion.clicked comes before the action; apply-coupon’s coupon events can follow promotion.closed',
    ],
  },
  'promotions/banner': {
    title: 'Banner lifecycle',
    desc: 'An element marked data-next-promotion sends promotion.viewed once a page, when half of it is in view, and promotion.clicked on every click, before it is viewed too. A banner never sends promotion.closed.',
    rows: 2,
    boxes: [
      { row: 0, title: 'on the page', sub: ['less than half in view'] },
      { row: 1, title: 'viewed', sub: [code('promotion.viewed')], tone: 'success' },
    ],
    parts: () => [
      down(0, 1, 'half of it is in view'),
      loopRight(0, 'clicked', ['promotion.clicked']),
      loopRight(1, 'clicked', ['promotion.clicked']),
    ],
    note: ['data-next-promotion="<id>": viewed once a page, clicked on every click, never closed'],
  },
};

for (const [name, spec] of Object.entries(LIFECYCLES)) {
  ROWS = spec.rowYs;
  const [group, part] = name.split('/');
  const stem = part ?? (group === 'carts' ? 'cart' : group.replace(/s$/, ''));
  writeFileSync(`${ROOT}/${group}/${stem}-lifecycle.svg`, svg(name.replace('/', '-'), spec));
}
