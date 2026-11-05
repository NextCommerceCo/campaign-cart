---
title: 'data-next-address'
group: 'Attribute Reference/Checkout'
order: 503
---

# data-next-address

Draws an address for the selected country: its fields, in its order, with its labels. The fields
come from the address service (i18n-rules) and are drawn again when the country changes. Address
fields the page writes itself follow the same rules.

```html
<form data-next-checkout>
  <input data-next-checkout-field="email" type="email" />
  <div data-next-address="shipping"></div>
</form>
```

## Attributes

| Attribute                                           | Means                                                                        |
| --------------------------------------------------- | ---------------------------------------------------------------------------- |
| `data-next-address="shipping"` / `"billing"`        | Draw the shipping or billing address here                                    |
| `data-next-component="location"`                    | City, state and postcode on the page: hidden until a street address is typed |
| `data-next-component="billing-location"`            | The same for the billing address                                             |
| `nextConfig.addressConfig.enableAutocomplete: true` | Address suggestions under the street field                                   |

A drawn address leaves out every field the form already has elsewhere, such as a
`data-next-checkout-field="first_name"` above it. Until the country's rules load it shows nothing;
if they cannot load it draws a built-in layout (country, name, address, city, state, postcode,
phone).

## Fields the page writes

Once the country's rules load, the page's own `city`, `state` and `postcode`:

- take their label and placeholder text from the rules, keeping the page's trailing `*` where the
  field is required;
- are hidden where the country has no such field;
- get `maxlength`, `autocapitalize` and `inputmode` from the rules (`inputmode="numeric"` is kept
  only for an all-digit postcode);
- the state `<select>` becomes a text input where the country asks for a typed region, and lists
  the country's states otherwise (US territories are never listed);
- the postcode is written in the country's format as it is typed.

The country `<select>` lists the campaign's shipping countries. `?country=<code>` in the URL picks
one when the shopper has not.

## Set by the SDK

| On                                 | Set                                                                                                                                                                  |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[data-next-address]`              | `data-next-address-state="loading"`, then `"ready"` once drawn                                                                                                       |
| Each row                           | `div.next-address-row[data-next-address-row]`; the row of city, state and postcode after the street gets `data-next-component="location"`                            |
| Each field                         | `div.form-group.next-address-field[data-next-address-field="<name>"]` with the control (`.next-address-control`) and `label.next-address-label`                      |
| `[data-next-component="location"]` | `display: none` and `next-location-hidden` until a street address is typed, then `display: flex`                                                                     |
| Suggestions                        | `div.pac-container-nextcommerce.pac-logo` with `.pac-item-nextcommerce` items (`--active` on the highlighted one), `.pac-item-query` and a `button.pac-close-button` |

Drawn fields keep the 0.4.x names (`address1`, `postal`, …) in `data-next-checkout-field` and
`data-next-address-field`, which page CSS selects. An optional field's label ends in
`(optional)`.

Suggestions appear once the street field has two words. Picking one fills the street, city,
postcode, country and state.

## 0.4.x

| 0.4.x                                                                       | Now                                                                    |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `data-next-address-lang`, `data-next-address-api`                           | Not read                                                               |
| `data-next-component-location="location"`, `os-checkout-element="location"` | `data-next-component="location"`                                       |
| `nextConfig.addressConfig.countries`                                        | Still read: only those of the campaign's shipping countries are listed |
| `nextConfig.addressConfig.dontShowStates`                                   | Still read: those US states are not listed                             |
| `nextConfig.googleMaps`                                                     | Removed                                                                |

## Events

[address.entered](/event-reference/checkout/address.entered),
[address.updated](/event-reference/checkout/address.updated); `sdk.error` with
`address.load_rules` when the rules cannot load.
