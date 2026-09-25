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

## When NOT to use this

### The label of a checkout field

**Why not:** A field's name changes with the country (ZIP Code, Postcode), not only with
the language, and a key cannot.

**Use instead:** `data-next-label` — writes the field's label, placeholder and
`aria-label` from the country's rules.
