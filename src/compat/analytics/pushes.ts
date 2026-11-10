import type { Engine } from '../../engine/engine';
import type { TrackingEvent, TrackingName } from '../../engine/events/analytics';
import { paymentType } from '../../engine/order/payment';
import { apiOrder, PRODUCT_LIST, promotionFields, shippingTier, upsellPackage } from '../../engine/tracking';
import { cartEcommerce, currency, ecommerce, purchase, upsellPurchase, valueOf } from './ecommerce';
import type { DataLayerEcommerce, DataLayerEventMap, DataLayerName, DataLayerPush } from './schema';
import type { NAMES } from '.';

/** The fields of a `dl_*` push after the ones every push carries. */
export type Fields<N extends DataLayerName> = N extends DataLayerName
  ? Omit<DataLayerEventMap[N], keyof DataLayerPush>
  : never;

type Of<K extends TrackingName> = Fields<(typeof NAMES)[K]>;

export type LineEvent = TrackingEvent<'product_added_to_cart' | 'product_removed_from_cart'>;

export const isLineEvent = (e: TrackingEvent): e is LineEvent =>
  e.event_type === 'product_added_to_cart' || e.event_type === 'product_removed_from_cart';

/**
 * The lines one change added or removed come as one tracking event each, in one tick; 0.4.x sent
 * them as one `dl_add_to_cart` / `dl_remove_from_cart`, under the first line's id.
 */
export function lineFields(engine: Engine, run: LineEvent[]): Of<LineEvent['event_type']> {
  const cart = ecommerce(
    engine,
    run.map((e) => e.data),
  );
  const first_in_session = run.some((e) => 'first_in_session' in e.data && e.data.first_in_session);
  return run[0]!.event_type === 'product_added_to_cart' ? { ecommerce: cart, first_in_session } : { ecommerce: cart };
}

const cartTotal = (engine: Engine) => engine.getState().cart.summary?.total ?? '0';

const dataLayerCart = (engine: Engine): Of<'cart_updated'>['cart'] => {
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

const checkoutStep = <E extends DataLayerEcommerce, F extends object>(engine: Engine, ecommerce: E, fields: F) => ({
  ecommerce,
  event_category: 'ecommerce' as const,
  event_value: Number(cartTotal(engine)),
  ...fields,
});

const purchasePush = (engine: Engine, e: TrackingEvent<'checkout_completed'>): Of<'checkout_completed'> | undefined => {
  const order = apiOrder(engine, e.data.ref_id);
  if (!order) return undefined;
  const coupon = engine.getState().order?.coupon;
  const code = coupon?.refId === order.ref_id ? coupon.code : undefined;
  const paid = new Set(e.data.lines.map((l) => l.id));
  const lines = (order.lines ?? []).filter((l) => paid.has(String(l.id)));
  return { pageType: 'purchase', ecommerce: purchase(engine, order, lines, e.event_id, code) };
};

const upsellPurchasePush = (
  engine: Engine,
  e: TrackingEvent<'upsell_completed'>,
): Of<'upsell_completed'> | undefined => {
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
export function dataLayerFields(
  engine: Engine,
  e: Exclude<TrackingEvent, LineEvent>,
): Of<Exclude<TrackingName, LineEvent['event_type']>> | undefined {
  switch (e.event_type) {
    case 'page_viewed':
      return {
        cart_total: cartTotal(engine),
        ecommerce: ecommerce(engine, engine.cart.current().lines),
      } satisfies Of<'page_viewed'>;
    case 'product_viewed':
      return { ecommerce: ecommerce(engine, [e.data]) } satisfies Of<'product_viewed'>;
    case 'product_list_viewed': {
      const { value: _, ...list } = ecommerce(engine, e.data);
      return {
        ecommerce: { ...list, item_list_id: PRODUCT_LIST.id, item_list_name: PRODUCT_LIST.name },
      } satisfies Of<'product_list_viewed'>;
    }
    case 'cart_updated':
      return {
        cart_total: cartTotal(engine),
        ecommerce: cartEcommerce(engine, e.data),
        cart: dataLayerCart(engine),
      } satisfies Of<'cart_updated'>;
    case 'checkout_started':
      return {
        cart_total: cartTotal(engine),
        ecommerce: cartEcommerce(engine, e.data.cart),
      } satisfies Of<'checkout_started'>;
    case 'checkout_contact_info_submitted': {
      const { currency, value } = cartEcommerce(engine, e.data.cart);
      return { currency, value, lead_source: 'checkout' } satisfies Of<'checkout_contact_info_submitted'>;
    }
    case 'checkout_shipping_address_submitted':
    case 'checkout_shipping_method_submitted': {
      const cart = cartEcommerce(engine, e.data.cart);
      const shipping_tier = shippingTier(e.data);
      return checkoutStep(
        engine,
        { ...cart, currencyCode: cart.currency, shipping_tier },
        { shipping_tier },
      ) satisfies Of<'checkout_shipping_address_submitted'>;
    }
    case 'checkout_payment_info_submitted': {
      const payment_type = paymentType(e.data.payment_method);
      return checkoutStep(
        engine,
        { ...cartEcommerce(engine, e.data.cart), payment_type },
        { payment_type },
      ) satisfies Of<'checkout_payment_info_submitted'>;
    }
    case 'checkout_completed':
      return purchasePush(engine, e);
    case 'upsell_completed':
      return upsellPurchasePush(engine, e);
    case 'upsell_viewed': {
      const { id, name } = upsellPackage(engine, e);
      const upsell = { package_id: id, package_name: name, currency: currency(engine) };
      return { order_id: e.data.ref_id, page_path: e.data.page, upsell } satisfies Of<'upsell_viewed'>;
    }
    case 'upsell_skipped': {
      const { id, name } = upsellPackage(engine, e);
      return { order_id: e.data.ref_id, upsell: { package_id: id, package_name: name } } satisfies Of<'upsell_skipped'>;
    }
    case 'promotion_viewed':
    case 'promotion_selected':
      return { ecommerce: promotionFields(e.data) } satisfies Of<'promotion_viewed'>;
  }
}
