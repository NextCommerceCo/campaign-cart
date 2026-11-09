import type { Engine } from '../../engine/engine';
import type { TrackingEvent } from '../../engine/events/analytics';
import { paymentType } from '../../engine/payment';
import { apiOrder, PRODUCT_LIST, promotionFields, shippingTier, upsellPackage } from '../../engine/tracking';
import type { LineEvent } from './burst';
import { cartEcommerce, currency, ecommerce, purchase, upsellPurchase, valueOf } from './ga4';

const cartTotal = (engine: Engine) => engine.getState().cart.summary?.total ?? '0';

const dataLayerCart = (engine: Engine) => {
  const summary = engine.getState().cart.summary;
  const items = engine.cart.lines().map((l) => {
    const line = summary?.lines.find((s) => s.package_id === l.package_id);
    const price = Number(line?.package_price ?? engine.getPackage(l.package_id)?.price_total ?? 0);
    return { package_id: l.package_id, quantity: l.quantity, price };
  });
  return {
    currency: currency(engine),
    items,
    total_items: items.reduce((n, i) => n + i.quantity, 0),
    total_value: valueOf(items),
  };
};

const checkoutStep = (engine: Engine, ecommerce: object, fields: object) => ({
  ecommerce,
  event_category: 'ecommerce',
  event_value: Number(cartTotal(engine)),
  ...fields,
});

const purchasePush = (engine: Engine, e: TrackingEvent<'checkout_completed'>) => {
  const order = apiOrder(engine, e.data.ref_id);
  if (!order) return undefined;
  const coupon = engine.getState().order?.coupon;
  const code = coupon?.refId === order.ref_id ? coupon.code : undefined;
  return { pageType: 'purchase', ecommerce: purchase(engine, order, e.event_id, code) };
};

const upsellPurchasePush = (engine: Engine, e: TrackingEvent<'upsell_completed'>) => {
  const order = apiOrder(engine, e.data.ref_id);
  const line = order?.lines?.find((l) => String(l.id) === e.data.upsell.line.id);
  if (!order || !line) return undefined;
  return {
    pageType: 'upsell',
    ecommerce: upsellPurchase(engine, order, line, e.event_id),
    upsell_metadata: {
      original_order_id: order.ref_id,
      upsell_number: e.data.upsell.number,
      package_id: String(line.package ?? line.product_id ?? line.id),
      package_name: line.product_title,
    },
  };
};

/** The fields of the `dl_*` push a tracking event becomes, after the ones every push carries; none skips it. */
export function dataLayerFields(engine: Engine, e: Exclude<TrackingEvent, LineEvent>): object | undefined {
  switch (e.event_type) {
    case 'page_viewed':
      return { cart_total: cartTotal(engine), ecommerce: ecommerce(engine, engine.cart.current().lines) };
    case 'product_viewed':
      return { ecommerce: ecommerce(engine, [e.data]) };
    case 'product_list_viewed': {
      const { value: _, ...list } = ecommerce(engine, e.data);
      return { ecommerce: { ...list, item_list_id: PRODUCT_LIST.id, item_list_name: PRODUCT_LIST.name } };
    }
    case 'cart_updated':
      return { cart_total: cartTotal(engine), ecommerce: cartEcommerce(engine, e.data), cart: dataLayerCart(engine) };
    case 'checkout_started':
      return { cart_total: cartTotal(engine), ecommerce: cartEcommerce(engine, e.data.cart) };
    case 'checkout_contact_info_submitted': {
      const { currency, value } = cartEcommerce(engine, e.data.cart);
      return { currency, value, lead_source: 'checkout' };
    }
    case 'checkout_shipping_address_submitted':
    case 'checkout_shipping_method_submitted': {
      const cart = cartEcommerce(engine, e.data.cart);
      const shipping_tier = shippingTier(e.data);
      return checkoutStep(engine, { ...cart, currencyCode: cart.currency, shipping_tier }, { shipping_tier });
    }
    case 'checkout_payment_info_submitted': {
      const payment_type = paymentType(e.data.payment_method);
      return checkoutStep(engine, { ...cartEcommerce(engine, e.data.cart), payment_type }, { payment_type });
    }
    case 'checkout_completed':
      return purchasePush(engine, e);
    case 'upsell_completed':
      return upsellPurchasePush(engine, e);
    case 'upsell_viewed':
    case 'upsell_skipped': {
      const { id, name } = upsellPackage(engine, e);
      const upsell = { package_id: id, package_name: name };
      return e.event_type === 'upsell_viewed'
        ? { order_id: e.data.ref_id, page_path: e.data.page, upsell: { ...upsell, currency: currency(engine) } }
        : { order_id: e.data.ref_id, upsell };
    }
    case 'promotion_viewed':
    case 'promotion_selected':
      return { ecommerce: promotionFields(e.data) };
  }
}
