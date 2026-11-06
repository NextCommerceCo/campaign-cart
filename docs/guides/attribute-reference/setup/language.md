---
title: 'Language'
group: 'Attribute Reference/Setup'
order: 104
---

# Language

Prices and the checkout's texts are in `nextConfig.locale`, else the campaign's language.
`nextConfig.translations` replaces any text by its key. Set both before the
[loader script](loader-script.md).

```html
<script>
  window.nextConfig = {
    locale: 'fr-FR',
    translations: {
      fr: { 'fields.postcode.errors.blank': 'Il nous faut votre code postal' },
    },
  };
</script>
```

A text comes from the page's `translations` (`fr-FR`, then `fr`), then the address service, then
English. Every key, its default in each language and how to override it:
[Languages](https://i18n-rules-docs.next-commerce.workers.dev/languages/index/).

| Text                     | Key                                                                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A field's message        | `fields.<field>.errors.<error>`                                                                                                                        |
| City, state and postcode | `fields.<field>.label`; other labels the page writes with [data-next-i18n](../display/data-next-i18n.md)                                               |
| Card fields              | `payment.card.*`                                                                                                                                       |
| A declined payment       | `payment.errors.<code>`, else `payment.errors.generic` ([Payment errors](https://i18n-rules-docs.next-commerce.workers.dev/reference/payment-errors/)) |
