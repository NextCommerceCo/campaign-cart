---
title: "Features/Display/I18n/Use Cases"
group: "Features"
category: "I18n"
---

# Use Cases

## A checkout page sold in several languages

> Effort: lightweight

**When:** One campaign page is shown to shoppers in Thailand and Germany, and its
headings have to read in each one's language.

**Why this enhancer:** The headings the SDK builds a form under (`checkout.contact.title`
and the rest) ship in every language the address service has, so the page names the key
and writes its English text once.

**Watch out for:** The page's language is `window.nextConfig.locale`, not the browser's.
A page that does not set it reads English.

---

## A brand's own words, translated by the page

> Effort: lightweight

**When:** A subtitle, a button or a security note in the brand's voice, translated by the
people who wrote it.

**Why this enhancer:** The page adds its keys to `window.nextConfig.translations` for
each language and names them in `data-next-i18n`; the SDK writes them.

**Watch out for:** A key missing from a language leaves the page's own text there, so a
missing translation shows as English rather than as a gap.

---

## The label of a field the page writes

> Effort: lightweight

**When:** The page writes its own email field, or the name and phone outside the address.

**Why this enhancer:** Those fields are named the same in every country, and the SDK
ships their labels (`fields.email.label`, `fields.phone_number.label_optional` and the rest)
in every language.

**Watch out for:** The phone has two keys: `fields.phone_number.label` when the page makes it
required, `fields.phone_number.label_optional` when it does not. The names and the email are always required.

---

## When NOT to use this

### The address fields

**Why not:** An address field's name changes with the country (ZIP Code, Postcode), not
only with the language, and a key cannot.

**Use instead:** `data-next-address`, which builds the address fields with the country's
own labels.
