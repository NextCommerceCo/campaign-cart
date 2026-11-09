import type { Engine } from '../engine/engine';
import { icon } from './icons';
import { type From, type Group, readSource, type SourceParam, checkLink } from './source';
import { badge, button, h, nodes, tsugiCard } from './view';

const TONES = { done: 'green', warn: 'amber', off: 'dim' };

const TITLES: Record<Group, string> = {
  campaign: 'Campaign',
  click: 'Click IDs and pixel cookies',
  affiliate: 'Affiliate',
  visit: 'Visit',
};
const FROM: Record<From, string> = {
  landing: 'Landing',
  page: 'This page',
  earlier: 'Earlier page',
  cookie: 'Cookie',
  visit: 'Visit',
};
const cookie = (name: string) =>
  decodeURIComponent(document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))?.[1] ?? '') || undefined;

export const sourceOf = (engine: Engine) => {
  const { visit } = engine.getState();
  return readSource({
    params: visit.params,
    landing: visit.landing,
    current: location.href,
    attribution: engine.attribution(),
    cookies: { fbc: cookie('_fbc'), fbp: cookie('_fbp') },
  });
};

const copy = (text: string) => void navigator.clipboard?.writeText(text);

const linkTester = () => {
  const input = h('input', {
    type: 'url',
    className: 'input',
    ariaLabel: 'Ad link',
    placeholder: 'https://shop.com/landing?utm_source=…',
  });
  const result = h('div', 'jlinkres');
  const run = () => {
    const found = checkLink(input.value.trim());
    const line = (label: string, keys: string[], tone: string) =>
      keys.length > 0 && h('p', tone, `${label}: ${keys.join(', ')}`);
    result.replaceChildren(
      ...nodes(
        found
          ? [
              line('On the order', found.order, 'green'),
              line('Carried on links only', found.linksOnly, 'amber'),
              line('Not tracked', found.other, 'dim'),
              !found.order.length && !found.linksOnly.length && h('p', 'dim', 'No attribution params in this link'),
            ]
          : [h('p', 'red', 'Enter a full link, starting with https://')],
      ),
    );
  };
  input.addEventListener('keydown', (e) => e.key === 'Enter' && run());
  input.addEventListener('input', () => result.replaceChildren());
  return h('div', 'jlink', h('div', {}, input, button('Check', run, { variant: 'outline', size: 'sm' })), result);
};

export function sourceView(engine: Engine): HTMLElement {
  const s = sourceOf(engine);
  const row = (p: SourceParam) =>
    h(
      'tr',
      {},
      h('td', {}, h('code', {}, p.key)),
      h(
        'td',
        {},
        h('code', {}, p.value),
        p.was && h('small', 'dim', `was ${p.was} on landing`),
        p.note && h('small', 'amber', p.note),
      ),
      h('td', {}, badge(FROM[p.from], 'outline')),
      h(
        'td',
        {},
        p.order && badge('Order', 'secondary'),
        p.events && badge('Events', 'secondary'),
        !p.order && badge(p.from === 'cookie' ? 'Not recorded' : 'Links only', 'warning'),
      ),
    );
  const groups = (['campaign', 'click', 'affiliate', 'visit'] as const).flatMap((g) => {
    const rows = s.params.filter((p) => p.group === g);
    return rows.length ? [h('tr', 'jgroup', h('th', { colSpan: 4 }, TITLES[g])), ...rows.map(row)] : [];
  });
  const payload = engine.attribution();
  const link = new URLSearchParams(
    s.params.filter((p) => p.from !== 'cookie' && p.group !== 'visit').map((p) => [p.key, p.value]),
  );

  return tsugiCard(
    'jpage',
    h('div', {}, h('h3', {}, s.headline), h('p', 'jmeta', 'Source of this tab · sent with the order as attribution')),
    (s.platforms.length > 0 || payload.funnel) &&
      h(
        'div',
        'jsent',
        ...s.platforms.map((name) => badge(name, 'success')),
        payload.funnel && badge(`Funnel ${payload.funnel}`, 'outline'),
      ),
    s.ignored &&
      h('p', 'amber', 'Tracking events are off in this tab (?ignore=true); the order still carries attribution'),
    h(
      'dl',
      'jstats',
      ...s.steps.map((step) =>
        h(
          'div',
          {},
          h('dt', {}, step.label),
          h('dd', TONES[step.tone], step.tone === 'done' && icon('tick'), step.detail),
        ),
      ),
    ),
    h(
      'table',
      'jparams',
      h('thead', {}, h('tr', {}, ...['Param', 'Value', 'From', 'Reaches'].map((t) => h('th', {}, t)))),
      h('tbody', {}, ...groups),
    ),
    s.unset.length > 0 && h('p', 'jmeta', `Not set: ${s.unset.join(', ')}`),
    h(
      'div',
      'jacts',
      button('Copy as link params', () => copy(link.toString()), { variant: 'outline', size: 'sm' }),
      button('Copy order payload', () => copy(JSON.stringify(payload, null, 2)), { variant: 'outline', size: 'sm' }),
    ),
    linkTester(),
  );
}
