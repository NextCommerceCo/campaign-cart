---
title: "Core/Subsystems/Geo"
group: "Core"
category: "Core Subsystems"
---

# Country, state, and currency

> Category: `core`
> Last reviewed: 2026-07-31
> Owner: Campaign Cart SDK

Where the visitor is decides three separate things on a campaign page: the **currency**
every price is quoted in, the **countries** the checkout offers to ship to, and the
**state or province field** — its label, its option list, and the postcode rules beside
it. This part of the engine works all three out before any price is fetched, from the
visitor's IP by default or from an override you pass, so the campaign arrives already
priced in the currency they will be charged in. Getting it wrong is rarely visible as an
error: it shows up as dollar prices for a shopper who expected euros, or a state dropdown
that is empty on one country and full on the next.

## Concept

One HTTP call feeds two chains that then run independently — and are allowed to disagree.

The call goes to a countries service and comes back with everything needed at once: the
detected country code, that country's configuration (currency code and symbol, the state
label and whether a state is required, the postcode label, its regex, its length limits
and its display format), that country's states, and the full list of countries. The
response is cached for **1 hour in localStorage**, so it outlives the tab.

From that one response:

- **The currency chain** picks what prices are quoted in: an explicit `?currency=` wins,
  then a currency already locked in for this tab, then the detected country's currency,
  then USD. Whatever it resolves to is written to session storage and becomes the currency
  the campaign is fetched in.
- **The country chain** picks what the shipping dropdown offers: the campaign's own
  shipping countries win, then a custom list you configured, then the deprecated
  `showCountries` filter. If the detected country is not in the resulting list, the
  default falls back to US, then to the first country in the list, then to a
  `defaultCountry` you configured.

The two chains crossing is the mechanism to hold in your head: **when the country chain
replaces the detected country, the currency chain keeps the detected currency anyway.** A
Canadian visitor on a campaign that ships only to the US gets `US` pre-selected in the
shipping dropdown and CAD prices on the page. That is deliberate — the visitor is being
priced for where they are, and shipped from where the campaign can ship.

```
boot step 2   config read: currencyBehavior, addressConfig, ?country=, ?currency=
                    │
boot step 3   ┌─────────────────────────────────────────────────────┐
              │ CountryService.getLocationData()                    │
              │   GET cdn-countries…/location                       │
              │   cached 1 hour in localStorage (next_country_*)     │
              │   3-second budget → on timeout, US / USD hard-coded  │
              └─────────────────────────────────────────────────────┘
                    │                                   │
        currency chain                          country chain
        ?currency=                              campaign available_shipping_countries
          ↓ else                                  ↓ else
        next_selected_currency (this tab)        addressConfig.countries
          ↓ else                                  ↓ else
        detected country's currency              addressConfig.showCountries (deprecated)
          ↓ else                                  ↓ then, if detected not in the list:
        USD                                      US → first in list → defaultCountry
                    │                                   │
                    ▼                                   │
boot step 5   campaign fetched in that currency,         │
              cached as next-campaign-cache_{CURRENCY}   │
                                                         ▼
              checkout form: country dropdown, state list and label,
              postcode label, validation, and formatting
```

Currency resolution happening at **step 3** and the campaign loading at **step 5** is the
ordering that makes everything downstream work — and the reason a price problem is a
currency question first. The full step list is in the
[boot sequence](../reference/boot-sequence.md).

## Business logic

**What triggers it.** Boot step 3, once per page load, and only when `currencyBehavior` is
`auto` — which is the default. Set `window.nextConfig.currencyBehavior = 'manual'` and
detection is skipped entirely; a `?currency=` value or a currency already locked in for the
tab is still restored, so a manual page keeps its currency across the funnel without ever
calling the countries service.

**`?country=` takes a different path from detection.** It fetches that one country's
states directly rather than going through the location endpoint, so the response carries
no country list and the list is fetched separately afterwards. The value is written to
session storage, which means it keeps applying to later page loads without the parameter.
See [URL parameters](../reference/url-parameters.md) for both overrides.

**Detection has a 3-second budget.** Past that — or on any network error — the SDK
substitutes a hard-coded United States result: US, USD, `State`, and US ZIP rules. The step
does not retry and does not fail the boot — it logs and the sequence moves on, so a page
priced in USD for a European visitor is a timeout, not a configuration mistake.

**If the countries service is unreachable altogether**, the fallback country list has
exactly five entries: US, CA, GB, AU, DE. Symptom: a checkout offering five countries when
the campaign ships to thirty. Fix: this is the countries service, not your
`addressConfig` — check the console for `Failed to fetch location data`, and confirm the
campaign's own shipping countries loaded.

**The currency is locked into the tab on first resolution.** Once resolved it is written to
session storage and later page loads read it back rather than redetecting. That is what
stops an upsell from being priced in a different currency from the order the visitor
already paid for. Two consequences that catch people out: removing `?currency=` from the
URL does not undo the test, and `?reset=true` does not clear it either, because it only
sweeps keys spelled `next-…`. Fix: open a new tab, or delete the key by hand — see
[storage keys](../reference/storage-keys.md).

**A currency the campaign cannot price falls back rather than failing.** The countries
service will happily report a currency the campaign does not sell in. The campaign store
then accepts whatever the API answers with, corrects the stored currency, and announces
the substitution as a `currency:fallback` event. Symptom: the page shows a currency nobody
asked for. Fix: format money from the campaign's own `currency` field rather than the
configured one, and subscribe to `currency:fallback` if the page should say something —
see the [campaign store reference](../../../state/campaign/guide/reference/state-reference.md)
and [the event bus](./event-bus.md).

**The shipping-country list has a fixed priority, and the campaign always wins.** The
campaign's `available_shipping_countries` is applied over anything the page configured,
so the dropdown cannot offer a country the campaign will not ship to. `addressConfig.countries`
is the supported way to control the list yourself; `addressConfig.showCountries` still
works but is deprecated and logs a warning.

**Fifteen US territories are always removed from the state list** — `AS`, `GU`, `MP`,
`PR`, `VI` and the `UM-…` codes — before any configuration is consulted, and
`addressConfig.dontShowStates` removes more on top. There is no option that puts one back.
Symptom: a Puerto Rico order that cannot be entered through the form. Fix: none within
this subsystem; the list is hard-coded in `core/country-service.ts`.

**A country with no states and no state requirement hides the field.** When the service
reports `stateRequired: false` and returns an empty state list, the checkout form removes
the field rather than showing an empty dropdown. When a state *is* required, the field is
marked required and its label becomes the country's own word for it — `State`, `Province`,
`County`. The same response supplies the postcode label, so a UK visitor sees "Postcode"
and a US visitor sees "ZIP Code".

**Postcode validation is permissive by design.** A value must fall inside the country's
length limits and match its regex if one is supplied; a regex that fails to compile is
treated as a pass rather than a rejection, so a bad pattern in the service data lets
everything through instead of blocking every order. Formatting rewrites the value against
the country's format pattern (`N`, `X`, `#`, `9`, `A` are character slots, anything else is
a literal), and with no pattern an alphanumeric code is uppercased.

**Country reference data is cached for an hour in localStorage, which outlives your test.**
Symptom: you switch VPN region, reload, and the page still detects the old country. Fix:
run `CountryService.getInstance().clearCache()` from the console, or clear the
`next_country_*` keys — reloading alone will not do it for up to an hour. The debug
overlay's country selector is the intended way to test a country without touching storage;
see [logging and the debug overlay](./logging-and-debug.md).

## Decisions

- **We chose to resolve the currency before loading the campaign** rather than loading in a
  default currency and re-pricing afterwards, because every price on the page comes out of
  the campaign payload — re-pricing would mean a second fetch and a visible flash of the
  wrong amounts.
- **We chose to keep the detected currency when the shipping country is replaced**, rather
  than switching the currency to the fallback country's, because a visitor should be quoted
  in their own money even when the campaign cannot ship to them. The cost is a combination
  that looks like a bug in a screenshot: `US` shipping with CAD prices.
- **We chose the campaign's `available_shipping_countries` over the page's own list**
  because the campaign is the thing that can actually ship, and a page-level list drifts
  the moment shipping configuration changes. `showCountries` survives only as a
  deprecated fallback for pages written before the campaign carried the data.
- **We chose localStorage and a one-hour window for country reference data** over a
  per-session cache, because a country list and its address rules change on the order of
  years and every session would otherwise pay for the same fetch. The cost is the hour a
  geo test takes to expire.
- **We chose a 3-second detection budget with a US/USD fallback** over waiting for the
  service, because the campaign fetch sits behind this step: a slow geo lookup would hold
  every price on the page hostage, and a wrong default that renders is better than a
  correct one that never arrives.

## Limitations

- **Does not translate anything.** Country and state names, and the `State`/`Province`/
  `Postcode` labels, come back from the service in English. There is no locale mapping in
  this subsystem — number and currency *formatting* is a separate concern, driven by the
  stored locale.
- **Does not change the currency when the visitor changes the shipping country at
  checkout.** Editing the country dropdown reloads the states and relabels the state and
  postcode fields; prices stay in the currency resolved at boot. Only the debug overlay's
  country selector re-prices, and it does so by reloading the campaign. Despite its name,
  `currencyBehavior: 'auto'` governs *detection at boot*, nothing later.
- **Does not re-detect during the visit.** One lookup per page load, at step 3. A
  parameter added to the address bar afterwards, or a VPN switched mid-session, has no
  effect until the next page load.
- **Does not validate that a detected currency is one the campaign sells in.** That
  mismatch is resolved later, by the campaign store, as a `currency:fallback`.
- **Does not offer a public API.** There is no `next.getCountry()` or `next.setCurrency()`.
  The resolved values are readable on the [config store](../../../state/config/guide/reference/state-reference.md)
  (`selectedCurrency`, `detectedCountry`, `detectedCurrency`, `locationData`), and
  changeable only through `?country=` / `?currency=` or the debug overlay's selectors.
- **Does not own the address form.** Everything visible — the dropdowns, the labels, the
  validation messages — is rendered by the checkout feature from the data this subsystem
  supplies. For field names and attributes, read the
  [checkout form guide](../../../features/checkout/checkout-form/guide/overview.md).
- **Does not work offline or without the countries service.** There is no bundled country
  database; the five-country fallback is a stopgap that keeps the form usable, not a
  substitute.
