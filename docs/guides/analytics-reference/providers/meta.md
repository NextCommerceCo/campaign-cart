---
title: 'Meta pixel'
group: 'Analytics Reference/Providers'
order: 0.23
---

# Meta pixel

Not built in: a listener maps the tracking events to Meta standard events and sends them to `fbq`.
The pixel's base code sends `PageView` itself.

<!-- meta-events -->

`eventID` is the tracking event's `event_id`, so a server-side Conversions API event with the same
id is counted once. The lines come from `data`: the CartItem itself, the Cart's `lines`, or the
Checkout's `cart.lines`:

<!-- meta-recipe -->

`product_added_to_cart` has `first_in_session: true` on the first add in the browser, for a pixel
that should count one AddToCart per shopper:
`if (event_type === 'product_added_to_cart' && !data.first_in_session) return;`.
