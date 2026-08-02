import { DataLayerEvent } from '../types';
import { createLogger } from '@/core/logger';
import {
  buildContextProps,
  getCampaignData,
  getPageMetadata,
} from './rudderstack-context';

const logger = createLogger('RudderStack');

/**
 * Build event properties based on event type
 */
export function buildEventProperties(
  event: DataLayerEvent,
  rudderEventName: string
): any {
  const data = event.data || event.ecommerce || {};
  const pageMetadata = getPageMetadata();

  // Page context + campaign_* identifiers on every track event.
  const baseProps = {
    page_type: pageMetadata.pageType,
    page_name: pageMetadata.pageName,
    ...buildContextProps(event),
  };

  // Stable per-session id (survives the whole funnel) used for the spec's
  // cart_id / checkout_id — RudderStack correlates cart → checkout → order by
  // these. No dedicated cart/checkout id exists client-side, so the session id
  // is the closest stable proxy (a per-event timestamp would break grouping).
  const sessionId: string | undefined = (event._metadata as any)?.session_id;

  switch (rudderEventName) {
    case 'Product Viewed':
    case 'Product Clicked':
      return buildProductViewedProps(data, baseProps);

    case 'Product List Viewed':
      return buildProductListViewedProps(data, baseProps);

    case 'Product Added':
    case 'Product Removed':
      return buildProductAddedRemovedProps(data, baseProps, sessionId);

    case 'Cart Viewed':
      return buildCartViewedProps(data, baseProps, sessionId);

    case 'Checkout Started':
      return buildCheckoutStartedProps(data, baseProps);

    case 'Checkout Step Completed':
      return buildShippingStepProps(data, baseProps, sessionId);

    case 'Payment Info Entered':
      return buildPaymentInfoProps(data, baseProps, sessionId);

    case 'Order Completed': {
      const props = buildOrderCompletedProps(data, baseProps, sessionId);
      identifyFromUserProperties(event.user_properties, props.order_id);
      return props;
    }

    case 'Upsell Viewed':
    case 'Upsell Skipped':
      return buildUpsellProps(event, baseProps);

    default:
      return { ...data, ...baseProps };
  }
}

/**
 * Coerce a value to a finite number, defaulting to 0.
 */
export function toNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Build Product Viewed / Product Clicked properties.
 * Spec: top-level Product fields + currency.
 */
export function buildProductViewedProps(data: any, baseProps: any): any {
  const item = (data.items || [])[0] || {};
  const campaignData = getCampaignData(data);

  return {
    ...formatProduct(item),
    currency: data.currency || campaignData.campaignCurrency || 'USD',
    ...baseProps,
  };
}

/**
 * Build Product List Viewed properties.
 * Spec: list_id, category, products[].
 */
export function buildProductListViewedProps(data: any, baseProps: any): any {
  const campaignData = getCampaignData(data);
  const props: any = {
    products: formatProducts(data.items || []),
    currency: data.currency || campaignData.campaignCurrency || 'USD',
  };

  const listId = data.item_list_id || data.list_id;
  if (listId) props.list_id = listId;
  const category = data.item_list_name || data.item_list_id;
  if (category) props.category = category;

  return { ...props, ...baseProps };
}

/**
 * Build Product Added / Product Removed properties.
 * Spec: cart_id + top-level Product fields. cart_id is the per-session id
 * (see buildEventProperties); omitted only if the session id is unavailable.
 */
export function buildProductAddedRemovedProps(
  data: any,
  baseProps: any,
  cartId?: string
): any {
  const item = (data.items || [])[0] || {};
  const campaignData = getCampaignData(data);

  return {
    ...(cartId ? { cart_id: cartId } : {}),
    ...formatProduct(item),
    currency: data.currency || campaignData.campaignCurrency || 'USD',
    ...baseProps,
  };
}

/**
 * Build Cart Viewed properties.
 * Spec: cart_id + products[]; value/currency added for reporting.
 */
export function buildCartViewedProps(
  data: any,
  baseProps: any,
  cartId?: string
): any {
  const campaignData = getCampaignData(data);

  return {
    ...(cartId ? { cart_id: cartId } : {}),
    products: formatProducts(data.items || []),
    currency: data.currency || campaignData.campaignCurrency || 'USD',
    value: toNumber(data.value),
    ...baseProps,
  };
}

/**
 * Build Checkout Step Completed properties for the shipping step.
 * Spec: checkout_id, step, shipping_method, payment_method.
 */
export function buildShippingStepProps(
  data: any,
  baseProps: any,
  checkoutId?: string
): any {
  // Step 2 by convention: 1 = contact/customer, 2 = shipping, 3 = payment.
  const props: any = {
    ...(checkoutId ? { checkout_id: checkoutId } : {}),
    step: 2,
  };
  if (data.shipping_tier) props.shipping_method = data.shipping_tier;
  return { ...props, ...baseProps };
}

/**
 * Build Payment Info Entered properties.
 * Spec: checkout_id, order_id, step, shipping_method, payment_method.
 */
export function buildPaymentInfoProps(
  data: any,
  baseProps: any,
  checkoutId?: string
): any {
  const props: any = {
    ...(checkoutId ? { checkout_id: checkoutId } : {}),
    step: 3,
  };
  if (data.payment_type) props.payment_method = data.payment_type;
  return { ...props, ...baseProps };
}

/**
 * Build Checkout Started properties.
 * Spec: order_id, affiliation, value, revenue, shipping, tax, discount,
 * coupon, currency, products[].
 */
export function buildCheckoutStartedProps(data: any, baseProps: any): any {
  const campaignData = getCampaignData(data);
  // value = order revenue after discounts/coupons; revenue = the same figure
  // excluding shipping and tax. At checkout start both equal item revenue.
  const value = toNumber(data.value);

  const props: any = {
    value,
    revenue: value,
    currency: data.currency || campaignData.campaignCurrency || 'USD',
    affiliation: data.affiliation || campaignData.campaignName || 'Funnels',
    products: formatProducts(data.items || []),
  };

  if (data.shipping !== undefined) props.shipping = toNumber(data.shipping);
  if (data.tax) props.tax = toNumber(data.tax);
  if (data.discount) props.discount = toNumber(data.discount);
  if (data.coupon) props.coupon = data.coupon;

  return { ...props, ...baseProps };
}

/**
 * Build Order Completed properties.
 * Spec: order_id, affiliation, subtotal, total, revenue, shipping, tax,
 * discount, coupon, currency, products[].
 */
export function buildOrderCompletedProps(
  data: any,
  baseProps: any,
  checkoutId?: string
): any {
  const campaignData = getCampaignData(data);
  // `value` from the pipeline is item revenue (Σ price × qty), excluding tax
  // and shipping — GA4 semantics. Map it per the RudderStack spec:
  //   revenue / subtotal = item revenue (excl. tax & shipping)
  //   total              = grand total the customer paid (incl. tax & shipping)
  const value = toNumber(data.value);
  const tax = toNumber(data.tax);
  const shipping = toNumber(data.shipping);
  const total = Math.round((value + tax + shipping) * 100) / 100;

  const props: any = {
    ...(checkoutId ? { checkout_id: checkoutId } : {}),
    order_id: data.transaction_id || '',
    affiliation: data.affiliation || campaignData.campaignName || 'Funnels',
    subtotal: value,
    revenue: value,
    total,
    shipping,
    tax,
    currency: data.currency || campaignData.campaignCurrency || 'USD',
    products: formatProducts(data.items || []),
  };

  if (data.discount) props.discount = toNumber(data.discount);
  if (data.coupon) props.coupon = data.coupon;

  return { ...props, ...baseProps };
}

/**
 * Build Upsell Viewed / Upsell Skipped properties. These custom events carry
 * their payload on `event.upsell` ({ package_id, package_name, price,
 * currency }) with the source order on `event.order_id`.
 */
export function buildUpsellProps(event: DataLayerEvent, baseProps: any): any {
  const upsell = (event as any).upsell || {};
  const campaignData = getCampaignData({});

  const props: any = {
    order_id: event.order_id || '',
    product_id: upsell.package_id || '',
    name: upsell.package_name || '',
    quantity: 1,
    currency: upsell.currency || campaignData.campaignCurrency || 'USD',
  };

  if (upsell.price !== undefined) props.price = toNumber(upsell.price);

  return { ...props, ...baseProps };
}

/**
 * Identify the customer from the event's user_properties (fired on purchase).
 * Traits use the RudderStack-recommended names.
 */
export function identifyFromUserProperties(
  userProperties: Record<string, any> | undefined,
  fallbackId?: string
): void {
  const props = userProperties || {};
  const userId = props.customer_id || props.customer_email || fallbackId;
  if (!userId) return;

  const traits: Record<string, any> = {
    email: props.customer_email,
    firstName: props.customer_first_name,
    lastName: props.customer_last_name,
    phone: props.customer_phone,
    city: props.customer_city,
    state: props.customer_province || props.customer_province_code,
    country: props.customer_country,
    postalCode: props.customer_zip,
  };
  Object.keys(traits).forEach(
    key => traits[key] === undefined && delete traits[key]
  );

  if (Object.keys(traits).length > 0) {
    window.rudderanalytics.identify(String(userId), traits);
    // Mirrors `ProviderAdapter.debug()` (a thin wrapper over `this.logger.debug`)
    // — this file has no adapter instance to call it on.
    logger.debug('User Identified on Purchase', { userId });
  }
}

/**
 * Map a GA4-format item (item_id / item_product_id / item_sku / index /
 * item_image …) to a RudderStack spec Product object. Optional fields are
 * only included when present so the payload stays clean.
 */
export function formatProduct(item: any): Record<string, any> {
  const product: Record<string, any> = {
    // product_id = the product's database ID; sku = the stock-keeping unit.
    // GA4 `item_id` holds the product SKU, `item_product_id` the numeric id.
    product_id: String(
      item.item_product_id ?? item.product_id ?? item.item_id ?? item.id ?? ''
    ),
    sku: String(item.item_sku ?? item.item_id ?? item.sku ?? ''),
    name: item.item_name ?? item.name ?? '',
    price: toNumber(item.price),
    quantity: parseInt(item.quantity, 10) || 1,
    url: window.location.href,
  };

  const category = item.item_category ?? item.category;
  if (category) product.category = category;
  const brand = item.item_brand ?? item.brand;
  if (brand) product.brand = brand;
  const variant = item.item_variant ?? item.variant;
  if (variant) product.variant = variant;
  if (item.coupon) product.coupon = item.coupon;
  // GA4 `index` is the 0-based list position.
  const position = item.index ?? item.position;
  if (typeof position === 'number') product.position = position;
  const imageUrl = item.item_image ?? item.image_url ?? item.image;
  if (imageUrl) product.image_url = imageUrl;

  return product;
}

/**
 * Map an array of GA4-format items to RudderStack spec Product objects.
 */
export function formatProducts(items: any[]): any[] {
  if (!Array.isArray(items)) return [];
  return items.map(item => formatProduct(item));
}
