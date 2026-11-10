import type { Run, Scenario } from '../harness';

const IDS = ['price', 'legacy', 'amount', 'code', 'currency'] as const;
type Texts = Record<(typeof IDS)[number], string>;

async function prices(t: Run, config: object): Promise<Texts> {
  await t.config(config);
  await t.open('/e2e/shop/', {}, { tab: true });
  await t.page.waitForFunction(() => document.getElementById('currency')?.textContent);
  return t.page.evaluate(
    (ids) => Object.fromEntries(ids.map((id) => [id, document.getElementById(id)!.textContent])) as Texts,
    IDS,
  );
}

/** How a price is written by currency, page language and the page's own format (#125). */
export const scenario: Scenario = async (t) => {
  const en = await prices(t, { apiKey: 'e2e-cad' });
  t.check(en.price === 'CA$49.90' && en.legacy === 'CA$49.90', '#125 CAD is CA$… on an English page', en);
  t.check(en.amount === '49.90', '#125 data-next-format="amount" writes the number alone', en.amount);
  t.check(en.code === '$49.90 CAD', '#125 data-next-format="currency_code" writes $… CAD', en.code);

  const home = await prices(t, { locale: 'en-CA' });
  t.check(home.price === '$49.90' && home.legacy === '$49.90', '#125 CAD is $… under locale en-CA', home);

  const own = await prices(t, { translations: { en: { 'formats.currency.CAD': 'C${amount}' } } });
  t.check(own.price === 'C$49.90' && own.legacy === 'C$49.90', "#125 the page's formats.currency.CAD wins", own);
  t.check(own.amount === '49.90', '#125 "amount" stays the number alone under a page format', own.amount);

  const aud = await prices(t, { apiKey: 'e2e-aud', locale: 'en' });
  t.check(aud.price === 'A$49.90' && aud.currency === 'AUD', '#125 AUD is A$… on an English page', aud);

  const usd = await prices(t, { apiKey: 'LLbBgtusfE2zopDcjnOY9NbrlN690zSjuedqQ04J' });
  t.check(usd.price === '$49.00' && usd.code === '$49.00 USD', '#125 USD stays $…', usd);
};
