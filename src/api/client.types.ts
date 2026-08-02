/**
 * The campaign API surface, as an interface features can depend on.
 *
 * Everything a feature needs from the API is one of these thirteen calls. Depending on
 * the interface rather than on {@link ApiClient} buys two things:
 *
 * - **A test can pass a fake object.** Today a test that needs a stubbed API reaches for
 *   `vi.mock('@/api/client', …)`, which replaces the module for the whole file and is
 *   keyed on a path string — move or rename `client.ts` and the mock silently stops
 *   applying while the test still passes. An `IApiClient` literal is checked by the
 *   compiler instead: drop a method from the real client and every fake fails to
 *   type-check.
 * - **The implementation can be swapped** without touching a feature — the retry/transport
 *   rework in the `sdk-structure` skill §6, or a recording client for E2E.
 *
 * Nothing outside `src/client.ts` constructs a client any more: every call site either
 * receives one as a constructor argument (`OrderManager`, `NextCommerceAutocomplete`, the
 * accept-upsell context) or asks the composition root for the shared one with
 * `getApiClient()`. Type the field `IApiClient`, never `ApiClient`.
 *
 * **Why the domain methods and not `get`/`post`.** The skill sketches `IHttpClient` as a
 * transport facade over `fetch`. That is the right shape for the *inside* of the client —
 * auth, retries and error conversion written once, which `ApiClient.request` already does —
 * but it is the wrong shape for a feature to depend on: `http.post('/api/v1/orders/')`
 * would move endpoint paths and payload shapes out of `src/api/` and scatter them across
 * features. So the seam features see is this typed endpoint list, and the transport stays
 * an implementation detail.
 *
 * @see {@link ApiClient} — the one implementation.
 */

import type {
  AddUpsellLine,
  Campaign,
  Cart,
  CartBase,
  CartCalculateSummary,
  CartSummary,
  CreateOrder,
  Order,
} from '@/types/api';

/**
 * Every call the SDK makes against the campaigns API.
 *
 * Signatures mirror {@link ApiClient}, including the `any`s on the prospect-cart and
 * autocomplete calls — this interface documents the surface as it is, so adopting it
 * changed no types at any call site. Tightening those `any`s is worth doing, but as its
 * own change where the fallout is visible.
 *
 * One deliberate exception: `setApiKey` is public on the class but absent here, because
 * mutating the key of a page-wide shared client is not something a feature may do. The
 * surface gate knows about that one omission by name and fails on any other.
 *
 * @example
 * ```ts
 * // A fake in a test — the compiler checks it against the real surface.
 * const api: Pick<IApiClient, 'createCart'> = {
 *   createCart: async () => ({ ref_id: 'test-cart' }) as Cart,
 * };
 * await api.createCart({ lines: [], attribution: {} } as CartBase);
 * ```
 */
export interface IApiClient {
  // ── Campaign ──────────────────────────────────────────────────────────────
  /** The campaign, its packages and prices, optionally in a specific currency. */
  getCampaigns(currency?: string): Promise<Campaign>;

  // ── Cart ──────────────────────────────────────────────────────────────────
  /** Creates a server-side cart. Used for prospect carts and express checkout. */
  createCart(data: CartBase & { currency?: string }): Promise<Cart>;
  /**
   * Prices a set of lines without creating a cart — the totals shown before checkout.
   *
   * @param signal Aborts a request the shopper has already superseded; the client
   *   logs an aborted request at `debug` rather than `error`.
   * @param options `upsell: true` prices the lines as a post-purchase offer.
   */
  calculateSummary(
    data: CartCalculateSummary,
    signal?: AbortSignal,
    options?: { upsell?: boolean }
  ): Promise<CartSummary>;

  // ── Order ─────────────────────────────────────────────────────────────────
  /** Submits the order. The money path — see the checkout feature's guide. */
  createOrder(data: CreateOrder & { currency?: string }): Promise<Order>;
  /** Re-reads an order by its `ref_id`, e.g. on an upsell or confirmation page. */
  getOrder(refId: string): Promise<Order>;
  /** Adds an accepted post-purchase offer to an existing order. */
  addUpsell(refId: string, data: AddUpsellLine): Promise<Order>;

  // ── Prospect cart ─────────────────────────────────────────────────────────
  /** Records a cart for a shopper who has given an email but not yet ordered. */
  createProspectCart(data: any): Promise<any>;
  updateProspectCart(cartId: string, data: any): Promise<any>;
  getProspectCart(cartId: string): Promise<any>;
  /** Marks the prospect cart abandoned — the signal a recovery campaign acts on. */
  abandonProspectCart(cartId: string): Promise<any>;
  /** Marks it converted, so recovery does not chase a shopper who already bought. */
  convertProspectCart(cartId: string): Promise<any>;

  // ── Addresses ─────────────────────────────────────────────────────────────
  /**
   * Address suggestions for the checkout form, from the SDK's own provider.
   *
   * @param signal Aborts the previous suggestion request as the shopper keeps typing.
   */
  getAddressesAutocomplete(
    query_text: string,
    country?: string,
    language?: string,
    signal?: AbortSignal
  ): Promise<any>;

  // ── Credentials ───────────────────────────────────────────────────────────
  /**
   * The key this client authenticates with.
   *
   * Read-only on purpose. `ApiClient.setApiKey` exists and is public, but it is **not**
   * on this seam: the client is shared page-wide, so re-keying it changes the credentials
   * of every holder at once — including holders that cached the instance and will never
   * ask again. Changing the key is `src/client.ts`'s job; call `getApiClient(newKey)` and
   * let it build a client for that key.
   */
  getApiKey(): string;
}
