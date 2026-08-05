---
title: "State/Order/Events"
group: "State"
category: "Order Store"
---

# Events

The order store emits one platform event through `EventBus`, from `loadOrder`.

## `order:loaded`

**When:** An order was fetched from the API and put in the store — which happens
on any page opened with `?ref_id=` (success, receipt, upsell). Emitted after the
store is updated, so a listener reading `useOrderStore.getState().order` sees the
same order.

Fires on a fresh fetch only. Reloading the page inside the store's 15-minute
window is served from its cache and emits nothing — see
[state-reference.md](./state-reference.md) for that window.

**Payload:** the full {@link index.Order} as the API returned it — `number`, `ref_id`,
`lines`, totals, addresses, `order_status_url`.

**Example:**
```ts
window.next.on('order:loaded', order => {
  console.log('Thank you for order', order.number);
});
```

### This is the event to hang conversion tracking on

An order is *created* on the checkout page but is not necessarily *paid* there.
Express checkout (PayPal, Apple Pay, Google Pay) and a card payment that needs
3-D Secure all produce an order carrying a `payment_complete_url`, which the SDK
redirects to so the shopper can finish paying — and they can still cancel, or
press back. `order:loaded` fires on the page the gateway returns them to, for an
order fetched back from the API, so it is the first point at which the money is
known to have moved.

**It fires on both return legs, so check which one you are on.** A redirect
payment comes back to either `success_url` or `payment_failed_url`, and the
platform puts `?ref_id=` on both — so a declined payment also loads its order and
also emits this event. The SDK's own `dl_purchase` recognises the failure page two
ways (the `?payment_failed=true` its default failure URL carries, and the
`payment_failed_url` path the checkout page recorded), but a listener of your own
sees every `order:loaded`. If what you do in it counts as a conversion, read the
order's own payment state — a `payment_complete_url` still on it means the money
never moved — or check the URL.

The SDK's own `dl_purchase` is emitted from here, once per order — see the
[analytics events reference](../../../../core/guide/reference/analytics-events.md)
and [issue #71](https://github.com/NextCommerceCo/campaign-cart/issues/71), the
over-counted conversions that came from tracking the creation instead.
