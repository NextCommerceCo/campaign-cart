import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join, resolve } from 'node:path';

export const LIVE_API = 'https://campaigns.apps.29next.com';
const CAMPAIGNS = resolve(process.env.DEV_CAMPAIGNS ?? join(import.meta.dirname, 'campaigns'));
const RULES_REPO = resolve(process.env.I18N_RULES ?? join(import.meta.dirname, '../../i18n-rules'));

type Rules = { fetch(req: Request, env: object): Promise<Response> };
let rules: Promise<Rules | undefined> | undefined;
const rulesApp = () =>
  (rules ??= import(join(RULES_REPO, 'src/index.ts'))
    .then((m) => m.default as Rules)
    .catch(() => {
      console.warn(`[dev] no i18n-rules at ${RULES_REPO}; checkout uses the campaign's country list without rules`);
      return undefined;
    }));

interface Package {
  ref_id: number;
  name: string;
  price: string;
  price_total: string;
  price_retail?: string;
  price_retail_total?: string;
  image?: string;
  product_id?: number;
  product_name?: string;
  product_variant_id?: number;
  product_variant_name?: string;
  product_sku?: string | null;
}
interface Campaign {
  currency: string;
  packages: Package[];
  shipping_methods: Array<{ ref_id: number; code: string; price: string; name?: string }>;
}

const send = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};

const bodyOf = (req: IncomingMessage) =>
  new Promise<string>((done) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => done(data));
  });

const campaignFile = (key: string) => join(CAMPAIGNS, `${key.replace(/[^\w-]/g, '')}.json`);

function savedCampaign(key: string): Campaign | undefined {
  const file = campaignFile(key);
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Campaign) : undefined;
}

function calculate(
  campaign: Campaign,
  body: { lines: Array<{ package_id: number; quantity: number }>; shipping_method?: number },
) {
  const money = (n: number) => n.toFixed(2);
  const lines = body.lines.flatMap((l) => {
    const pkg = campaign.packages.find((p) => p.ref_id === l.package_id);
    if (!pkg) return [];
    const total = Number(pkg.price_total) * l.quantity;
    return [
      {
        package_id: l.package_id,
        quantity: l.quantity,
        unit_price: pkg.price,
        original_unit_price: pkg.price_retail ?? pkg.price,
        package_price: pkg.price_total,
        original_package_price: pkg.price_retail_total ?? pkg.price_total,
        subtotal: money(total),
        total_discount: '0.00',
        total: money(total),
        discounts: [],
      },
    ];
  });
  const method =
    campaign.shipping_methods.find((m) => m.ref_id === body.shipping_method) ?? campaign.shipping_methods[0];
  const subtotal = lines.reduce((n, l) => n + Number(l.total), 0);
  const shipping = Number(method?.price ?? 0);
  return {
    lines,
    shipping_method: method && {
      id: method.ref_id,
      name: method.name ?? method.code,
      code: method.code,
      price: method.price,
      original_price: method.price,
    },
    offer_discounts: [],
    voucher_discounts: [],
    subtotal: money(subtotal),
    total_discount: '0.00',
    total: money(subtotal + shipping),
    currency: campaign.currency,
  };
}

let orders = 0;
const ADDRESSES: Record<string, Array<[string, string, string, string, string]>> = {
  US: [
    ['1 Main St', 'Austin', 'Texas', 'TX', '73301'],
    ['100 Market St', 'San Francisco', 'California', 'CA', '94105'],
    ['350 5th Ave', 'New York', 'New York', 'NY', '10118'],
  ],
  GB: [
    ['10 Downing St', 'London', 'England', 'ENG', 'SW1A 2AA'],
    ['221B Baker St', 'London', 'England', 'ENG', 'NW1 6XE'],
  ],
};

function suggestAddresses(query: URLSearchParams) {
  const country = query.get('country') || 'US';
  const words = (query.get('query_text') ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  const all = (ADDRESSES[country] ?? []).map(([line1, city, state, state_code, postcode]) => ({
    label: `${line1}, ${city}, ${state_code} ${postcode}, ${country}`,
    address: { line1, city, state, state_code, postcode, country, country_code: country },
  }));
  const matching = all.filter((a) => words.some((w) => a.label.toLowerCase().includes(w)));
  return matching.length ? matching : all;
}

const placed = new Map<string, Record<string, unknown>>();

type Line = { package_id: number; quantity: number };

function orderLines(campaign: Campaign | undefined, lines: Line[], upsell = false) {
  return lines.map((l, i) => {
    const pkg = campaign?.packages.find((p) => p.ref_id === l.package_id);
    const total = (Number(pkg?.price_total ?? 0) * l.quantity).toFixed(2);
    const listed = (Number(pkg?.price_retail_total || pkg?.price_total || 0) * l.quantity).toFixed(2);
    return {
      id: Date.now() + i,
      package: l.package_id,
      product_id: pkg?.product_id ?? null,
      variant_id: pkg?.product_variant_id ?? null,
      product_title: pkg?.product_name ?? pkg?.name ?? `Package ${l.package_id}`,
      variant_title: pkg?.product_variant_name,
      product_sku: pkg?.product_sku ?? null,
      image: pkg?.image ?? '',
      quantity: l.quantity,
      price_excl_tax: total,
      price_incl_tax: total,
      price_excl_tax_excl_discounts: Number(listed) > Number(total) ? listed : total,
      price_incl_tax_excl_discounts: Number(listed) > Number(total) ? listed : total,
      is_upsell: upsell,
    };
  });
}

function totals(order: Record<string, unknown>) {
  const lines = order.lines as Array<{ price_incl_tax: string }>;
  const sum = lines.reduce((n, l) => n + Number(l.price_incl_tax), 0).toFixed(2);
  return { ...order, total_excl_tax: sum, total_incl_tax: sum, total_tax: '0.00', shipping_incl_tax: '0.00' };
}

function placeOrder(campaign: Campaign | undefined, body: Record<string, any>) {
  const ref = `DEV${1000 + ++orders}`;
  const { payment_method: method, card_token: token } = body.payment_detail;
  console.log(`[dev] order ${ref} by ${method}`);
  if (token === 'dev_tok_decline') {
    return {
      status: 400,
      body: { payment_response_code: '51', payment_details: 'Insufficient funds (dev mock: card 4000 0000 0000 0002)' },
    };
  }
  const order: Record<string, unknown> = totals({
    ref_id: ref,
    number: 1000 + orders,
    currency: campaign?.currency,
    lines: orderLines(campaign, body.lines),
    user: body.user,
    shipping_address: body.shipping_address,
    billing_address: body.billing_same_as_shipping_address === false ? body.billing_address : body.shipping_address,
    payment_method: method,
    shipping_method: 'Standard',
    supports_post_purchase_upsells: true,
  });
  if (method !== 'card_token') {
    const gateway = new URL('/__dev/gateway', body.success_url);
    gateway.search = new URLSearchParams({
      ref,
      method,
      success: body.success_url,
      failure: body.payment_failed_url,
    }).toString();
    order.payment_complete_url = gateway.href;
  }
  placed.set(ref, order);
  return { status: 201, body: order };
}

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function sameSite(target: string | null, req: IncomingMessage): URL | undefined {
  try {
    const origin = `http://${req.headers.host}`;
    const url = new URL(target ?? '', origin);
    return url.origin === origin ? url : undefined;
  } catch {
    return undefined;
  }
}

const GATEWAY = (q: URLSearchParams, req: IncomingMessage) => {
  const failure = sameSite(q.get('failure'), req)?.href ?? '/';
  return `<!doctype html><meta name="viewport" content="width=device-width"><title>Dev gateway</title>
<body style="font:16px system-ui;max-width:28rem;margin:4rem auto;padding:0 1rem">
<h1>Dev payment gateway</h1><p>Order <b>${escape(q.get('ref') ?? '')}</b> by <b>${escape(q.get('method') ?? '')}</b>. Nothing is charged.</p>
<p><a href="/__dev/gateway/approve?${escape(q.toString())}">Approve</a> · <a href="${escape(failure)}">Fail the payment</a></p></body>`;
};

export const hasLocalRules = () => existsSync(join(RULES_REPO, 'src/index.ts'));

export function apiTarget(api: string): string | undefined {
  if (api === 'full') return LIVE_API;
  return /^https?:\/\//.test(api) ? api.replace(/\/$/, '') : undefined;
}

export function mockApi(api: string) {
  mkdirSync(CAMPAIGNS, { recursive: true });
  const warned = new Set<string>();
  const live = api === 'live';
  const target = apiTarget(api);

  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = new URL(req.url ?? '/', 'http://dev');
    if (url.pathname === '/__dev/gateway') {
      res.writeHead(200, { 'content-type': 'text/html' });
      return res.end(GATEWAY(url.searchParams, req));
    }
    if (url.pathname === '/__dev/gateway/approve') {
      const ref = url.searchParams.get('ref') ?? '';
      const success = sameSite(url.searchParams.get('success'), req);
      if (!success || !placed.has(ref)) return send(res, 400, { detail: 'dev mock: unknown order or success page' });
      delete placed.get(ref)!.payment_complete_url;
      success.searchParams.set('ref_id', ref);
      res.writeHead(302, { location: success.href });
      return res.end();
    }

    if (url.pathname.startsWith('/__rules/')) {
      const app = await rulesApp();
      if (!app) return send(res, 503, { error: 'no local i18n-rules' });
      const body = req.method === 'POST' ? await bodyOf(req) : undefined;
      const answer = await app.fetch(
        new Request(`http://rules${url.pathname.slice('/__rules'.length)}${url.search}`, {
          method: req.method,
          headers: { 'content-type': 'application/json' },
          body,
        }),
        {},
      );
      res.writeHead(answer.status, { 'content-type': 'application/json' });
      return res.end(await answer.text());
    }

    if (!url.pathname.startsWith('/__api/')) return next();
    const path = url.pathname.slice('/__api'.length);
    const key = String(req.headers.authorization ?? '');
    const raw = req.method === 'POST' ? await bodyOf(req) : '';
    if (target) {
      const answer = await fetch(`${target}${path}${url.search}`, {
        method: req.method,
        headers: { Authorization: key, 'Content-Type': 'application/json' },
        body: raw || undefined,
      });
      res.writeHead(answer.status, { 'content-type': answer.headers.get('content-type') ?? 'application/json' });
      return res.end(await answer.text());
    }
    let body: any;
    try {
      body = raw ? JSON.parse(raw) : undefined;
    } catch {
      return send(res, 400, { detail: 'dev mock: body is not JSON' });
    }

    const readOnly = ['/api/v1/campaigns/', '/api/v1/carts/calculate/', '/api/v1/addresses/autocomplete/'];
    if (live && readOnly.includes(path)) {
      const answer = await fetch(`${LIVE_API}${path}${url.search}`, {
        method: req.method,
        headers: { Authorization: key, 'Content-Type': 'application/json' },
        body: raw || undefined,
      });
      const text = await answer.text();
      if (answer.ok && path === '/api/v1/campaigns/') writeFileSync(campaignFile(key), text);
      res.writeHead(answer.status, { 'content-type': 'application/json' });
      return res.end(text);
    }

    if (path === '/api/v1/addresses/autocomplete/')
      return send(res, 200, { results: suggestAddresses(url.searchParams) });
    if (path === '/api/v1/carts/') {
      console.log(`[dev] prospect cart for ${body?.user?.email}`);
      return send(res, 201, { id: Date.now(), checkout_url: `${url.origin}/__dev/cart` });
    }
    if (path === '/api/v1/orders/') {
      if (!body?.payment_detail?.payment_method || !body.success_url) {
        return send(res, 400, { detail: 'dev mock: order needs payment_detail and success_url' });
      }
      const order = placeOrder(savedCampaign(key), body);
      return send(res, order.status, order.body);
    }
    const ref = path.match(/^\/api\/v1\/orders\/([^/]+)\/(upsells\/)?$/);
    if (ref) {
      const order = placed.get(ref[1]!);
      if (!order)
        return send(res, 404, { detail: `dev mock: no order ${ref[1]} (orders live until bun dev restarts)` });
      if (!ref[2]) return send(res, 200, order);
      if (!Array.isArray(body?.lines)) return send(res, 400, { detail: 'dev mock: upsell needs lines' });
      console.log(`[dev] upsell on ${ref[1]}: ${JSON.stringify(body.lines)}`);
      order.lines = [...(order.lines as unknown[]), ...orderLines(savedCampaign(key), body.lines, true)];
      Object.assign(order, totals(order));
      return send(res, 201, order);
    }

    const campaign = savedCampaign(key);
    if (!campaign) {
      if (!warned.has(key)) {
        warned.add(key);
        console.warn(
          `[dev] no saved campaign for ${key}. Save it once with \`bun dev --live\`, or:\n` +
            `      curl -s -H "Authorization: ${key}" ${LIVE_API}/api/v1/campaigns/ -o ${campaignFile(key)}`,
        );
      }
      return send(res, 404, { detail: `dev mock: no saved campaign for ${key}` });
    }
    if (path === '/api/v1/campaigns/') return send(res, 200, campaign);
    if (path === '/api/v1/carts/calculate/') return send(res, 200, calculate(campaign, body));
    return send(res, 404, { detail: `dev mock: ${req.method} ${path} is not mocked yet` });
  };
}
