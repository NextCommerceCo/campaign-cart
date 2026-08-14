/**
 * API type definitions based on NextCommerce Campaigns API schema
 */

// Re-export from the OpenAPI spec we reviewed
export interface Campaign {
  currency: string;
  language: string;
  name: string;
  packages: PackageSerializer[];
  payment_env_key: string;
  shipping_methods: ShippingOption[];
  available_express_payment_methods?: PaymentMethodOption[];
  available_payment_methods?: PaymentMethodOption[];
  available_currencies?: Array<{ code: string; label: string }>;
  available_shipping_countries?: Array<{ code: string; label: string }>;
}

export interface PackageSerializer {
  ref_id: number;
  external_id: number;
  name: string;
  price: string;
  price_total: string;
  price_retail?: string;
  price_retail_total?: string;
  price_recurring?: string;
  price_recurring_total?: string;
  qty: number;
  image: string;
  is_recurring: boolean;
  interval?: 'day' | 'month' | null;
  interval_count?: number | null;
}

export interface Cart {
  checkout_url: string;
  currency: string;
  lines: CartLine[];
  total_excl_tax: string;
  total_incl_tax: string;
  total_excl_tax_excl_discounts: string;
  total_incl_tax_excl_discounts: string;
  total_discounts: string;
  discounts: Voucher[];
  user: User;
  attribution?: MarketingAttribution;
}

export interface Discount {
  offer_id: number;
  amount: string;
  description?: string;
  name?: string;
  percentage?: string;
}

export interface SummaryLine {
  package_id: number;
  quantity: number;
  discounts: Discount[];
  original_unit_price: string;
  original_package_price: string;
  unit_price: string;
  package_price: string;
  subtotal: string;
  total_discount: string;
  total: string;
  // Package data enriched from campaign — populated by the cart store after the API call
  name?: string;
  image?: string;
  qty?: number;
  price?: string;
  price_total?: string;
  price_retail?: string;
  price_retail_total?: string;
  price_recurring?: string;
  price_recurring_total?: string;
  is_recurring?: boolean;
  interval?: 'day' | 'month' | null;
  interval_count?: number | null;
  original_recurring_price?: string;
  currency?: string;
  product_name?: string;
  product_variant_name?: string;
  product_sku?: string | null;
  product_variant_attribute_values?: Array<{
    code: string;
    name: string;
    value: string;
  }>;
  /** Custom key-value properties — enriched from cart item after calculate. */
  properties?: Record<string, string>;
}

export interface ShippingMethodSummary {
  id: number;
  name: string;
  code: string;
  original_price: string;
  price: string;
  discounts: Discount[];
}

export interface CartSummary {
  lines: SummaryLine[];
  shipping_method: ShippingMethodSummary;
  offer_discounts: Discount[];
  voucher_discounts: Discount[];
  subtotal: string;
  total_discount: string;
  total: string;
  currency: string;
}

export interface CartLine {
  id: number;
  quantity: number;
  price_excl_tax: string;
  price_incl_tax: string;
  price_excl_tax_excl_discounts: string;
  price_incl_tax_excl_discounts: string;
  product_title: string;
  product_sku: string;
  image: string;
  is_upsell: boolean;
}

/**
 * A placed order, exactly as the orders API returns it — its lines, totals,
 * shipping, addresses, and the URLs the shopper is sent to next.
 *
 * This is **the order object the SDK holds**: creating an order, fetching one by
 * `ref_id`, and adding a post-purchase upsell all resolve to it, and it is what
 * the order store ({@link useOrderStore}) keeps on a receipt or upsell page.
 * Read it when you need any total, line, or address.
 *
 * {@link OrderData} is a smaller, older view of this same object — six fields
 * plus loosely typed `lines`/`user` — and is only the declared payload type of
 * the `order:completed` event. At runtime that event delivers a full `Order`.
 *
 * Every money field is a decimal **string** in the order's `currency` (`"59.98"`),
 * not a number, so it survives JSON without rounding. Parse it before doing
 * arithmetic.
 *
 * @example
 * ```ts
 * import { useOrderStore, type Order } from '@next-commerce/campaign-cart';
 *
 * const order: Order | null = useOrderStore.getState().order;
 * if (order) {
 *   console.log(order.number, order.total_incl_tax); // "NX-10428" "59.98"
 *   const upsells = order.lines.filter(line => line.is_upsell);
 *   console.log(`${upsells.length} upsell line(s) added after checkout`);
 * }
 * ```
 */
export interface Order {
  /**
   * The order's reference. It is the id everything else keys off: the SDK reads
   * it from `?ref_id=` to load the order on a receipt or upsell page, and sends
   * it back to add post-purchase upsells.
   */
  ref_id: string;
  /** Human-facing order number to show the customer, e.g. `"NX-10428"`. */
  number: string;
  /** ISO currency code the order was charged in, e.g. `"USD"`. */
  currency: string;
  /**
   * Every line on the order, one per package. Lines added after checkout by an
   * upsell carry `is_upsell: true`, which is how a thank-you page tells the
   * original purchase apart from what was added later.
   */
  lines: OrderLine[];
  /** Order grand total before tax. */
  total_excl_tax: string;
  /** Order grand total the customer was charged, tax included. */
  total_incl_tax: string;
  /** Tax charged on the order. */
  total_tax: string;
  /** Everything discounted off the order — offer discounts and vouchers together. */
  total_discounts: string;
  /** Shipping charged before tax. */
  shipping_excl_tax: string;
  /** Shipping charged, tax included. */
  shipping_incl_tax: string;
  /** Tax charged on shipping. */
  shipping_tax: string;
  /** Display name of the shipping method chosen at checkout, e.g. `"Standard"`. */
  shipping_method: string;
  /** Code of that shipping method, matching the campaign's `shipping_methods[].code`. */
  shipping_code: string;
  /**
   * Tax presentation hint the orders endpoint returns for stores that show tax
   * as a separate line. The SDK does not read it; it is here because the API
   * sends it. Absent for stores that do not display tax separately.
   */
  display_taxes?: string;
  /**
   * The discounts applied to the order, itemised. Each entry carries `amount`
   * plus, when the API knows them, `offer_id`, `name`, `description`, and
   * `percentage`. Use {@link Order.total_discounts | total_discounts} for the
   * single "you saved" figure.
   */
  discounts: Discount[];
  /** The customer the order was placed for — name, email, and phone. */
  user: OrderUser;
  /** Where the goods ship. Absent on orders with nothing to ship. */
  shipping_address?: OrderAddress;
  /** Where the card is billed. Absent when it is the same as the shipping address. */
  billing_address?: OrderAddress;
  /**
   * The marketing attribution captured with the order — UTM parameters, click
   * ids, affiliate and funnel. Absent when the visit carried none.
   */
  attribution?: MarketingAttribution;
  /**
   * How the order was paid for, as the API's own code — `"paypal"`,
   * `"card_token"`, `"apple_pay"` and so on. The orders API records the method
   * chosen at checkout and returns it on every order it sends back, so a
   * receipt page can name it.
   *
   * `null` on an order the platform has no method recorded for. There is no
   * "assume card" default: a page that shows this shows nothing when it is
   * null, rather than naming a method the shopper did not use.
   *
   * `data-next-display="order.paymentMethod"` renders this through a friendlier
   * label for the common methods — see the order-display guide's
   * [display paths](../features/display/order-display/guide/reference/display-paths.md).
   *
   * `'external'` is wider than {@link PaymentMethod} on purpose: a payment taken
   * outside the platform and recorded in the admin dashboard comes back on the
   * order like any other, even though the SDK can never *send* it.
   */
  payment_method?: PaymentMethod | 'external' | null;
  /** URL of the hosted order-status/receipt page for this order. */
  order_status_url: string;
  /**
   * Where to send the shopper to finish paying, for payment methods that need a
   * further step (PayPal, Klarna, and other redirect flows). When present the
   * SDK redirects here instead of to
   * {@link Order.order_status_url | order_status_url}.
   */
  payment_complete_url?: string;
  /**
   * Whether lines may still be added to this order. `false` means the order is
   * closed to upsells, and the SDK hides every offer on an upsell page rather
   * than letting a shopper accept one that will fail.
   */
  supports_post_purchase_upsells: boolean;
  /** `true` for a test-mode order — a real order record, but no money moved. */
  is_test: boolean;
  /**
   * What shows up next to the charge on the customer's card or bank statement.
   * Up to 20 characters — letters, numbers, spaces, and `.`, `-`, `*`.
   *
   * `null` or absent when the store has not configured one; the gateway's own
   * default descriptor applies instead. The SDK does not read this field today —
   * declared because the orders API sends it on every order.
   */
  statement_descriptor?: string | null;
}

/**
 * One line on a placed {@link Order} — a package the customer bought, at the
 * price they were charged for it.
 *
 * Money fields are decimal strings in the order's currency. The
 * `*_excl_discounts` pair is the price *before* discounts, so
 * `price_incl_tax_excl_discounts - price_incl_tax` is what this line saved.
 */
export interface OrderLine {
  /** The line's id on the order. Use it to tell two lines of the same package apart. */
  id: number;
  /** Product image URL for the line, for showing on a receipt. */
  image: string;
  /**
   * `true` when this line was added after checkout by a post-purchase upsell,
   * `false` for the original purchase.
   */
  is_upsell: boolean;
  /** What this line was charged, before tax and after discounts. */
  price_excl_tax: string;
  /** What this line would have cost before tax with no discounts applied. */
  price_excl_tax_excl_discounts: string;
  /** What this line was charged, tax included and after discounts. */
  price_incl_tax: string;
  /** What this line would have cost with tax and no discounts applied. */
  price_incl_tax_excl_discounts: string;
  /** SKU of the purchased variant. */
  product_sku: string;
  /** Product name to display on the line. */
  product_title: string;
  /** Longer product description, when the catalog has one. */
  product_description?: string;
  /** The variant the customer chose (e.g. `"Large / Blue"`), when the product has variants. */
  variant_title?: string;
  /** Units bought on this line. */
  quantity: number;
  /**
   * Catalog id of the product this line belongs to. `null` when the API has no
   * catalog product for the line. The SDK does not read this field today —
   * declared because the orders API sends it on every line.
   */
  product_id?: number | null;
  /**
   * Catalog id of the specific variant purchased (size, color, and similar
   * choices). `null` when the product has no variants, or the line predates
   * variant tracking. The SDK does not read this field today — declared because
   * the orders API sends it on every line.
   */
  variant_id?: number | null;
  /**
   * Arbitrary key-value data attached to the line at checkout — internal keys
   * the platform uses for its own bookkeeping, filtered out before this response
   * is sent. `null` or absent when nothing was attached. The SDK does not read
   * this field today — declared because the orders API sends it on every line.
   */
  metadata?: Record<string, unknown> | null;
  /**
   * Customer-facing custom values collected for this line at checkout — a gift
   * note or an engraving, for example — as an ordered list rather than the
   * {@link OrderLine.metadata | metadata} dictionary. `null` or empty when none
   * were collected. The SDK does not read this field today — declared because
   * the orders API sends it on every line.
   */
  properties?: OrderLineProperty[] | null;
}

/**
 * One customer-facing custom value collected on an {@link OrderLine} at
 * checkout — a gift message, an engraving, a personalization choice.
 */
export interface OrderLineProperty {
  /** The field's name, e.g. `"engraving"`. */
  key: string;
  /** What the customer entered or chose for that field. */
  value: string;
}

/**
 * Where a visitor came from, captured on the cart and carried onto the
 * {@link Order} — the UTM parameters, click ids, affiliate and funnel of the
 * visit that converted.
 *
 * Every field is optional: a direct visit with no campaign parameters produces
 * an object with almost nothing in it, and absent means "not present on the
 * landing URL", never "attribution failed".
 */
export interface MarketingAttribution {
  /** `utm_source` — which site or channel sent the visit. */
  utm_source?: string;
  /** `utm_medium` — the kind of traffic, e.g. `"cpc"`, `"email"`. */
  utm_medium?: string;
  /** `utm_campaign` — the campaign name the ad or email belonged to. */
  utm_campaign?: string;
  /** `utm_term` — the paid keyword, when the source supplies one. */
  utm_term?: string;
  /** `utm_content` — which creative or link variant was clicked. */
  utm_content?: string;
  /** Google click id, for matching the order back to a Google Ads click. */
  gclid?: string;
  /** Affiliate identifier credited with the sale. */
  affiliate?: string;
  /** Funnel identifier for the page flow the visitor went through. */
  funnel?: string;
  /** First affiliate sub-id, as passed on the landing URL. */
  subaffiliate1?: string;
  /** Second affiliate sub-id. */
  subaffiliate2?: string;
  /** Third affiliate sub-id. */
  subaffiliate3?: string;
  /** Fourth affiliate sub-id. */
  subaffiliate4?: string;
  /** Fifth affiliate sub-id. */
  subaffiliate5?: string;
  /**
   * Everything else the SDK recorded about the visit — landing page, referrer,
   * device, timestamp, and any custom values the page added.
   */
  metadata?: Record<string, any>;
}

export interface ShippingOption {
  ref_id: number;
  code: string;
  price: string;
}

export interface PaymentMethodOption {
  code: string;
  label: string;
}

export interface User {
  accepts_marketing?: boolean;
  email?: string;
  first_name: string;
  ip?: string;
  language: string;
  last_name: string;
  phone_number?: string;
  user_agent?: string;
}

/**
 * The customer a placed {@link Order} belongs to, as the orders API returns it.
 *
 * Same fields as the customer on a cart; it is a separate name because the two
 * come from different endpoints and may diverge.
 */
export interface OrderUser {
  /** Whether the customer opted in to marketing email at checkout. */
  accepts_marketing?: boolean;
  /** Email the receipt was sent to. Absent on orders placed without one. */
  email?: string;
  /** Customer's first name. */
  first_name: string;
  /** IP address the order was placed from, when the API returns it. */
  ip?: string;
  /** Language code the customer checked out in, e.g. `"en"`. */
  language: string;
  /** Customer's last name. */
  last_name: string;
  /** Phone number given at checkout, when one was collected. */
  phone_number?: string;
  /** Browser user-agent string recorded with the order, when the API returns it. */
  user_agent?: string;
}

/**
 * A postal address on a placed {@link Order} — where it ships, or where the card
 * is billed.
 *
 * The `line1`–`line4` shape comes from the API: `line4` is the **city**, and
 * `state` and `postcode` are optional because not every country has them. An
 * absent field means the country does not use it or the shopper left it blank,
 * so print the lines that are present rather than assuming a fixed layout.
 */
export interface OrderAddress {
  /** Two-letter country code, e.g. `"US"`. */
  country: string;
  /** Recipient's first name. */
  first_name: string;
  /** Recipient's last name. */
  last_name: string;
  /** Street address. */
  line1: string;
  /** Apartment, suite, or unit. */
  line2?: string;
  /** Third address line, for addresses that need one. */
  line3?: string;
  /** City. */
  line4: string;
  /** Delivery notes the shopper left for the courier. */
  notes?: string;
  /** Contact phone for the delivery. */
  phone_number?: string;
  /** Postal or ZIP code. Absent for countries that do not use one. */
  postcode?: string;
  /** State, province, or region. Absent for countries that do not use one. */
  state?: string;
}

export interface Voucher {
  amount: string;
  description?: string;
  name?: string;
}

/**
 * How an order is paid for — the code the orders API accepts on
 * `payment_detail.payment_method`, and the one vocabulary the SDK uses for a
 * payment method from the radio to the order.
 *
 * `card_token` is a card, and it is a **token** rather than a number: the card
 * itself is entered in the payment provider's own hosted fields and never
 * reaches this page, this SDK, or this request. There is no plain "credit card"
 * value, deliberately. The rest name the wallet or scheme the shopper used.
 *
 * Every one of them except a directly-charged card sends the shopper away to pay
 * and brings them back — a card only when the bank asks for 3-D Secure — so an
 * order created with any of these can come back carrying
 * {@link Order.payment_complete_url}.
 *
 * Not here on purpose: `external`, a payment taken outside the platform, which
 * an admin records in the dashboard and the SDK never sends —
 * {@link Order.payment_method} accepts it on the way back. `giropay`, `sofort`
 * and `sepa_debit` were removed on 2026-08-14; the platform no longer offers the
 * first two, and SEPA Direct Debit is `sepa_direct`.
 */
export type PaymentMethod =
  | 'apple_pay'
  | 'card_token'
  | 'paypal'
  | 'klarna'
  | 'ideal'
  | 'bancontact'
  | 'google_pay'
  | 'sepa_direct'
  | 'swish'
  | 'twint'
  | 'link'
  | 'affirm';

// Request/Response types
export interface CartBase {
  address?: AddressCart;
  attribution?: Attribution;
  currency?: string;
  lines: LineWithUpsell[];
  user: UserCreateCart;
  vouchers?: string[];
}

export interface AddressCart {
  country: string;
  first_name: string;
  last_name: string;
  line1: string;
  line2?: string;
  line3?: string;
  line4: string; // City
  notes?: string;
  phone_number?: string;
  postcode?: string;
  state?: string;
}

export interface Attribution {
  affiliate?: string;
  funnel?: string;
  gclid?: string;
  metadata?: Record<string, any>;
  subaffiliate1?: string;
  subaffiliate2?: string;
  subaffiliate3?: string;
  subaffiliate4?: string;
  subaffiliate5?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_medium?: string;
  utm_source?: string;
  utm_term?: string;
  everflow_transaction_id?: string;
}

export interface LineWithUpsell {
  is_upsell?: boolean;
  package_id: number;
  quantity: number;
  properties?: Record<string, string>;
}

export interface UserCreateCart {
  accepts_marketing?: boolean;
  email?: string;
  first_name: string;
  language: string;
  last_name: string;
  phone_number?: string;
}

export interface CreateOrder {
  attribution?: Attribution;
  billing_address?: Address;
  billing_same_as_shipping_address?: boolean;
  currency?: string;
  lines: LineWithUpsell[];
  payment_detail: Payment;
  payment_failed_url?: string;
  shipping_address?: Address;
  shipping_method: number;
  success_url: string;
  use_default_billing_address?: boolean;
  use_default_shipping_address?: boolean;
  user?: OrderUser;
  vouchers?: string[];
}

export interface CartCalculateSummary {
  lines: LineWithUpsell[];
  vouchers?: string[];
  currency?: string | null;
  shipping_method?: number;
}

export interface Address {
  country: string;
  first_name: string;
  is_default_for_billing?: boolean;
  is_default_for_shipping?: boolean;
  last_name: string;
  line1: string;
  line2?: string;
  line3?: string;
  line4: string; // City
  notes?: string;
  phone_number?: string;
  postcode?: string;
  state?: string;
}

export interface Payment {
  card_token?: string;
  external_payment_method?: string;
  payment_gateway?: number;
  payment_gateway_group?: number;
  /**
   * How to charge for this order.
   *
   * Wider than {@link PaymentMethod} on purpose: a page may offer a method this
   * SDK release has never heard of, and the SDK sends that name through rather
   * than substituting a card for it. The API is the authority on what it accepts
   * — it either creates the order (and answers with a
   * {@link Order.payment_complete_url} to finish paying at) or rejects the
   * request. `Order.payment_method` on the way back stays the known list.
   */
  payment_method: PaymentMethod | (string & {});
}

export interface AddUpsellLine {
  lines: UpsellLineItem[];
  payment_detail?: PaymentDetail;
  currency?: string;
  vouchers?: string[];
}

export interface UpsellLineItem {
  package_id: number;
  quantity: number;
  properties?: Record<string, string>;
}

export interface PaymentDetail {
  payment_gateway?: number;
  payment_gateway_group?: number;
}

export interface AddressAutocompleteResult {
  label: string;
  address: {
    line1: string;
    line2?: string;
    line3?: string;
    city: string;
    state: string;
    state_code: string;
    postcode: string;
    country: string;
    country_code: string;
  };
}

export interface AddressAutocomplete {
  results: AddressAutocompleteResult[];
}
