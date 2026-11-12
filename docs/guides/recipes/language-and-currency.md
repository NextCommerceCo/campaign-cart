---
title: 'Recipes/Language and currency'
group: 'Recipes'
category: 'Recipes'
order: 11
---

# Language and currency

The page's own words in the shopper's language, and prices in the currency the link asked for.

```html
<script>
  window.nextConfig = {
    locale: 'fr-FR',
    translations: {
      fr: { 'page.title': 'Écouteurs Olympus', 'page.cta': 'Commander', 'formats.currency.CAD': '{amount} $ CA' },
    },
  };
</script>

<h1 data-next-i18n="page.title">Olympus earbuds</h1>
<p><span data-next-query="package.1.price"></span> <span data-next-query="campaign.currency"></span></p>
<a href="checkout.html" data-next-i18n="page.cta">Order now</a>

<a href="?currency=EUR">Prices in euros</a> · <a href="?lang=en">English</a>

<div data-next-each="campaign.available_currencies">
  <template><button data-next-action="setCurrency" data-next-query="label"></button></template>
</div>
```

Set `window.nextConfig` before the [loader script](../attribute-reference/setup/loader-script.md).
Texts are in `?lang=`, else `locale`, else the campaign's language; a `data-next-i18n` key that
neither the page's `translations` nor the address service has keeps the words written in the
page. `?currency=EUR` loads the campaign priced in euros, and prices are written in the page's
language (`49,00 €` in `fr-FR`). Links to the site's other pages carry both parameters.

`setCurrency` opens the page again with `?currency=<code>`, for a currency the campaign sells in;
the cart keeps its lines and is priced again. The button of the currency in use is disabled. A
`<select>` calls the same action:

```html
<select data-next-query="campaign.currency" onchange="next.actions.setCurrency({ code: this.value })">
  <option value="USD">USD</option>
  <option value="EUR">EUR</option>
</select>
```

## Currencies that share `$`

CAD, AUD, NZD, HKD and MXN are written with their prefix in a language without a region, and with
the sign their own market uses in that market's language. A store that sells in its home market sets
`nextConfig.locale` to it (`en-CA`, `en-AU`, `es-MX`). SGD, like every other currency, keeps its
narrow symbol.

| Currency | `en`       | Home locale        |
| -------- | ---------- | ------------------ |
| USD      | `$49.90`   | `en-US` `$49.90`   |
| CAD      | `CA$49.90` | `en-CA` `$49.90`   |
| AUD      | `A$49.90`  | `en-AU` `$49.90`   |
| NZD      | `NZ$49.90` | `en-NZ` `$49.90`   |
| HKD      | `HK$49.90` | `en-HK` `HK$49.90` |
| MXN      | `MX$49.90` | `es-MX` `$49.90`   |
| SGD      | `$49.90`   | `en-SG` `$49.90`   |

A page writes a currency its own way with the text `formats.currency.<code>` in its
`translations`, in the page's language. It applies to every price the SDK writes, from the first
one.

| `formats.currency.CAD`          | Writes       |
| ------------------------------- | ------------ |
| `narrowSymbol`                  | `$49.90`     |
| `symbol`                        | `CA$49.90`   |
| `code`                          | `CAD 49.90`  |
| `C${amount}`                    | `C$49.90`    |
| `{narrowSymbol}{amount} {code}` | `$49.90 CAD` |

A pattern has `{amount}` (the number in the page's language, with the currency's own decimals) and
may have `{symbol}`, `{narrowSymbol}` and `{code}`. Any other value is left out and the SDK's own
format is used. To write the symbol in the page itself, read the number with
[`data-next-format="amount"`](../attribute-reference/display/data-next-query.md).

| Style                              | When                                 |
| ---------------------------------- | ------------------------------------ |
| `html:not([data-next-ready]) span` | prices are not loaded yet: hide them |

**Events**: `campaign.loaded`, with the campaign in the currency it was loaded in.

**See also**: [Language](../attribute-reference/setup/language.md),
[URL parameters](../attribute-reference/setup/url-parameters.md),
[data-next-i18n](../attribute-reference/display/data-next-i18n.md).
