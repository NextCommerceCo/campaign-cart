---
title: 'Language'
group: 'Attribute Reference/Setup'
order: 104
---

# Language

The SDK writes prices, the checkout's labels and its messages in one language: `nextConfig.locale`,
else the campaign's. `nextConfig.translations` gives the page's own wording for any of them, by key.

```html
<script>
  window.nextConfig = {
    locale: 'th-TH',
    translations: {
      th: {
        'fields.state.errors.blank': 'กรุณาเลือกจังหวัด',
        payment: { errors: { generic: 'ชำระเงินไม่สำเร็จ ลองอีกครั้ง' } },
      },
    },
  };
</script>
<script type="module" src=".../loader.js" data-campaign="pk_…"></script>
```

Set `nextConfig` before the [loader script](loader-script.md).

## nextConfig.locale

A language tag: `th`, `th-TH`, `de-DE`. Without it, the campaign's language.

| Reaches      | How                                                                          |
| ------------ | ---------------------------------------------------------------------------- |
| Prices       | Formatted the language's way: `1.234,56 €` for `de-DE`, `€1,234.56` for `en` |
| The checkout | The address service's labels, field messages and country names come in it    |
| Every text   | Which language of `translations` is read, and of the address service's texts |

A tag the browser does not know formats prices the browser's way. For a language the address
service has no texts in, it answers in English, and the checkout reads English where the page's
`translations` say nothing.

## nextConfig.translations

The page's texts by language, keyed as the address service keys them. A key for `th-TH` is read
first, then `th`. Nested objects read as dotted keys, as i18next reads them:
`{ payment: { errors: { generic: '…' } } }` is `payment.errors.generic`. Set only the keys to change.

Each text the SDK writes comes from, in order:

1. the page's `translations` in the language;
2. the address service's texts in the language (`https://i18n-rules.nextcommerce.com/v1/locales/th`
   lists every key and its wording);
3. English.

## Keys

| Text                                              | Key                                                                                                                                                                                                                                                              |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A field's label                                   | `fields.<field>.label`; `fields.<field>.label_optional` when it is not required                                                                                                                                                                                  |
| A field's message                                 | `fields.<field>.errors.<error>`: `blank` (it also covers a dropdown's `not_selected`), `invalid`, `invalid_characters`, `contains_emoji`, `too_long`. `{{example}}` and `{{max}}` are filled in                                                                  |
| One country's wording                             | The field's `label_id` in place of `fields.<field>`: `fields.postcode.zip_code.errors.invalid` is the message of a ZIP Code only. The address service's rules for a country give each field's `label_id`                                                         |
| The card fields                                   | `payment.card.number.label`, `.placeholder`, `.title`, the same under `payment.card.cvv`; `payment.card.number.errors.invalid`, `payment.card.cvv.errors.invalid`, `payment.card.expiry_month.errors.blank`, `.expired`, `payment.card.expiry_year.errors.blank` |
| Card details that timed out                       | `payment.card.errors.session_expired`                                                                                                                                                                                                                            |
| A declined payment                                | `payment.errors.<code>`, the gateway's code (`3005`); then the page's own `payment.errors.generic`; then the gateway's words; then the address service's `payment.errors.generic`                                                                                |
| `message` of the 0.4.x `coupon:validation-failed` | `coupon.errors.invalid`, `coupon.errors.already_applied`, `coupon.errors.network`, with `{{code}}`. The address service's texts are used only once the page has loaded them (a checkout, or a page with `data-next-i18n`)                                        |
| Any text on the page                              | Any key, with [data-next-i18n](../display/data-next-i18n.md)                                                                                                                                                                                                     |

`<field>` is the address service's name: `first_name`, `last_name`, `email`, `phone_number`,
`line1`, `line2`, `city`, `state`, `postcode`, `country`. A billing field uses the same key as its
shipping field.

## 0.4.x

`locale` and `translations` are read as 0.4.x read them. Without `locale`, 0.4.x formatted prices in
the browser's language and wrote the checkout in English; now both follow the campaign's language.
