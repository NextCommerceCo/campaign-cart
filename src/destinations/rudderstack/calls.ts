import type { TrackingEvent, TrackingName } from '../../engine/events/analytics';
import type { CartItem } from '../../engine/events/carts';
import type { Checkout } from '../../engine/events/checkout';
import type { Order, OrderItem } from '../../engine/events/orders';
import { addDollars, dollars } from '../../engine/display/format';
import { paymentType } from '../../engine/order/payment';
import {
  apiOrder,
  defined,
  orderLineProduct,
  paidUnit,
  perUnit,
  PRODUCT_LIST,
  shippingTier,
  taxIncluded,
  trackingCurrency,
  trackingValue,
  upsellPackage,
} from '../../engine/tracking';
import type {
  RudderStackCall,
  RudderStackCampaign,
  RudderStackContext,
  RudderStackEventMap,
  RudderStackName,
  RudderStackOptions,
  RudderStackProduct,
  RudderStackSource,
  RudderStackTraits,
  TrackName,
} from './types';

/** What each tracking event is sent as; the others are not sent. */
export const RUDDERSTACK = {
  page_viewed: 'page',
  product_viewed: 'Product Viewed',
  product_list_viewed: 'Product List Viewed',
  product_added_to_cart: 'Product Added',
  product_removed_from_cart: 'Product Removed',
  cart_updated: 'Cart Viewed',
  checkout_started: 'Checkout Started',
  checkout_contact_info_submitted: 'identify',
  checkout_shipping_address_submitted: 'Checkout Step Completed',
  checkout_shipping_method_submitted: 'Checkout Step Completed',
  checkout_payment_info_submitted: 'Payment Info Entered',
  checkout_completed: 'Order Completed',
  upsell_completed: 'Order Completed',
  upsell_viewed: 'Upsell Viewed',
  upsell_skipped: 'Upsell Skipped',
} as const satisfies Partial<Record<TrackingName, RudderStackName>>;

/** The object without its `undefined` and `''` fields. */
const withoutEmpty = <T extends object>(o: T): T =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '')) as T;

const total = (products: RudderStackProduct[]) => trackingValue(products) ?? 0;

/** What the calls of one tracking event read besides its data. */
interface Remap {
  engine: RudderStackSource;
  url: string;
  category?: string;
  currency: string;
  campaign: RudderStackCampaign;
  context: RudderStackContext;
}

const remapOf = (e: TrackingEvent, engine: RudderStackSource, options: RudderStackOptions): Remap => {
  const { campaign, page_title: title } = e.context;
  const page_type = options.pageType || 'product';
  const campaignProps: RudderStackCampaign = withoutEmpty({
    campaign_name: campaign?.name,
    campaign_api_key: options.apiKey,
    campaign_currency: campaign?.currency,
    campaign_language: campaign?.language,
    campaign_id: campaign && String(campaign.id),
    campaign_session_id: e.context.session_id,
  });
  return {
    engine,
    url: e.context.page_location,
    category: campaign?.name,
    currency: trackingCurrency(e) ?? 'USD',
    campaign: campaignProps,
    context: { page_type, page_name: options.pageName || title || page_type, ...campaignProps },
  };
};

const track = <N extends TrackName>(
  r: Remap,
  name: N,
  properties: Omit<RudderStackEventMap[N], keyof RudderStackContext>,
) => ({
  call: 'track' as const,
  name,
  properties: { ...properties, ...r.context } as RudderStackEventMap[N],
});

const cartProduct = (r: Remap, l: CartItem, position: number): RudderStackProduct => {
  const pkg = r.engine.getPackage(l.package_id);
  const [unit] = perUnit([l], r.engine);
  const sku = l.sku || String(pkg?.external_id ?? l.package_id);
  return {
    product_id: l.product_id === undefined ? sku : String(l.product_id),
    sku,
    name: l.product_title ?? '',
    price: unit!.price ?? Number(pkg?.price ?? 0),
    quantity: unit!.quantity,
    url: r.url,
    position,
    ...withoutEmpty({ category: r.category, variant: l.variant_title, image_url: l.image }),
  };
};

const cartProducts = (r: Remap, lines: CartItem[]) => lines.map((l, position) => cartProduct(r, l, position));

const orderProducts = (r: Remap, refId: string, lines: OrderItem[]) => {
  const raw = apiOrder(r.engine, refId);
  const incl = raw ? taxIncluded(r.engine, raw) : true;
  const products = lines.map((l, position): RudderStackProduct => {
    const line = raw?.lines?.find((x) => String(x.id) === l.id);
    const pkg = line?.package ? r.engine.getPackage(line.package) : undefined;
    const product = orderLineProduct(l, l.sku, pkg, r.category);
    return {
      product_id: product.product_id === undefined ? product.id : String(product.product_id),
      sku: product.id,
      name: l.product_title,
      price: dollars(line ? paidUnit(line, incl) : l.price),
      quantity: l.quantity,
      url: r.url,
      position,
      ...withoutEmpty({
        category: r.category,
        brand: product.brand,
        variant: product.variant,
        image_url: product.image,
      }),
    };
  });
  return { raw, incl, products };
};

const pageCalls = (e: TrackingEvent<'page_viewed'>, r: Remap): RudderStackCall[] => {
  const { page_location: url, page_title: title, page_referrer: referrer } = e.context;
  const { page_type, page_name } = r.context;
  const properties = { path: url.replace(/^\w+:\/\/[^/]*/, '') || '/', url, title, referrer, ...r.campaign };
  const name = `${page_type.charAt(0).toUpperCase()}${page_type.slice(1)} Page View` as const;
  return [
    { call: 'page', category: page_type, name: page_name, properties },
    { call: 'track', name, properties: { page_name, ...properties } },
  ];
};

const checkoutStarted = (checkout: Checkout, r: Remap) => {
  const { lines, shipping_method, coupons } = checkout.cart;
  const products = cartProducts(r, lines);
  const value = total(products);
  const props = { value, revenue: value, currency: r.currency, affiliation: r.category || 'Funnels', products };
  return track(
    r,
    RUDDERSTACK.checkout_started,
    withoutEmpty({ ...props, shipping: shipping_method?.price, coupon: coupons[0] }),
  );
};

const contactIdentify = ({ user, billing_same_as_shipping, billing_address, shipping_address }: Checkout) => {
  if (!user?.email) return [];
  const address = billing_same_as_shipping === false ? billing_address : shipping_address;
  const traits = withoutEmpty({
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    phone: user.phone,
    city: address?.city,
    state: address?.state,
    country: address?.country,
    postalCode: address?.postcode,
    acceptsMarketing: user.accepts_marketing || undefined,
  });
  return [{ call: 'identify' as const, userId: user.email, traits }];
};

const buyerTraits = ({ user, billing_address: b }: Order): RudderStackTraits =>
  defined({
    email: user?.email,
    firstName: (b ? b.first_name || user?.first_name : user?.first_name) || undefined,
    lastName: (b ? b.last_name || user?.last_name : user?.last_name) || undefined,
    phone: (b ? b.phone || user?.phone : user?.phone) || undefined,
    city: b && (b.city ?? ''),
    state: b && (b.state ?? ''),
    country: b?.country,
    postalCode: b && (b.postcode ?? ''),
  });

const orderCalls = (e: TrackingEvent<'checkout_completed' | 'upsell_completed'>, r: Remap): RudderStackCall[] => {
  const order = e.event_type === 'checkout_completed';
  const lines = order ? e.data.lines.filter((l) => !l.upsell) : [e.data.upsell.line];
  const { raw, incl, products } = orderProducts(r, e.data.ref_id, lines);
  const subtotal = total(products);
  const tax = order ? e.data.tax : 0;
  const rawShipping = raw && (incl ? raw.shipping_incl_tax : raw.shipping_excl_tax);
  const shipping = order ? Number(rawShipping ?? e.data.shipping_method?.price ?? 0) : 0;
  const coupon = r.engine.getState().order?.coupon;
  const props = {
    checkout_id: e.session_id,
    order_id: e.event_id,
    affiliation: order ? 'Online Store' : 'Upsell',
    subtotal,
    revenue: subtotal,
    total: addDollars([subtotal, tax, shipping]),
    shipping,
    tax,
    currency: r.currency,
    products,
    ...(order && e.data.total_discount > 0 && { discount: e.data.total_discount }),
    ...(order && coupon?.refId === e.data.ref_id && coupon.code && { coupon: coupon.code }),
  };
  const traits = buyerTraits(e.data);
  const identify: RudderStackCall[] = Object.keys(traits).length
    ? [{ call: 'identify', userId: e.data.user?.email || e.event_id, traits }]
    : [];
  return [...identify, track(r, RUDDERSTACK[e.event_type], props)];
};

/** The `rudderanalytics` calls a tracking event becomes, in order; none for one that is not sent. */
export function rudderStackCalls(
  e: TrackingEvent,
  engine: RudderStackSource,
  options: RudderStackOptions = {},
): RudderStackCall[] {
  const r = remapOf(e, engine, options);
  const { currency } = r;
  switch (e.event_type) {
    case 'page_viewed':
      return pageCalls(e, r);
    case 'product_viewed':
      return [track(r, RUDDERSTACK[e.event_type], { ...cartProduct(r, e.data, 0), currency })];
    case 'product_list_viewed': {
      const list = { list_id: PRODUCT_LIST.id, category: PRODUCT_LIST.name };
      return [track(r, RUDDERSTACK[e.event_type], { products: cartProducts(r, e.data), currency, ...list })];
    }
    case 'product_added_to_cart':
    case 'product_removed_from_cart':
      return [track(r, RUDDERSTACK[e.event_type], { cart_id: e.session_id, ...cartProduct(r, e.data, 0), currency })];
    case 'cart_updated': {
      const products = cartProducts(r, e.data.lines);
      return [
        track(r, RUDDERSTACK[e.event_type], { cart_id: e.session_id, products, currency, value: total(products) }),
      ];
    }
    case 'checkout_started':
      return [checkoutStarted(e.data, r)];
    case 'checkout_contact_info_submitted':
      return contactIdentify(e.data);
    case 'checkout_shipping_address_submitted':
    case 'checkout_shipping_method_submitted': {
      const step = { checkout_id: e.session_id, step: 2 as const, shipping_method: shippingTier(e.data) };
      return [track(r, RUDDERSTACK[e.event_type], step)];
    }
    case 'checkout_payment_info_submitted': {
      const payment_method = paymentType(e.data.payment_method);
      const step = withoutEmpty({ checkout_id: e.session_id, step: 3 as const, payment_method });
      return [track(r, RUDDERSTACK[e.event_type], step)];
    }
    case 'checkout_completed':
    case 'upsell_completed':
      return orderCalls(e, r);
    case 'upsell_viewed':
    case 'upsell_skipped': {
      const { id, name } = upsellPackage(engine, e);
      const upsell = { order_id: e.data.ref_id, product_id: id, name, quantity: 1 as const, currency };
      return [track(r, RUDDERSTACK[e.event_type], upsell)];
    }
    default:
      return [];
  }
}
