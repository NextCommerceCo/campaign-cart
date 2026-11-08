import type { TrackingEvent, TrackingName } from '../../engine/events/analytics';
import type { CartItem } from '../../engine/events/carts';
import type { OrderItem } from '../../engine/events/orders';
import { dollars } from '../../engine/format';
import type { ApiOrder } from '../../engine/types';
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
export const RUDDERSTACK: Partial<Record<TrackingName, RudderStackName>> = {
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
};

const defined = <T extends object>(o: T): T =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '')) as T;

const total = (products: RudderStackProduct[]) => dollars(products.reduce((n, p) => n + p.price * p.quantity, 0));

const currencyOf = (e: TrackingEvent) => {
  const data = e.data as { currency?: string; cart?: { currency?: string } };
  return data.currency ?? data.cart?.currency ?? e.context.campaign?.currency ?? 'USD';
};

/**
 * @deprecated 0.4.x tax basis of RudderStack's order prices, kept for parity with what 0.4.x built
 * from `dl_purchase`: tax included when a line's price before discounts with tax is nearer its
 * package's price than the one without.
 */
const taxIncluded = (engine: RudderStackSource, order: ApiOrder) => {
  for (const line of order.lines ?? []) {
    const catalog = Number(engine.getPackage(line.package ?? 0)?.price);
    const qty = line.quantity || 1;
    const incl = Number(line.price_incl_tax_excl_discounts) / qty;
    const excl = Number(line.price_excl_tax_excl_discounts) / qty;
    if (!(catalog > 0) || !Number.isFinite(incl) || !Number.isFinite(excl) || Math.abs(incl - excl) <= 0.02) continue;
    return Math.abs(incl - catalog) < Math.abs(excl - catalog);
  }
  return false;
};

/** The `rudderanalytics` calls a tracking event becomes, in order; none for one that is not sent. */
export function rudderStackCalls(
  e: TrackingEvent,
  engine: RudderStackSource,
  options: RudderStackOptions = {},
): RudderStackCall[] {
  const { campaign, page_location: url, page_title: title, page_referrer: referrer } = e.context;
  const category = campaign?.name;
  const page_type = options.pageType || 'product';
  const page_name = options.pageName || title || page_type;
  const campaignProps: RudderStackCampaign = defined({
    campaign_name: campaign?.name,
    campaign_api_key: options.apiKey,
    campaign_currency: campaign?.currency,
    campaign_language: campaign?.language,
    campaign_id: campaign && String(campaign.id),
    campaign_session_id: e.context.session_id,
  });
  const context: RudderStackContext = { page_type, page_name, ...campaignProps };
  const currency = currencyOf(e);

  const cartProduct = (l: CartItem, position: number): RudderStackProduct => {
    const pkg = engine.getPackage(l.package_id);
    const units = pkg?.qty || 1;
    const sku = l.sku || String(pkg?.external_id ?? l.package_id);
    return {
      product_id: l.product_id === undefined ? sku : String(l.product_id),
      sku,
      name: l.product_title ?? '',
      price: l.price === undefined ? Number(pkg?.price ?? 0) : dollars(l.price / units),
      quantity: units * l.quantity,
      url,
      position,
      ...defined({ category, variant: l.variant_title, image_url: l.image }),
    };
  };

  const orderProducts = (refId: string, lines: OrderItem[]) => {
    const { paidOrder, order } = engine.getState().order ?? {};
    const raw = [paidOrder, order].find((o) => o?.ref_id === refId);
    const incl = raw ? taxIncluded(engine, raw) : true;
    const products = lines.map((l, position): RudderStackProduct => {
      const line = raw?.lines?.find((r) => String(r.id) === l.id);
      const pkg = line?.package ? engine.getPackage(line.package) : undefined;
      const sku = l.sku || pkg?.product_sku || `SKU-${l.product_id || l.id}`;
      const id = l.product_id ?? pkg?.product_id;
      const paid = line ? Number(incl ? line.price_incl_tax : line.price_excl_tax) / (line.quantity || 1) : l.price;
      return {
        product_id: id === undefined ? sku : String(id),
        sku,
        name: l.product_title,
        price: dollars(paid),
        quantity: l.quantity,
        url,
        position,
        ...defined({
          category,
          brand: pkg?.product_name || category,
          variant: l.variant_title || pkg?.product_variant_name,
          image_url: l.image || pkg?.image,
        }),
      };
    });
    return { raw, incl, products };
  };

  const track = <N extends TrackName>(name: N, properties: Omit<RudderStackEventMap[N], keyof RudderStackContext>) => ({
    call: 'track' as const,
    name,
    properties: { ...properties, ...context } as RudderStackEventMap[N],
  });

  switch (e.event_type) {
    case 'page_viewed': {
      const properties = { path: url.replace(/^\w+:\/\/[^/]*/, '') || '/', url, title, referrer, ...campaignProps };
      const name = `${page_type.charAt(0).toUpperCase()}${page_type.slice(1)} Page View` as const;
      return [
        { call: 'page', category: page_type, name: page_name, properties },
        { call: 'track', name, properties: { page_name, ...properties } },
      ];
    }
    case 'product_viewed':
      return [track('Product Viewed', { ...cartProduct(e.data, 0), currency })];
    case 'product_list_viewed': {
      const products = e.data.map(cartProduct);
      return [track('Product List Viewed', { products, currency, list_id: 'product_list', category: 'Product List' })];
    }
    case 'product_added_to_cart':
    case 'product_removed_from_cart': {
      const name = e.event_type === 'product_added_to_cart' ? 'Product Added' : 'Product Removed';
      return [track(name, { cart_id: e.session_id, ...cartProduct(e.data, 0), currency })];
    }
    case 'cart_updated': {
      const products = e.data.lines.map(cartProduct);
      return [track('Cart Viewed', { cart_id: e.session_id, products, currency, value: total(products) })];
    }
    case 'checkout_started': {
      const { lines, shipping_method, coupons } = e.data.cart;
      const products = lines.map(cartProduct);
      const value = total(products);
      const props = { value, revenue: value, currency, affiliation: category || 'Funnels', products };
      return [track('Checkout Started', defined({ ...props, shipping: shipping_method?.price, coupon: coupons[0] }))];
    }
    case 'checkout_contact_info_submitted': {
      const { user, billing_same_as_shipping, billing_address, shipping_address } = e.data;
      if (!user?.email) return [];
      const address = billing_same_as_shipping === false ? billing_address : shipping_address;
      const traits = defined({
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
      return [{ call: 'identify', userId: user.email, traits }];
    }
    case 'checkout_shipping_address_submitted':
    case 'checkout_shipping_method_submitted': {
      const shipping_method = e.data.cart.shipping_method?.name ?? 'Standard';
      return [track('Checkout Step Completed', { checkout_id: e.session_id, step: 2, shipping_method })];
    }
    case 'checkout_payment_info_submitted': {
      const method = e.data.payment_method;
      const payment_method = method === 'card_token' ? 'Credit Card' : method;
      return [track('Payment Info Entered', defined({ checkout_id: e.session_id, step: 3 as const, payment_method }))];
    }
    case 'checkout_completed':
    case 'upsell_completed': {
      const order = e.event_type === 'checkout_completed';
      const { user, billing_address: b } = e.data;
      const lines = order ? e.data.lines.filter((l) => !l.upsell) : [e.data.upsell.line];
      const { raw, incl, products } = orderProducts(e.data.ref_id, lines);
      const subtotal = total(products);
      const tax = order ? e.data.tax : 0;
      const rawShipping = raw && (incl ? raw.shipping_incl_tax : raw.shipping_excl_tax);
      const shipping = order ? Number(rawShipping ?? e.data.shipping_method?.price ?? 0) : 0;
      const coupon = engine.getState().order?.coupon;
      const props = {
        checkout_id: e.session_id,
        order_id: e.event_id,
        affiliation: order ? 'Online Store' : 'Upsell',
        subtotal,
        revenue: subtotal,
        total: dollars(subtotal + tax + shipping),
        shipping,
        tax,
        currency,
        products,
        ...(order && e.data.total_discount > 0 && { discount: e.data.total_discount }),
        ...(order && coupon?.refId === e.data.ref_id && coupon.code && { coupon: coupon.code }),
      };
      const traits = Object.fromEntries(
        Object.entries({
          email: user?.email,
          firstName: (b ? b.first_name || user?.first_name : user?.first_name) || undefined,
          lastName: (b ? b.last_name || user?.last_name : user?.last_name) || undefined,
          phone: (b ? b.phone || user?.phone : user?.phone) || undefined,
          city: b && (b.city ?? ''),
          state: b && (b.state ?? ''),
          country: b?.country,
          postalCode: b && (b.postcode ?? ''),
        }).filter(([, v]) => v !== undefined),
      ) as RudderStackTraits;
      const identify: RudderStackCall[] = Object.keys(traits).length
        ? [{ call: 'identify', userId: user?.email || e.event_id, traits }]
        : [];
      return [...identify, track('Order Completed', props)];
    }
    case 'upsell_viewed':
    case 'upsell_skipped': {
      const id = e.data.lines[0]?.package_id;
      const viewed = e.event_type === 'upsell_viewed';
      const named = id ? (engine.getPackage(id)?.name ?? `Package ${id}`) : 'Unknown Package';
      const upsell = {
        order_id: e.data.ref_id,
        product_id: viewed ? 'page_view' : id ? String(id) : 'unknown',
        name: viewed ? 'Upsell Page View' : named,
        quantity: 1 as const,
        currency,
      };
      return [track(viewed ? 'Upsell Viewed' : 'Upsell Skipped', upsell)];
    }
    default:
      return [];
  }
}
