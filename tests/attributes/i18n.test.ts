import { afterEach, describe, expect, it, vi } from 'vitest';
import { bindI18n, parseI18n } from '../../src/attributes/i18n';
import { Logger } from '../../src/engine/runtime/log';

const locales =
  (trees: Record<string, unknown>) =>
  async (url: string): Promise<Response> => {
    const lang = url.split('/v1/locales/')[1]!.split('-')[0]!;
    const served = trees[lang] ? lang : 'en';
    return new Response(JSON.stringify(trees[served] ?? {}), { headers: { 'content-language': served } });
  };

afterEach(() => {
  document.body.innerHTML = '';
});

describe('data-next-i18n (0.4.x)', () => {
  it('reads i18next’s key;[attribute]key and refuses attributes that could carry markup or a URL', () => {
    expect(parseI18n(' checkout.pay ; [Title]checkout.pay.hint;[href]page.link;[alt]')).toEqual({
      targets: [
        { attribute: null, key: 'checkout.pay' },
        { attribute: 'title', key: 'checkout.pay.hint' },
      ],
      refused: ['href'],
    });
  });

  it('writes the page’s translations at once, then i18n-rules’ texts, and keeps the page’s words for a missing key', async () => {
    document.body.innerHTML = `
      <h2 id="title" data-next-i18n="checkout.contact.title">Contact</h2>
      <input id="email" placeholder="Email" data-next-i18n="[placeholder]fields.email.label">
      <button id="pay" aria-label="Pay now" data-next-i18n="checkout.pay;[aria-label]checkout.pay.aria">Pay</button>`;
    const send = vi.fn(
      locales({ th: { checkout: { contact: { title: 'ติดต่อ' } }, fields: { email: { label: 'อีเมล' } } } }),
    );
    const loaded = bindI18n(document, { send, lang: 'th-TH', page: { 'checkout.pay': 'ชำระเงิน' }, log: new Logger() });
    const $ = (id: string) => document.getElementById(id)!;

    expect($('pay').textContent).toBe('ชำระเงิน');
    expect($('title').textContent).toBe('Contact');
    await loaded;
    expect(send).toHaveBeenCalledWith('https://i18n-rules.nextcommerce.com/v1/locales/th-TH', { method: 'GET' });
    expect($('title').textContent).toBe('ติดต่อ');
    expect($('email').getAttribute('placeholder')).toBe('อีเมล');
    expect($('pay').getAttribute('aria-label')).toBe('Pay now');
  });

  it('keeps the page’s words when i18n-rules has no file for the language and answers in English', async () => {
    document.body.innerHTML = `<h2 data-next-i18n="checkout.contact.title">Contact</h2>`;
    const send = locales({ en: { checkout: { contact: { title: 'Contact details' } } } });
    await bindI18n(document, { send, lang: 'ja', page: {}, log: new Logger() });
    expect(document.querySelector('h2')!.textContent).toBe('Contact');
  });

  it('warns about a refused attribute and leaves the text of an element with child elements alone', async () => {
    document.body.innerHTML = `<button data-next-i18n="checkout.pay;[href]page.link"><svg></svg>Pay</button>`;
    const log = new Logger();
    const warn = vi.spyOn(log, 'warn');
    await bindI18n(document, { send: locales({}), lang: 'fi', page: { 'checkout.pay': 'Maksa' }, log });
    expect(document.querySelector('button')!.innerHTML).toBe('<svg></svg>Pay');
    expect(warn.mock.calls.map(([m]) => m)).toEqual([
      expect.stringContaining('cannot translate [href]'),
      expect.stringContaining('child elements'),
    ]);
  });
});
