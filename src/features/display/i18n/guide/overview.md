---
title: "Features/Display/I18n/Overview"
group: "Features"
category: "I18n"
---

# I18n

> Category: `display`
> Last reviewed: 2026-09-25
> Owner: Campaign Cart SDK

`data-next-i18n` puts a page's words into the shopper's language without writing the
page once per language. The page writes its text in one language and names a key; the
SDK replaces the text, or an attribute, with that key's translation in the page's
language, and leaves the page's own words where it has none.

## Concept

A lookup by key, run again whenever the language or the texts behind it change.

```
data-next-i18n="checkout.pay;[title]checkout.pay.hint"
        │
        ▼  parseI18n (utils/i18n-spec.ts)
[{ attribute: null, key: 'checkout.pay' }, { attribute: 'title', key: 'checkout.pay.hint' }]
        │
        ▼  translatedText (core/country-service/country-service.translations.ts)
nextConfig.translations[lang][key]  ??  service texts in lang  ??  what the HTML said
```

## Business logic

- The language is `addressLang()`: the debug locale picker's choice, then
  `window.nextConfig.locale`, then English.
- A key is looked up in the page's `translations` for the language (`th-TH`, then `th`),
  then in the address-rules service's texts in that language
  (`CountryService.getTexts`). A text from another language is never used: a page with
  no translation keeps what its HTML says.
- What each target held before it was translated is read once, at initialisation, and
  written back when a later language has no translation.
- Only the text and `placeholder`, `aria-label`, `title` and `alt` are written. Any other
  attribute is refused with a warning, and text is written with `textContent`, never as
  markup.
- An element with child elements keeps them: its text is not replaced, with a warning.
- The texts for a language chosen after boot are fetched on first use
  (`CountryService.loadTexts`, one request per language), and every translated element
  repaints on `address:messages-loaded`.
- `data-next-label` on a checkout field leaves a placeholder or `aria-label` this
  translates.

## Decisions

- We chose i18next's `[attribute]key;key` syntax over one attribute per target because a
  page translating several attributes would otherwise carry several `data-next-i18n-*`
  attributes on one element.
- We chose an allowlist of four attributes over i18next's any attribute because a
  translation string reaching `href` or an event handler would be markup on a checkout
  page.
- We chose to keep the page's own text over falling back to English because an English
  word on a Thai page is the mixed-language page this exists to prevent.
- We chose to keep the service's texts per language apart from the validation messages
  because those go with one country's field names in one language, and switching them
  alone would mix languages inside a sentence.

## Limitations

- Does not interpolate values into a translation: `{name}` is written as typed.
- Does not translate markup, or the text of an element with child elements.
- Does not translate attributes other than the four listed.
- Reads its keys once: changing `data-next-i18n` after initialisation is not noticed.
