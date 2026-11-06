---
title: 'data-next-i18n'
group: 'Attribute Reference/Display'
order: 306
---

# data-next-i18n

Replaces the element's text, or one of its attributes, with a key's text in the page's
[language](../setup/language.md). The page writes its words once, in any language; where neither
the page's `translations` nor the address service has the key, they stay as written.

```html
<h2 data-next-i18n="checkout.contact.title">Contact</h2>
<input placeholder="Email" data-next-i18n="[placeholder]fields.email.label" />
<button aria-label="Pay now" data-next-i18n="checkout.pay;[aria-label]checkout.pay.label">Pay</button>
```

## Value

`key` for the text, `[attribute]key` for an attribute, several separated by `;` (i18next's
syntax). The attributes are `placeholder`, `aria-label`, `title` and `alt`; any other is left
alone, with a warning.

The address service has the checkout's headings and field labels in every language it serves:
`checkout.contact.title`, `checkout.shipping.title`, `checkout.billing.title`,
`checkout.billing.same_as_shipping`, `fields.<field>.label`. Any other key comes from the page's
[`translations`](../setup/language.md#nextconfigtranslations).

## Rules

- The page's `translations` are written before the page is shown; the address service's texts a
  moment later, when they arrive.
- A translation is written as text, never as markup.
- An element with child elements (an icon, a link) keeps its text, with a warning: put the words in
  a `<span>` of their own.
- Keys are read once, as the page loads. Elements added later are not translated.

## Set by the SDK

The text or the attribute. Its code loads only on pages that use it.
