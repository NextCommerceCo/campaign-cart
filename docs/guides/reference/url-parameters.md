---
title: "Reference/URL Parameters"
group: "Reference"
category: "Reference"
---

# URL parameters

Use this page to build a link that changes how the next page behaves: which currency it prices in, which packages land in the cart, which affiliate gets credited, whether the visit is tracked at all.

The SDK reads these off the query string when the page boots. Nothing about them appears in your markup, so they are easy to miss and easy to leave on a link by accident. Each entry says whether it is safe to publish, whether removing it undoes it, and who writes it.

## Development only

These change what a real visitor experiences or what reaches a real API. Use them locally, and never leave one on a link that ships.


| Parameter | Description |
|---|---|
| [`debugger`](#debugger) | Opens the on-page debug overlay — cart, campaign, order, checkout, and analytics panels, plus the currency, country, and upsell pickers — and turns logging all the way up. |
| [`test`](#test) | Marks the page as being in test mode, which lets the test-card helpers fill the checkout form with a known card number. |
| [`reset`](#reset) | Clears the SDK's stored state before anything else loads, then removes itself from the URL so a refresh does not clear the page again. |
| [`forcePackageId`](#forcepackageid) | Empties the cart and puts the listed packages in it, with an optional quantity after a colon (default 1). |


## Sticky parameters

These copy their value into storage the first time they are seen, so they keep applying on later pages in the tab **without** the parameter. Removing it from the URL does not undo it. Open a new tab instead.


| Parameter | Description |
|---|---|
| [`currency`](#currency) | Loads the campaign priced in this currency and shows every price in it. |
| [`country`](#country) | Overrides the detected country: it loads that country's address rules — state list, the label and format of the postcode field — and pre-selects it as the shipping destination. |
| [`ignore`](#ignore) | Stops analytics entirely for this visitor: no provider is initialised and no event is sent. |
| [`funnel`](#funnel) | Names the funnel this visit belongs to, and is the highest-priority source: it overrides both a funnel already remembered for this visitor and the page's `next-funnel` meta tag. |



## Debugging


| Parameter | Description |
|---|---|
| [`debug`](#debug) | Un-suppresses logging. |



## Forcing a page into a state


| Parameter | Description |
|---|---|
| [`forceShippingId`](#forceshippingid) | Selects a shipping method by its campaign id, so you can test a specific rate — free shipping, expedited — without going through the picker. |
| [`forceBundleId`](#forcebundleid) | Pre-selects a bundle card, overriding the card marked `data-next-selected`. |



## Loading an order


| Parameter | Description |
|---|---|
| [`ref_id`](#ref_id) | Loads that order when the page opens, which is what makes a receipt page show its totals and an upsell page know what was bought. |
| [`order_ref_id`](#order_ref_id) | An alternative spelling of `ref_id`, read only when `ref_id` is absent. |



## Analytics

These name the list a product view or click came from, so a report can tell a search result from a category browse. `ignore` is the exception: it switches reporting off entirely.

The SDK does not search or filter anything. These describe a page your site already renders: on your search page, `?q=blue+widget` makes the SDK report clicks there as `Search Results: blue widget`.

For the list-attribution parameters, the URL path wins. A path containing `/search`, `/collections/`, `/category/`, `/tag/` or `/brand/` is used instead and the parameter is never read. `ignore` is unaffected: it is read straight off the URL.

| Parameter | Description |
|---|---|
| [`category`](#category) | Names the list a product view or click should be attributed to, when the page is a category listing whose URL path does not already say so. |
| [`collection`](#collection) | The same list attribution as `category`, for pages that call the grouping a collection. |
| [`q`](#q) | Marks the page as search results and puts the search text in the reported list name. |
| [`query`](#query) | A second accepted spelling of the search term, read after `q`. |
| [`search`](#search) | A third accepted spelling of the search term, read after `query`. |



## Attribution


| Parameter | Description |
|---|---|
| [`affid`](#affid) | The affiliate credited with the order. |
| [`aff`](#aff) | Short alias for `affid`, read only when `affid` is absent. |
| [`gclid`](#gclid) | The Google Ads click id, added automatically by Google when auto-tagging is on. |
| [`fbclid`](#fbclid) | The Facebook click id, added by Facebook on outbound clicks. |
| [`clickid`](#clickid) | A generic click id for tracking platforms that do not use one of the named parameters. |
| [`evclid`](#evclid) | The Everflow click id, sent with the order as its Everflow transaction id so the network can attribute the conversion. |
| [`utm_source`](#utm_source) | Which site or platform the visit came from. |
| [`utm_medium`](#utm_medium) | What kind of link it was — cpc, email, social. |
| [`utm_campaign`](#utm_campaign) | Which marketing campaign the link belongs to. |
| [`utm_content`](#utm_content) | Which specific creative or link variant was clicked. |
| [`utm_term`](#utm_term) | The paid keyword the visit was bought against. |
| [`subaffiliate1`](#subaffiliate1) | Sub-affiliate tracking slot 1 of 5, for an affiliate network that passes its own placement or creative ids through. |
| [`sub1`](#sub1) | Short alias for `subaffiliate1`, read only when the long form is absent. |
| [`subaffiliate2`](#subaffiliate2) | Sub-affiliate tracking slot 2 of 5, for an affiliate network that passes its own placement or creative ids through. |
| [`sub2`](#sub2) | Short alias for `subaffiliate2`, read only when the long form is absent. |
| [`subaffiliate3`](#subaffiliate3) | Sub-affiliate tracking slot 3 of 5, for an affiliate network that passes its own placement or creative ids through. |
| [`sub3`](#sub3) | Short alias for `subaffiliate3`, read only when the long form is absent. |
| [`subaffiliate4`](#subaffiliate4) | Sub-affiliate tracking slot 4 of 5, for an affiliate network that passes its own placement or creative ids through. |
| [`sub4`](#sub4) | Short alias for `subaffiliate4`, read only when the long form is absent. |
| [`subaffiliate5`](#subaffiliate5) | Sub-affiliate tracking slot 5 of 5, for an affiliate network that passes its own placement or creative ids through. |
| [`sub5`](#sub5) | Short alias for `subaffiliate5`, read only when the long form is absent. |



## Written by the SDK


| Parameter | Description |
|---|---|
| [`payment_failed`](#payment_failed) | Added by the SDK to the fallback failure URL — the current page — when no `next-failure-url` meta tag is set. |



## Parameter reference

One section per parameter, with a copy-paste example. Names are checked against the source in both directions by `src/tests/docs/coreContracts.test.ts`.


### currency

Loads the campaign priced in this currency and shows every price in it. Highest priority of all the currency sources — it beats a currency the visitor picked earlier and the one detected from their location.

```
?currency=EUR
```

**Value:** string (3-letter currency code)
**Default:** the currency detected from the visitor's location
**Read by:** SDK boot / campaign load

> **Sticky.** The value is stored on first sight and keeps applying without the parameter.


### country

Overrides the detected country: it loads that country's address rules — state list, the label and format of the postcode field — and pre-selects it as the shipping destination.

```
?country=CA
```

**Value:** string (2-letter country code)
**Default:** the country detected from the visitor's location
**Read by:** SDK boot / checkout address form

> **Sticky.** The value is stored on first sight and keeps applying without the parameter. It does not change the currency. Set `?currency=` too, or you get one country’s address fields beside another’s prices.


### debug

Un-suppresses logging. The production bundle drops every `debug`, `info`, and `warn` line unless this is set; with it, the SDK narrates what it is doing in the console. That is all it does.

```
?debug=true
```

**Value:** 'true'
**Default:** off
**Read by:** Logger / attribute scanner

> **Watch out:** It does not open the debug overlay. That is `?debugger=true`, one letter apart.


### debugger

Opens the on-page debug overlay — cart, campaign, order, checkout, and analytics panels, plus the currency, country, and upsell pickers — and turns logging all the way up. This is the parameter you want when you mean "show me the debug panel".

```
?debugger=true
```

**Value:** 'true'
**Default:** off
**Read by:** Debug overlay / test mode

> **Never leave this on a link that ships.** It also silently puts the page into test mode, so a debugging session on a live page can post a test order.


### test

Marks the page as being in test mode, which lets the test-card helpers fill the checkout form with a known card number. `?debugger=true` turns it on too, and the Konami code (↑↑↓↓←→←→BA) both turns it on and writes this parameter into the address bar.

```
?test=true
```

**Value:** 'true'
**Default:** off
**Read by:** Test mode manager

> **Never leave this on a link that ships.** The Konami code (↑↑↓↓←→←→BA) turns test mode on from any page, including production, and fills the checkout with a hard-coded address and `card_token: "test_card"`. That is a real API call creating a real record.


### reset

Clears the SDK's stored state before anything else loads, then removes itself from the URL so a refresh does not clear the page again. The way out of a session wedged by an earlier test.

```
?reset=true
```

**Value:** 'true'
**Default:** off
**Read by:** SDK boot

> **Never leave this on a link that ships.** It clears less than the name suggests: only keys beginning `next-` or `_next`. The remembered currency, country, funnel and analytics-ignore flag all survive. Open a new tab instead.


### forcePackageId

Empties the cart and puts the listed packages in it, with an optional quantity after a colon (default 1). Made for jumping straight to a checkout or upsell page with a known cart instead of clicking through the funnel.

```
?forcePackageId=123:2,124
```

**Value:** string — `{ID}` or `{ID}:{QTY}`, comma-separated
**Read by:** SDK boot → cart

> **Never leave this on a link that ships.** The cart is emptied first, unconditionally, so a real visitor who follows the link loses what they had.


### forceShippingId

Selects a shipping method by its campaign id, so you can test a specific rate — free shipping, expedited — without going through the picker.

```
?forceShippingId=3
```

**Value:** number (a shipping method `ref_id`)
**Read by:** SDK boot → cart


### forceBundleId

Pre-selects a bundle card, overriding the card marked `data-next-selected`. Scope it to one selector with `{SELECTOR_ID}:{BUNDLE_ID}` when the page has several; an unscoped value applies to the first selector that has a card with that id.

```
?forceBundleId=tier-selector:premium
```

**Value:** string — `{BUNDLE}` or `{SELECTOR}:{BUNDLE}`, comma-separated
**Read by:** Bundle selector


### ref_id

Loads that order when the page opens, which is what makes a receipt page show its totals and an upsell page know what was bought. The SDK appends it for you to the success, upsell, and decline URLs it redirects to, so a well-configured funnel never needs it written by hand.

```
?ref_id={ORDER_REF}
```

**Value:** string (order reference)
**Read by:** SDK boot → order store; checkout and upsell redirects

> **Watch out:** It is an order reference in a URL the visitor can edit, so treat anything it renders as public.


### order_ref_id

An alternative spelling of `ref_id`, read only when `ref_id` is absent. Present for links built by older tooling.

```
?order_ref_id={ORDER_REF}
```

**Value:** string (order reference)
**Read by:** SDK boot → order store


### ignore

Stops analytics entirely for this visitor: no provider is initialised and no event is sent. Use it so your own testing, QA, and demo traffic does not land in the reports.

```
?ignore=true
```

**Value:** 'true'
**Default:** off
**Read by:** Analytics

> **Sticky.** The value is stored on first sight and keeps applying without the parameter. There is no on-page sign that tracking is off, and it lasts the whole tab.


### category

Names the list a product view or click should be attributed to, when the page is a category listing whose URL path does not already say so.

```
?category=summer-sale
```

**Value:** string
**Read by:** Analytics list attribution


### collection

The same list attribution as `category`, for pages that call the grouping a collection. Read after `category`.

```
?collection=bestsellers
```

**Value:** string
**Read by:** Analytics list attribution


### q

Names the search term this page is showing results for, so product clicks report as `Search Results: {term}`. It does not run a search.

```
?q=protein+powder
```

**Value:** string
**Read by:** Analytics list attribution


### query

A second accepted spelling of `q`, read when `q` is absent.

```
?query=protein+powder
```

**Value:** string
**Read by:** Analytics list attribution


### search

A third accepted spelling, read when `query` is absent. All three produce the same list id, `search_results`.

```
?search=protein+powder
```

**Value:** string
**Read by:** Analytics list attribution


### funnel

Names the funnel this visit belongs to, and is the highest-priority source: it overrides both a funnel already remembered for this visitor and the page's `next-funnel` meta tag.

```
?funnel=summer-bundle-2026
```

**Value:** string
**Default:** a remembered funnel, then the `next-funnel` meta tag
**Read by:** Attribution collector

> **Sticky.** The value is stored on first sight and keeps applying without the parameter.


### affid

The affiliate credited with the order. Remembered for the rest of the browser tab and sent with every order placed in it.

```
?affid={AFFILIATE_ID}
```

**Value:** string
**Read by:** Attribution collector


### aff

Short alias for `affid`, read only when `affid` is absent.

```
?aff={AFFILIATE_ID}
```

**Value:** string
**Read by:** Attribution collector


### gclid

The Google Ads click id, added automatically by Google when auto-tagging is on. Stored and sent with the order so a conversion can be matched back to the click.

```
?gclid={GOOGLE_CLICK_ID}
```

**Value:** string
**Read by:** Attribution collector


### fbclid

The Facebook click id, added by Facebook on outbound clicks. Recorded in the order's attribution metadata when present.

```
?fbclid={FACEBOOK_CLICK_ID}
```

**Value:** string
**Read by:** Attribution collector


### clickid

A generic click id for tracking platforms that do not use one of the named parameters. Passed through to the order's attribution metadata unchanged.

```
?clickid={CLICK_ID}
```

**Value:** string
**Read by:** Attribution collector


### evclid

The Everflow click id, sent with the order as its Everflow transaction id so the network can attribute the conversion.

```
?evclid={EVERFLOW_CLICK_ID}
```

**Value:** string
**Read by:** Attribution collector (Everflow)


### utm_source

Which site or platform the visit came from. Stored on the attribution record and sent with the order.

```
?utm_source={VALUE}
```

**Value:** string
**Read by:** Attribution collector


### utm_medium

What kind of link it was — cpc, email, social. Stored on the attribution record and sent with the order.

```
?utm_medium={VALUE}
```

**Value:** string
**Read by:** Attribution collector


### utm_campaign

Which marketing campaign the link belongs to. Stored on the attribution record and sent with the order.

```
?utm_campaign={VALUE}
```

**Value:** string
**Read by:** Attribution collector


### utm_content

Which specific creative or link variant was clicked. Stored on the attribution record and sent with the order.

```
?utm_content={VALUE}
```

**Value:** string
**Read by:** Attribution collector


### utm_term

The paid keyword the visit was bought against. Stored on the attribution record and sent with the order.

```
?utm_term={VALUE}
```

**Value:** string
**Read by:** Attribution collector


### subaffiliate1

Sub-affiliate tracking slot 1 of 5, for an affiliate network that passes its own placement or creative ids through. Sent with the order.

```
?subaffiliate1={VALUE}
```

**Value:** string (max 225 characters)
**Read by:** Attribution collector


### sub1

Short alias for `subaffiliate1`, read only when the long form is absent.

```
?sub1={VALUE}
```

**Value:** string (max 225 characters)
**Read by:** Attribution collector


### subaffiliate2

Sub-affiliate tracking slot 2 of 5, for an affiliate network that passes its own placement or creative ids through. Sent with the order.

```
?subaffiliate2={VALUE}
```

**Value:** string (max 225 characters)
**Read by:** Attribution collector


### sub2

Short alias for `subaffiliate2`, read only when the long form is absent.

```
?sub2={VALUE}
```

**Value:** string (max 225 characters)
**Read by:** Attribution collector


### subaffiliate3

Sub-affiliate tracking slot 3 of 5, for an affiliate network that passes its own placement or creative ids through. Sent with the order.

```
?subaffiliate3={VALUE}
```

**Value:** string (max 225 characters)
**Read by:** Attribution collector


### sub3

Short alias for `subaffiliate3`, read only when the long form is absent.

```
?sub3={VALUE}
```

**Value:** string (max 225 characters)
**Read by:** Attribution collector


### subaffiliate4

Sub-affiliate tracking slot 4 of 5, for an affiliate network that passes its own placement or creative ids through. Sent with the order.

```
?subaffiliate4={VALUE}
```

**Value:** string (max 225 characters)
**Read by:** Attribution collector


### sub4

Short alias for `subaffiliate4`, read only when the long form is absent.

```
?sub4={VALUE}
```

**Value:** string (max 225 characters)
**Read by:** Attribution collector


### subaffiliate5

Sub-affiliate tracking slot 5 of 5, for an affiliate network that passes its own placement or creative ids through. Sent with the order.

```
?subaffiliate5={VALUE}
```

**Value:** string (max 225 characters)
**Read by:** Attribution collector


### sub5

Short alias for `subaffiliate5`, read only when the long form is absent.

```
?sub5={VALUE}
```

**Value:** string (max 225 characters)
**Read by:** Attribution collector


### payment_failed

Added by the SDK to the fallback failure URL — the current page — when no `next-failure-url` meta tag is set. It is a signal for your page to explain that payment did not go through.

```
?payment_failed=true
```

**Value:** 'true'
**Read by:** Checkout
