import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join, resolve } from 'node:path';

export const LIVE_API = 'https://campaigns.apps.29next.com';
const CAMPAIGNS = resolve(import.meta.dirname, 'campaigns');
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

function placeOrder(body: {
  payment_detail: { payment_method: string; card_token?: string };
  success_url: string;
  payment_failed_url: string;
}) {
  const ref = `DEV${1000 + ++orders}`;
  const { payment_method: method, card_token: token } = body.payment_detail;
  console.log(`[dev] order ${ref} by ${method}`);
  if (token === 'dev_tok_decline') {
    return {
      status: 400,
      body: { payment_response_code: '51', payment_details: 'Insufficient funds (dev mock: card 4000 0000 0000 0002)' },
    };
  }
  if (method !== 'card_token') {
    const gateway = new URL('/__dev/gateway', body.success_url);
    gateway.search = new URLSearchParams({
      ref,
      method,
      success: body.success_url,
      failure: body.payment_failed_url,
    }).toString();
    return { status: 201, body: { ref_id: ref, payment_complete_url: gateway.href } };
  }
  return { status: 201, body: { ref_id: ref } };
}

const GATEWAY = (q: URLSearchParams) => {
  const success = new URL(q.get('success')!);
  success.searchParams.set('ref_id', q.get('ref')!);
  return `<!doctype html><meta name="viewport" content="width=device-width"><title>Dev gateway</title>
<body style="font:16px system-ui;max-width:28rem;margin:4rem auto;padding:0 1rem">
<h1>Dev payment gateway</h1><p>Order <b>${q.get('ref')}</b> paid by <b>${q.get('method')}</b>. Nothing is charged.</p>
<p><a href="${success.href}">Approve</a> · <a href="${q.get('failure')}">Fail the payment</a></p></body>`;
};

export function mockApi(live: boolean) {
  mkdirSync(CAMPAIGNS, { recursive: true });
  const warned = new Set<string>();

  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = new URL(req.url ?? '/', 'http://dev');
    if (url.pathname === '/__dev/gateway') {
      res.writeHead(200, { 'content-type': 'text/html' });
      return res.end(GATEWAY(url.searchParams));
    }

    if (url.pathname.startsWith('/__mock/rules/')) {
      const app = await rulesApp();
      if (!app) return send(res, 503, { error: 'no local i18n-rules' });
      const body = req.method === 'POST' ? await bodyOf(req) : undefined;
      const answer = await app.fetch(
        new Request(`http://rules${url.pathname.slice('/__mock/rules'.length)}${url.search}`, {
          method: req.method,
          headers: { 'content-type': 'application/json' },
          body,
        }),
        {},
      );
      res.writeHead(answer.status, { 'content-type': 'application/json' });
      return res.end(await answer.text());
    }

    if (!url.pathname.startsWith('/__mock/api/')) return next();
    const path = url.pathname.slice('/__mock/api'.length);
    const key = String(req.headers.authorization ?? '');
    const raw = req.method === 'POST' ? await bodyOf(req) : '';
    const body = raw ? JSON.parse(raw) : undefined;

    if (live && (path === '/api/v1/campaigns/' || path === '/api/v1/carts/calculate/')) {
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

    if (path === '/api/v1/carts/') {
      console.log(`[dev] prospect cart for ${body?.user?.email}`);
      return send(res, 201, { id: Date.now(), checkout_url: `${url.origin}/__dev/cart` });
    }
    if (path === '/api/v1/orders/') {
      const order = placeOrder(body);
      return send(res, order.status, order.body);
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
