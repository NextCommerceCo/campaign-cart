---
title: 'Meta pixel'
group: 'Analytics Reference/Providers'
order: 0.23
---

# Meta pixel

Not built in: a listener maps the standard events to Meta standard events and sends them to `fbq`.
The pixel's base code sends `PageView` itself.

<!-- meta-events -->

`eventID` is the standard event's `id`, so a server-side Conversions API event with the same id is
counted once:

<!-- meta-recipe -->

`add_to_cart` has `first_in_session: true` on the first add in the browser, for a pixel that should
count one AddToCart per shopper: `if (name === 'add_to_cart' && !params.first_in_session) return;`.
