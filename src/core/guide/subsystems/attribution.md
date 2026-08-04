---
title: "Core/Attribution"
group: "Core"
category: "Core Subsystems"
---

# Attribution capture

> Category: `core`
> Last reviewed: 2026-07-31
> Owner: Campaign Cart SDK

When a visitor buys, somebody needs to be credited: the affiliate who sent them, the ad
that was paid for, the funnel the page belongs to. This part of the engine records where
the visitor came from — the `utm_*` tags and affiliate ids on the landing URL, the click
ids Google and Facebook append, the referrer, the funnel name declared by the page — carries
them across every page of the funnel, and attaches them to the order at checkout. Nothing
on the page looks wrong when it fails. The symptom appears days later, in a payout report
or a campaign that shows spend and no conversions, which is why this is worth understanding
before you need it.

## Concept

Attribution is resolved **per parameter, once per page load, before the campaign is
fetched** — and the resolution rule is the whole mental model:

```
for each attribution parameter:

    is it in the URL?  ──yes──►  use it, and mirror it into sessionStorage
              │                  under its own name
              no
              ▼
    is it in sessionStorage?  ──yes──►  use it (this tab, earlier page)
              │
              no
              ▼
    is it in localStorage?  ──yes──►  use it (an earlier visit)
              │
              no
              ▼
    is it in the persisted next-attribution blob?  ──yes──►  use it
              │
              no
              ▼
    empty string — the order goes out without it
```

Two things follow, and the second is the one people get wrong.

**A parameter that is absent carries over.** A visitor who arrives from an ad, browses for
twenty minutes, and reaches the checkout through an internal link that carries no tags at
all still has the ad's `utm_source` on their order — it came back out of storage. This is
what makes attribution survive a funnel.

**A parameter that is present overwrites.** The URL is checked *first*, so a second tagged
link inside the same session replaces the value from the first one, per parameter. Landing
on `?utm_source=facebook` and later on `?utm_source=google` sends `google`. It is
last-touch per parameter, with carry-over — not first-touch. Two things are pinned rather
than overwritten: `first_visit_timestamp`, which keeps the moment of the session's first
page load, and the funnel name once it has been set from a meta tag or the campaign (see
below).

Capture runs at **boot step 4**, after the currency is resolved and before the campaign
loads, which is why it is available to everything downstream — analytics, the prospect
cart, the order — and why nothing the page does after boot participates in it unless it
calls the API deliberately. The step order is in the
[boot sequence](../reference/boot-sequence.md).

The record itself lives in the attribution store, persisted to sessionStorage. Its
field-by-field schema, its example payload, and what reaches the order API are in the
[attribution store reference](../../../state/attribution/guide/reference/state-reference.md)
— this page does not repeat them. The parameters it reads are listed in
[URL parameters](../reference/url-parameters.md) and the tags it reads in
[meta tags](../reference/meta-tags.md).

## Business logic

**What is collected.** Three groups. The **credited fields** that the order API knows by
name: `affiliate` (from `affid` or `aff`), `funnel`, `gclid`, the five `utm_*` tags, and
`subaffiliate1`–`5` (each also accepting the short `sub1`–`sub5` alias). The **metadata
object**, which is forwarded to the order wholesale: landing page, referrer, full user
agent, a mobile/desktop guess, hostname, timestamps, the Facebook `_fbp`/`_fbc` cookies
and pixel id, `fbclid`, a generic `clickid`, the Everflow click id, plus the SDK version
and the visitor's IP. And any **custom tracking tags** the page declares as meta tags,
which land in metadata under names you choose.

**Long values are cut, not rejected.** A `subaffiliate` longer than 225 characters is
truncated to 225 with a warning logged, because the order API rejects longer ones.
Symptom: a network's tracking string arrives at the affiliate platform incomplete. Fix:
shorten it at the source — the truncation cannot be turned off.

**The funnel name has its own chain, and it is the one sticky field.** `?funnel=` always
wins and logs the override. Failing that: a funnel already remembered for this visitor,
then the page's own `next-funnel` or `data-next-tracking-tag` meta tag, then — only if
still empty when the campaign loads — the campaign's name. The remembered value is written
to **both** sessionStorage and localStorage, so it outlives the tab. Symptom: you change
the meta tag, reload, and orders still report the old funnel; or a visitor who sees two
campaigns in one browser reports both under the first funnel. Fix: load the page once with
`?funnel=` set, or call `useAttributionStore.getState().clearPersistedFunnel()`, which
removes both copies.

**Some values are written to localStorage and therefore outlive the session.** The funnel
name and the Everflow click id (`evclid`) are each written to both browser stores and read
back from either. Symptom: you cleared the value, reloaded, and it came back. Fix: clear
both stores — see the [storage keys cautions](../reference/storage-keys.md#cautions).

**Empty fields are dropped on the way to the order.** The API payload is built by omitting
every empty string, so a parameter that was never present is absent rather than blank. The
metadata object is always sent, and it is sent whole.

**Metadata carries personal data.** The visitor's IP, their full user agent, and the click
ids identify an individual, and the whole object is forwarded to the order. Symptom: a
third-party pixel or logging endpoint quietly receives identifiable data because the page
passed `metadata` through. Fix: pick the keys you need explicitly rather than forwarding
the object.

**Overriding a key the SDK collects itself does not stick.** `next.setMetadata()` and
`next.addMetadata()` write to the same object, but a key the SDK collected at boot —
`landing_page`, `referrer`, `fbclid`, a custom tracking tag it already read — is restored
to its boot-time value the next time the cart changes. A key of your own is untouched.
Fix: use your own key names for your own data, and treat the collected ones as read-only.

**Attribution never blocks the boot.** A failure inside this step is logged and the
sequence continues, so a page with broken attribution sells normally and reports nothing.
Fix: confirm the record exists rather than assuming an absent error means an absent
problem — `next.debugAttribution()` prints the whole record and the API-shaped payload,
and the debug overlay has a panel for it.

### `utm-transfer` — the part that rewrites your links

The second half of this subsystem propagates the current page's query parameters onto the
page's own links, so a visitor who clicks through to the checkout arrives with the tags
they landed with. It is worth its own section because it modifies your markup.

**It is off unless you turn it on**, and only `window.nextConfig` turns it on — there is no
meta tag:

```html
<script>
  window.nextConfig = {
    apiKey: 'YOUR_API_KEY',
    utmTransfer: {
      enabled: true,
      applyToExternalLinks: false,
      paramsToCopy: ['utm_source', 'utm_medium', 'utm_campaign', 'affid'],
      excludedDomains: ['support.example.com'],
    },
  };
</script>
```

**What it touches.** Every `<a>` element on the page, plus every `<a>` added to the DOM
afterwards — it watches `document.body` for new nodes, so links a feature renders later are
covered too. Each link gets a click handler and a `data-utm-enhanced="true"` marker so it is
never wired twice.

**When it rewrites.** In the click handler, not at page load. The `href` you see in
devtools, in the status bar on hover, or in a right-click "copy link address" is the
original — the parameters are added the moment the link is clicked, before the browser
navigates. Symptom: you inspect the page, see unchanged hrefs, and conclude the feature is
not running. Fix: click the link and read the address bar on the next page, or check the
console for `Updated link … to …` with debug logging on.

**What it skips.** Fragment links (`#…`), `javascript:`, `mailto:`, `tel:`, `sms:` and
`whatsapp:` links are left alone. External links are left alone unless
`applyToExternalLinks: true`, and even then any URL containing one of `excludedDomains` is
skipped. A parameter the link already carries is never overwritten — the link's own value
wins. And if the current URL has no query string at all, the feature does nothing.

**Which parameters.** All of the current URL's parameters by default, which includes ones
that have nothing to do with attribution — `debug`, `ref_id`, whatever else is on the
address bar. Symptom: internal links start carrying `?debugger=true` around the funnel, or
an order reference is propagated onto a link that should not have one. Fix: name the
parameters you want in `paramsToCopy`.

**How it decides a link is external.** A URL counts as external when it contains `://` and
does *not* contain the current hostname anywhere in its text. Two edge cases follow: a
protocol-relative link (`//example.com/x`) is treated as internal, and an external URL that
mentions your hostname in a query parameter — a redirect or a tracking wrapper — is also
treated as internal. Symptom: parameters leak onto a third-party link with
`applyToExternalLinks: false`. Fix: add the destination to `excludedDomains`.

## Decisions

- **We chose to check the URL before storage** rather than protecting the first-touch
  values, because a marketer who sends a tagged link to a page mid-funnel expects that link
  to be credited. The cost is that the last tagged link wins, so a funnel whose internal
  links carry tags overwrites the tags the visitor actually arrived with — which is
  precisely what `paramsToCopy` exists to control.
- **We chose to mirror every parameter into storage under its own name**, rather than only
  into the attribution record, because that is what lets a value survive a page that boots
  before the record is rehydrated. The cost is twenty-two extra storage keys, and a
  value that can come back from a copy you did not clear.
- **We chose to keep the funnel name in localStorage** rather than in the session alone,
  because a funnel spans visits and reporting is built on it being stable. The cost is
  cross-campaign leakage in one browser, which is why `clearPersistedFunnel()` exists.
- **We chose to collect once at boot rather than continuously** because attribution
  describes an arrival, and re-collecting on every interaction would let a later internal
  page overwrite the credited source. The cost is that the record does not notice a
  client-side route change (beyond refreshing the landing page on `popstate`).
- **We chose to rewrite links on click rather than at load** because a page that mutates
  every `href` up front breaks link previews, copy-link, and any of your own code that
  reads `href`. The cost is that the change is invisible until the click happens.

## Limitations

- **Does not offer a first-touch mode.** There is no configuration that makes the stored
  value beat the URL. If a campaign needs the arrival source preserved, keep internal links
  free of `utm_*` parameters — or capture the values yourself on the first page and re-apply
  them with `next.setAttribution()` from a `window.nextReady` callback.
- **Does not survive a new tab.** The attribution record is in sessionStorage, so a link
  opened in a new tab starts collection over from that tab's URL. Only the funnel name and
  `evclid` are held in localStorage.
- **Does not de-duplicate the two meta-tag spellings.** `os-tracking-tag` and
  `data-next-tracking-tag` are collected together, so the same `data-tag-name` under both
  names resolves to whichever the browser returns last. Use one spelling per field.
- **Does not validate anything it collects.** A misspelled `utm_sorce` is not a warning —
  it is simply not collected, and the order goes out with an empty `utm_source`.
- **Does not attribute a click it never saw.** A visitor who arrives with no parameters and
  no stored values is unattributed; there is no fingerprinting or probabilistic matching,
  and the `referrer` is the only signal left.
- **Does not send anything itself.** It fills a record; the checkout attaches it to the
  order and analytics reads it for its own events. If an order has no attribution, confirm
  the record was populated before looking at the checkout — and see
  [analytics](./analytics.md) for the separate question of what reporting received.
- **Does not transfer parameters across a form post or a JavaScript navigation.**
  `utm-transfer` only rewrites `<a href>` on click. A `window.location.assign()` in your own
  code, or a form submission, carries nothing.
