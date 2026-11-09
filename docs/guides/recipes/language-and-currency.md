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
    translations: { fr: { 'page.title': 'Écouteurs Olympus', 'page.cta': 'Commander' } },
  };
</script>

<h1 data-next-i18n="page.title">Olympus earbuds</h1>
<p><span data-next-query="package.1.price"></span> <span data-next-query="campaign.currency"></span></p>
<a href="checkout.html" data-next-i18n="page.cta">Order now</a>

<a href="?currency=EUR">Prices in euros</a> · <a href="?lang=en">English</a>
```

Set `window.nextConfig` before the [loader script](../attribute-reference/setup/loader-script.md).
Texts are in `?lang=`, else `locale`, else the campaign's language; a `data-next-i18n` key that
neither the page's `translations` nor the address service has keeps the words written in the
page. `?currency=EUR` loads the campaign priced in euros, and prices are written in the page's
language (`49,00 €` in `fr-FR`). Links to the site's other pages carry both parameters.

| Style                              | When                                 |
| ---------------------------------- | ------------------------------------ |
| `html:not([data-next-ready]) span` | prices are not loaded yet: hide them |

**Events**: `campaign.loaded`, with the campaign in the currency it was loaded in.

**See also**: [Language](../attribute-reference/setup/language.md),
[URL parameters](../attribute-reference/setup/url-parameters.md),
[data-next-i18n](../attribute-reference/display/data-next-i18n.md).
