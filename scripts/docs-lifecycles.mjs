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

function svg(name, { title, desc, boxes, parts, height: fixed }) {
  const height = fixed ?? Math.max(...boxes.map((b) => rowY(b.row) + box(b).h)) + 16;
  const id = `${name}-lifecycle`;
  const drawn = boxes.map((b) => box(b).svg).join('\n    ');
  const body = parts().flat().join('\n    ').replaceAll('#ARROW', `#${id}-arrow`);
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
  </g>
</svg>
`;
}

const code = (text) => ({ text, code: true });

/** Where an arrow comes from when it starts outside the drawing: a dashed box naming it. Returns its bottom and right edges. */
const entry = (x, y, w, lines) => {
  const h = 12 + lines.length * 15;
  return {
    bottom: y + h,
    right: x + w,
    mid: y + h / 2,
    svg: [
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" style="fill: none; stroke: ${C.muted}; stroke-width: 1.2; stroke-dasharray: 4 3" />`,
      ...lines.map((t, i) => label(x + w / 2, y + 18 + i * 15, t, { anchor: 'middle', size: 12 })),
    ],
  };
};

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
        (() => {
          const e = entry(8, rowY(0) + 60, 116, ['a page opens', 'with a saved cart']);
          return [...e.svg, arrow(`M66 ${e.bottom} V${rowY(1) + 14} H${MAIN.x - 6}`)];
        })(),
        [
          arrow(`M${right} ${rowY(2) + 46} H712 V${rowY(0) + 29} H${right + 6}`, { dashed: true }),
          label(700, rowY(0) + 96, 'the last package', { anchor: 'end', size: 12 }),
          label(700, rowY(0) + 112, 'removed, or cleared', { anchor: 'end', size: 12 }),
          label(700, rowY(0) + 132, 'cart.updated', { anchor: 'end', code: true }),
          label(700, rowY(0) + 149, 'cart.removed', { anchor: 'end', code: true }),
        ],
      ];
    },
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
  },
  selectors: {
    title: 'Selector lifecycle',
    desc: 'A selector is bound and picks its option: ?forceBundleId, the one in the cart, data-next-selected, else the first; selector.viewed comes once a page, when half of it is on screen. Options with no price from the last 10 minutes are calculated (selector.calculating), then priced (selector.calculated); when every price is from the last 10 minutes it is priced at once, and those prices are checked again once a page (selector.calculated again). Picking another option sends selector.selected. Changing the picked option’s quantity or a slot sends selector.updated and prices again; a coupon change prices again without selector.updated. Pricing that fails sends sdk.error and moves to unpriced: each option keeps its last price, else the package price; the next change prices again. A toggle follows the same lifecycle, its line priced while it is off.',
    rows: 3,
    boxes: [
      { row: 0, title: 'picked', sub: [code('selector.viewed'), 'once half of it is on screen'] },
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
        (() => {
          const e = entry(16, rowY(0) + 8, 116, ['entered on an', 'empty cart']);
          return [...e.svg, arrow(`M${e.right} ${rowY(0) + 29} H${MAIN.x - 6}`)];
        })(),
        (() => {
          const e = entry(16, rowY(1) + 8, 116, ['entered on a', 'cart with lines']);
          return [...e.svg, arrow(`M${e.right} ${rowY(1) + 29} H${MAIN.x - 6}`)];
        })(),
        (() => {
          const e = entry(SIDE.x, rowY(0) + 14, SIDE.w, ['entered again: already', 'on the cart, held', 'or checking']);
          return [...e.svg, arrow(`M${SIDE.cx} ${e.bottom} V${rowY(1) - 6}`, { dashed: true })];
        })(),
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
  },
  checkout: {
    title: 'Checkout lifecycle',
    desc: 'On each checkout page. idle: the shopper fills the form; checkout.started comes once per checkout, when the cart has lines. On a multi-step form, a step whose checks fail sends checkout.invalid; one that passes sends checkout.continued and loads the next step page. A submit, or an express button, moves to placing: the cart is frozen, the form, the cart and the card are checked, then checkout.submitted is sent and the order is created. A check that fails (checkout.invalid), an order not created (sdk.error, checkout.failed) or a declined card (payment.failed) go back to idle. A created order (order.created) is placed and the page redirects: paid at once (order.paid, checkout.completed), to the next page, which loads the order; else (payment.redirected) to the gateway. A checkout page loaded after an unpaid return from the gateway sends payment.failed.',
    rows: 3,
    rowYs: [120, 270, 430],
    height: 638,
    boxes: [
      {
        row: 0,
        title: 'idle',
        sub: ['the shopper fills the form', code('checkout.started'), 'once per checkout'],
        tone: 'active',
      },
      {
        row: 1,
        title: 'placing',
        sub: ['the cart is frozen', code('checkout.submitted'), 'once the checks pass'],
        tone: 'waiting',
      },
      { row: 2, title: 'placed', sub: ['the page redirects'], tone: 'success' },
    ],
    parts: () => {
      const right = MAIN.x + MAIN.w;
      const idle = rowY(0);
      const placing = rowY(1);
      const placed = rowY(2);
      const tall = H + 30;
      const lane = 150;
      const next = 580;
      /** Leaves the page: a dashed box on the side, reached by an arrow that bends down into it. */
      const exit = (y, boxY, title, event, lines) => [
        arrow(`M${right} ${y} H${SIDE.cx} V${boxY - 6}`),
        label(right + 6, y - 8, title, { size: 12 }),
        label(right + 6, y + 17, event, { code: true }),
        ...entry(SIDE.x, boxY, SIDE.w, lines).svg,
      ];
      /** One way back from placing to idle, listed beside the shared lane. */
      const fails = (y, title, events) => [
        label(lane - 12, y, title, { anchor: 'end' }),
        ...events.map((e, i) => label(lane - 12, y + 17 + i * 17, e, { anchor: 'end', code: true })),
      ];
      return [
        (() => {
          const e = entry(MAIN.cx - 115, 8, 230, [
            'a checkout page loads:',
            'the first page, a step, a reload,',
            'or back from the gateway',
          ]);
          return [
            ...e.svg,
            arrow(`M${MAIN.cx} ${e.bottom} V${idle - 6}`),
            label(MAIN.cx + 14, 84, 'back from the gateway unpaid', { size: 12 }),
            label(MAIN.cx + 14, 104, 'payment.failed', { code: true }),
          ];
        })(),
        loopRight(0, 'a step fails', ['checkout.invalid'], { y: 6, h: 16 }),
        exit(idle + 72, 230, 'a step passes', 'checkout.continued', ['the next step page']),
        down(0, 1, 'submit, or an express button', [], { boxH: tall }),
        [
          arrow(`M${MAIN.x} ${placing + tall / 2} H${lane} V${idle + tall / 2} H${MAIN.x - 6}`, { dashed: true }),
          ...fails(180, 'a check fails', ['checkout.invalid']),
          ...fails(222, 'order not placed', ['sdk.error', 'checkout.failed']),
          ...fails(281, 'card declined', ['payment.failed']),
        ],
        down(1, 2, 'the order is created', ['order.created'], { boxH: tall }),
        exit(placed + 29, 500, 'to a gateway', 'payment.redirected', ['the gateway', 'payment lifecycle']),
        [
          arrow(`M${MAIN.cx} ${placed + H} V${next - 6}`),
          label(MAIN.cx + 14, placed + H + 17, 'paid at once'),
          label(MAIN.cx + 14, placed + H + 37, 'order.paid', { code: true }),
          label(MAIN.cx + 14, placed + H + 54, 'checkout.completed', { code: true }),
          ...entry(MAIN.cx - 100, next, 200, ['the next page', 'loads the order']).svg,
        ],
      ];
    },
  },
  'checkout/user': {
    title: 'User lifecycle',
    desc: 'Lead capture, once the checkout has started. There is no user until the shopper has entered what data-next-lead asks for, checked each time the shopper leaves a field they changed: by default a first and last name of at least two characters each and a valid email. Then the checkout saves them with an Open Cart and sends user.created, once per checkout. If saving fails it sends sdk.error and tries again on the next field change. After that, a change that is still valid sends user.updated and an invalid one sends nothing; the Open Cart keeps the first details, the order takes the latest. With data-next-lead off it never saves.',
    rows: 3,
    boxes: [
      { row: 0, title: 'no user yet', sub: ['details not complete'] },
      { row: 1, title: 'saving', sub: ['creating the Open Cart'], tone: 'waiting' },
      { row: 2, title: 'created', sub: [code('user.created')], tone: 'success' },
      { col: 'side', row: 1, title: 'not saved', sub: [code('sdk.error')], tone: 'failure' },
    ],
    parts: () => [
      down(0, 1, 'a name and a valid email are in'),
      label(MAIN.cx + 14, rowY(0) + H + 82, 'once the checkout has started', { size: 12 }),
      down(1, 2, 'saved'),
      toSide(1, 'save fails', { dashed: true }),
      fromSide(1, 'next change'),
      loopRight(2, 'changes, still valid', ['user.updated']),
    ],
  },
  'checkout/address': {
    title: 'Address lifecycle',
    desc: "For each type, shipping and billing while it is separate from shipping. When the form is bound the country list and the chosen country's rules load (sdk.error if they cannot: the campaign's countries, a built-in layout and simpler checks). A country change loads its rules again. With addressConfig.enableAutocomplete, two words in line 1 show suggestions; picking one sends address.autofilled and fills the fields. Fields are checked when the shopper leaves one they changed. Once the checkout is open, an address whose every required field is valid, and each optional field filled, sends address.entered, once per type per checkout. A later valid change, the name and the phone included, sends address.updated; an invalid change sends nothing and the last valid address is kept.",
    rows: 3,
    rowYs: [70, 250, 430],
    boxes: [
      { row: 0, title: 'loading rules', sub: ['the countries and their fields'], tone: 'waiting' },
      { row: 1, title: 'incomplete', sub: ['a field is missing or wrong'], tone: 'active' },
      { row: 2, title: 'entered', sub: [code('address.entered')], tone: 'success' },
      { col: 'side', row: 1, title: 'suggesting', sub: ['a list under line 1'] },
    ],
    parts: () => {
      const gap = (MAIN.x + MAIN.w + SIDE.x) / 2;
      const y = rowY(1);
      return [
        (() => {
          const e = entry(MAIN.cx - 80, 4, 160, ['the form is bound']);
          return [...e.svg, arrow(`M${MAIN.cx} ${e.bottom} V${rowY(0) - 6}`)];
        })(),
        down(0, 1, 'rules in'),
        mixed(MAIN.cx + 14, 206, [
          ['or ', false],
          ['sdk.error', true],
          [': simpler checks', false],
        ]),
        loopUp(1, 0, 'the country changes', [], { x: 170 }),
        arrow(`M${MAIN.x + MAIN.w} ${y + 16} H${SIDE.x - 6}`),
        label(gap, y + 8, 'line 1 typed', { anchor: 'middle', size: 12 }),
        arrow(`M${SIDE.x} ${y + 44} H${MAIN.x + MAIN.w + 6}`, { dashed: true }),
        label(SIDE.cx, y + 82, 'picked: fields filled', { anchor: 'middle', size: 12 }),
        label(SIDE.cx, y + 100, 'address.autofilled', { anchor: 'middle', code: true }),
        down(1, 2, 'every field is valid'),
        label(MAIN.cx + 14, 386, 'once the checkout is open', { size: 12 }),
        loopRight(2, 'changes, still valid', ['address.updated']),
      ];
    },
  },
  payments: {
    title: 'Payment lifecycle',
    desc: 'On the checkout, an order created with a payment_complete_url sends order.created, then payment.redirected, and the shopper is redirected there to pay. Paid, the gateway redirects the shopper to the next page, which loads the order (order.loaded, then order.paid once and checkout.completed) and empties the cart kept for it. Not paid, the gateway redirects the shopper back to the checkout with payment_failed=true: payment.failed, once per order, with the cart kept and the same checkout. A card declined on the checkout sends payment.failed too. A shopper who comes back without paying, such as with the Back button, gets the checkout again without events.',
    rows: 2,
    rowYs: [124, 304],
    boxes: [
      { row: 0, title: 'at the gateway', sub: ['the shopper pays'], tone: 'waiting' },
      {
        row: 1,
        title: 'paid',
        sub: [code('order.loaded'), code('order.paid'), code('checkout.completed')],
        tone: 'success',
      },
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
        (() => {
          const e = entry(MAIN.cx - 60, 6, 120, ['the checkout']);
          return [
            ...e.svg,
            arrow(`M${MAIN.cx} ${e.bottom} V${rowY(0) - 6}`),
            label(MAIN.cx + 14, 48, 'created with a', { size: 12 }),
            label(MAIN.cx + 14, 64, 'payment_complete_url', { code: true }),
            label(MAIN.cx + 14, 83, 'order.created', { code: true }),
            label(MAIN.cx + 14, 100, 'payment.redirected', { code: true }),
          ];
        })(),
        down(0, 1, 'paid: redirected'),
        label(MAIN.cx + 14, 254, 'to the next page'),
        (() => {
          const e = entry(SIDE.x, 6, SIDE.w, ['the checkout:', 'a card declined']);
          return [...e.svg, arrow(`M${SIDE.cx} ${e.bottom} V${rowY(1) - 6}`, { dashed: true })];
        })(),
        [
          arrow(`M${right} ${rowY(0) + 29} H500 V${rowY(1) + 29} H${SIDE.x - 6}`, { dashed: true }),
          label(512, rowY(0) + 82, 'not paid:', { size: 12 }),
          label(512, rowY(0) + 98, 'redirected back', { size: 12 }),
        ],
      ];
    },
  },
  orders: {
    title: 'Order lifecycle',
    desc: "On each page after the checkout. idle: the page has no order yet; the checkout back from the gateway unpaid sends payment.failed. A URL with ref_id or order_ref_id loads the order: ready at once from a copy this tab loaded in the last 15 minutes, else loading from the API, 10 seconds at most, and failed (sdk.error) if it cannot. ready sends order.loaded, then order.paid the first time this browser has the order paid, then checkout.completed when this tab's checkout sent it to the gateway. Accepting an upsell moves to accepting: added, upsell.accepted then order.updated, back in ready; not added, back in ready without an order event. The next page has ref_id in its URL and loads the order again.",
    rows: 4,
    rowYs: [124, 274, 424, 624],
    boxes: [
      { row: 0, title: 'idle', sub: ['the page has no order yet'] },
      { row: 1, title: 'loading', sub: ['the API, 10 seconds at most'], tone: 'waiting' },
      {
        row: 2,
        title: 'ready',
        sub: [
          code('order.loaded'),
          code('order.paid'),
          'once per order in this browser',
          code('checkout.completed'),
          'after a gateway',
        ],
        tone: 'success',
      },
      { row: 3, title: 'accepting', sub: ['the upsell is sent'], tone: 'active' },
      { col: 'side', row: 1, title: 'failed', sub: [code('sdk.error')], tone: 'failure' },
    ],
    parts: () => {
      const right = MAIN.x + MAIN.w;
      const gap = (right + SIDE.x) / 2;
      const idle = rowY(0);
      const ready = rowY(2);
      const accepting = rowY(3);
      const tall = H + 60;
      return [
        (() => {
          const e = entry(MAIN.cx - 115, 8, 230, [
            'a page loads: the next page',
            'after the checkout or the gateway,',
            'or the checkout, back unpaid',
          ]);
          return [
            ...e.svg,
            arrow(`M${MAIN.cx} ${e.bottom} V${idle - 6}`),
            label(MAIN.cx + 14, 84, 'back unpaid', { size: 12 }),
            label(MAIN.cx + 14, 104, 'payment.failed', { code: true }),
          ];
        })(),
        down(0, 1, 'no copy from the last 15 minutes'),
        [
          arrow(`M${MAIN.x} ${idle + 29} H170 V${ready + 24} H${MAIN.x - 6}`),
          label(158, 290, 'a copy from this tab,', { anchor: 'end' }),
          label(158, 308, 'under 15 minutes old', { anchor: 'end' }),
        ],
        toSide(1, 'cannot load', { dashed: true }),
        down(1, 2, 'the order arrives'),
        [
          arrow(`M${right} ${ready + 29} H${SIDE.x - 6}`),
          label(gap, ready + 21, 'moves on', { anchor: 'middle', size: 12 }),
          ...entry(SIDE.x, ready + 8, SIDE.w, ['the next page:', 'ref_id in the URL']).svg,
        ],
        down(2, 3, 'accept an upsell', [], { boxH: tall }),
        [
          arrow(`M${MAIN.x} ${accepting + 29} H150 V${ready + 60} H${MAIN.x - 6}`, { dashed: true }),
          label(138, 520, 'added', { anchor: 'end' }),
          label(138, 537, 'upsell.accepted', { anchor: 'end', code: true }),
          label(138, 554, 'order.updated', { anchor: 'end', code: true }),
          label(138, 580, 'not added', { anchor: 'end' }),
          label(138, 597, 'upsell lifecycle', { anchor: 'end' }),
        ],
      ];
    },
  },
  upsells: {
    title: 'Upsell lifecycle',
    desc: 'On one upsell page, opened with the order’s ref_id. The page loads the order (order.loaded): an order that takes upsells shows the offer, next-available, and upsell.viewed comes once per offer, when half of it is on screen; one that does not, or cannot load (sdk.error), keeps it next-hidden. Accepting sends the offer to the order: next-processing. Added, next-success (upsell.accepted, then order.updated) and the next page opens after a tenth of a second. Declined (upsell.declined, payment.failed), refused, or no answer and the order loaded again does not have it (sdk.error, upsell.failed): next-error, and the next page opens after a second. With no answer and the order loaded again having the offer, it was added. Skipping is next-skipped (upsell.skipped) and opens the next page at once. The next page loads the order again.',
    rows: 4,
    rowYs: [110, 290, 424, 574],
    height: 770,
    boxes: [
      { row: 0, title: 'next-available', sub: [code('upsell.viewed'), 'once half of it is on screen'], tone: 'active' },
      { row: 1, title: 'next-processing', sub: ['the offer is sent'], tone: 'waiting' },
      { row: 3, title: 'next-success', sub: [code('upsell.accepted'), code('order.updated')], tone: 'success' },
      { col: 'side', row: 0, title: 'next-hidden', sub: ['the offer stays hidden'] },
      { col: 'side', row: 1, title: 'next-skipped', sub: [code('upsell.skipped')] },
      { col: 'side', row: 2, title: 'next-error', sub: ['not added'], tone: 'failure' },
    ],
    parts: () => {
      const right = MAIN.x + MAIN.w;
      const sideRight = SIDE.x + SIDE.w;
      const available = rowY(0);
      const processing = rowY(1);
      const error = rowY(2);
      const success = rowY(3);
      const fork = error + 29;
      const gap = (MAIN.cx + 12 + SIDE.x) / 2;
      const tall = H + 15;
      const next = 712;
      return [
        (() => {
          const e = entry(MAIN.cx - 115, 8, 230, ['the page loads the order']);
          return [
            ...e.svg,
            arrow(`M${MAIN.cx} ${e.bottom} V${available - 6}`),
            label(MAIN.cx - 14, 62, 'takes upsells', { anchor: 'end' }),
            label(MAIN.cx - 14, 82, 'order.loaded', { anchor: 'end', code: true }),
            arrow(`M${e.right} ${e.mid} H${SIDE.cx} V${available - 6}`),
            label(610, 45, 'does not take upsells', { anchor: 'end', size: 12 }),
            label(610, 61, 'or cannot load', { anchor: 'end', size: 12 }),
            label(610, 79, 'order.loaded, or sdk.error', { anchor: 'end', code: true }),
          ];
        })(),
        down(0, 1, 'accept', [], { boxH: tall }),
        [
          arrow(`M${right} ${available + 40} H490 V${processing + 20} H${SIDE.x - 6}`),
          label(502, 225, 'skip', { size: 12 }),
          label(502, 243, 'upsell.skipped', { code: true }),
        ],
        [arrow(`M${MAIN.cx} ${processing + H} V${fork - 18}`), choice(MAIN.cx, fork)],
        [
          arrow(`M${MAIN.cx} ${fork + 12} V${success - 6}`),
          label(MAIN.cx + 14, fork + 72, 'added, or no answer'),
          label(MAIN.cx + 14, fork + 90, 'and the order has it'),
        ],
        [
          arrow(`M${MAIN.cx + 12} ${fork} H${SIDE.x - 6}`, { dashed: true }),
          label(gap, fork - 40, 'declined', { anchor: 'middle', size: 12 }),
          label(gap, fork - 24, 'upsell.declined', { anchor: 'middle', code: true }),
          label(gap, fork - 8, 'payment.failed', { anchor: 'middle', code: true }),
          label(gap, fork + 20, 'refused, or not on the order', { anchor: 'middle', size: 12 }),
          label(gap, fork + 37, 'sdk.error, upsell.failed', { anchor: 'middle', code: true }),
        ],
        [
          arrow(`M${MAIN.cx} ${success + tall} V${next - 6}`),
          label(MAIN.cx + 14, success + tall + 24, 'after a tenth of a second', { size: 12 }),
          arrow(`M${SIDE.cx} ${error + H} V${next - 6}`),
          label(SIDE.cx - 12, error + H + 60, 'after a second', { anchor: 'end', size: 12 }),
          arrow(`M${sideRight} ${processing + 29} H712 V${next + 20} H${sideRight + 6}`),
          label(sideRight, error + H + 80, 'at once', { anchor: 'end', size: 12 }),
          ...entry(MAIN.x, next, sideRight - MAIN.x, ['the next page', 'loads the order']).svg,
        ],
      ];
    },
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
  },
};

for (const [name, spec] of Object.entries(LIFECYCLES)) {
  ROWS = spec.rowYs;
  const [group, part] = name.split('/');
  const stem = part ?? (group === 'carts' ? 'cart' : group.replace(/s$/, ''));
  writeFileSync(`${ROOT}/${group}/${stem}-lifecycle.svg`, svg(name.replace('/', '-'), spec));
}
