---
title: 'GA4'
group: 'Analytics Reference/Providers'
order: 0.22
---

# GA4

Not built in: a listener remaps the tracking events to GA4 ecommerce events and sends them to
`gtag`. Each tracking event has a GA4 name; the listener builds GA4's `items` from the SDK's lines
and its `value`, `currency` and `transaction_id` from the Cart or the Order.

<!-- ga4-events -->

`gtag('config', …)` already sends GA4's own `page_view`, so the listener leaves `page_viewed` out.
GA4 records the events that are not its own as custom events; leave out the ones a property does
not want.

```js
const GA4 = {
  product_viewed: 'view_item',
  product_list_viewed: 'view_item_list',
  product_added_to_cart: 'add_to_cart',
  product_removed_from_cart: 'remove_from_cart',
  cart_updated: 'update_cart',
  checkout_started: 'begin_checkout',
  checkout_contact_info_submitted: 'generate_lead',
  checkout_shipping_address_submitted: 'add_shipping_info',
  checkout_shipping_method_submitted: 'add_shipping_info',
  checkout_payment_info_submitted: 'add_payment_info',
  checkout_completed: 'purchase',
  upsell_completed: 'upsell_purchase',
  upsell_viewed: 'view_upsell',
  upsell_skipped: 'skip_upsell',
  promotion_viewed: 'view_promotion',
  promotion_selected: 'select_promotion',
};

const item = (line) => ({
  item_id: line.sku ?? String(line.package_id),
  item_name: line.product_title,
  item_variant: line.variant_title,
  price: line.price,
  quantity: line.quantity,
});

next.analytics.on('*', ({ event_type, event_id, data }) => {
  const name = GA4[event_type];
  if (!name) return;
  const cart = data.cart ?? data; // a Checkout carries its cart; a Cart or an Order is one
  const lines = Array.isArray(data) ? data : (cart.lines ?? [data]);
  const params = {
    currency: cart.currency,
    value: cart.total ?? data.price,
    coupon: cart.coupons?.[0],
    items: lines.map(item),
  };
  if (event_type === 'checkout_completed') {
    params.transaction_id = data.number ?? data.ref_id;
    params.shipping = data.shipping_method?.price;
    params.tax = data.tax;
  }
  if (event_type === 'upsell_completed') {
    params.transaction_id = event_id;
    params.items = [item(data.upsell.line)];
    params.value = data.upsell.line.total;
  }
  gtag('event', name, params);
});
```

`checkout_completed` and `upsell_completed` carry a `transaction_id`, so GA4 counts each order
and each upsell once. An `upsell_viewed`, `upsell_skipped` or `promotion_*` event carries no
lines; its `items` is empty.

Through GTM instead, the container gets the [GTM](gtm.md) pushes.
