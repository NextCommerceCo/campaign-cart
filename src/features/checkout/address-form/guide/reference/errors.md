---
title: "Features/Checkout/Address Form/Errors"
group: "Features"
category: "Address Form"
---

# Errors

<!-- Generated from the feature manifest. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

Every error `address-form` can raise, at the exact message, so a console line can be matched to a cause.

**Recoverable** means the visitor can get past it by retrying or correcting what they entered — no code change needed. **Fatal** means it happens every time until the markup, code, or config changes.

## `Address layout for {countryCode} responded {status} {statusText}`

| | |
|---|---|
| Type | Recoverable |
| Cause | The layout service answered with a non-OK status — an unreachable host, a blocked request, or the service briefly unavailable. An unknown country code is not a cause: an uncurated country is answered with a generic layout rather than an error. |

**Fix:** Nothing to change in the markup. The block keeps whatever it had rendered, so a visitor part-way through an address does not lose it, and a page that has not rendered yet stays empty — check the host in `data-next-address-api` if one is set.

---

## `Address layout for {countryCode} carried no layout`

| | |
|---|---|
| Type | Recoverable |
| Cause | The service answered, but the body had no `spec.layout`. A proxy or a captive portal returning an HTML page in place of the JSON is the realistic cause. |

**Fix:** Open the layout URL directly and confirm it returns JSON with a `spec.layout` array. If `data-next-address-api` points at your own deployment, it is answering the route with something else.
