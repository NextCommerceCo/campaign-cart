---
title: 'Start Here/Quickstart'
group: 'Start Here'
category: 'Start Here'
order: 0
---

# Quickstart

A whole landing page: the shopper picks one or two pairs, can add a protection plan, sees the
total, and goes on to checkout. Copy it, put your campaign key and package ids in, and it works.

```html
<!doctype html>
<html>
  <head>
    <script type="module" src=".../loader.js" data-campaign="pk_…"></script>
    <style>
      html:not([data-next-ready]) .price {
        visibility: hidden;
      }
      [data-next-option][data-next-selected] {
        outline: 2px solid currentColor;
      }
    </style>
  </head>
  <body>
    <div data-next-selector="main">
      <button data-next-option="one" data-next-items="1">
        1 pair <span class="price" data-next-query="total"></span>
      </button>
      <button data-next-option="two" data-next-items="1x2" data-next-selected>
        2 pairs <span class="price" data-next-query="price"></span> each
        <s data-next-show="total_discount > 0" data-next-query="original_price"></s>
      </button>
    </div>

    <button data-next-option="protect" data-next-items="9">
      Add a protection plan for <span class="price" data-next-query="total"></span>
    </button>

    <p>Total <span class="price" data-next-query="cart.total" data-next-empty="…"></span></p>
    <a href="checkout.html">Continue to checkout</a>
  </body>
</html>
```

| Line                                   | What it does                                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `<script … data-campaign>`             | Loads the SDK for this campaign. Every page of the campaign shares one cart                       |
| `data-next-selector="main"`            | A group of options, one picked. The picked one is the cart: no add-to-cart button needed          |
| `data-next-option` + `data-next-items` | One option and its packages: `"1x2"` is package 1 twice, so `price` is the price of one           |
| `data-next-selected`                   | Picked first. The SDK moves it as the shopper clicks                                              |
| `data-next-query="price"`              | Inside an option, a short path reads that option. Prices come from the server, with its discounts |
| `data-next-show="total_discount > 0"`  | Shown only while the condition holds                                                              |
| an option on its own                   | An order bump: a click adds it, the next click takes it out                                       |
| `cart.total`, `data-next-empty`        | Anywhere on the page a path starts with its object. `…` shows until the price arrives             |
| `html[data-next-ready]`                | Set once the page is bound and priced: hide prices until then, so placeholders never flash        |
| a plain link                           | The cart is already saved; links keep the visit's URL parameters                                  |

## Next

- [Recipes](recipes/bundle-tiers.md): one common task per page, ready to copy.
- [Building Pages](building-pages/landing-and-presell.md): the landing, checkout, upsell and receipt pages of a funnel.
- [Attributes](attributes.md): every attribute and every field it can read.
- Something blank? Open the page with `?debug=1`: the Elements tab shows what each `data-next-*` reads.
