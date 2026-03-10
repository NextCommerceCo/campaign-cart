/**
 * Cart Offer List Enhancer
 * Renders offer options and applies them to the cart when selected.
 *
 * Container attributes:
 *   data-next-offer-list                  — marks the container
 *   data-next-offer-template-id           — ID of element whose innerHTML is the offer card template
 *   data-next-offer-template              — inline template string (alternative to template-id)
 *   data-next-offer-replace-cart          — "true" (default) | "false": clear cart before applying
 *   data-next-offer-filter                — JSON filter to narrow which offers are rendered.
 *                                           Supports dot-notation keys and exact-match values.
 *                                           Examples:
 *                                             '{"type":"voucher"}'
 *                                             '{"condition.type":"count"}'
 *                                             '{"benefit.type":"package_percentage","type":"offer"}'
 *
 * Manual offer card attributes (inside the container):
 *   data-next-offer-card                  — marks an offer card element
 *   data-next-offer-id="<ref_id>"         — offer ref_id this card represents
 *   data-next-offer-package-id="<id>"     — default package_id to add
 *                                           (falls back to first package in the offer)
 *
 * Template variables (when using auto-render mode):
 *   {offer.name}                          — offer name
 *   {offer.ref_id}                        — offer ref_id
 *   {offer.condition.description}         — condition description
 *   {offer.condition.type}                — "any" | "count"
 *   {offer.condition.value}               — count threshold
 *   {offer.benefit.description}           — benefit description
 *   {offer.benefit.type}                  — benefit type
 *   {offer.benefit.value}                 — benefit value (e.g. "20" for 20%)
 *   {offer.package.id}                    — first eligible package_id
 *   {offer.package.name}                  — first eligible package name
 *   {offer.package.productName}           — product name
 *   {offer.package.variantName}           — variant name
 *   {offer.package.price}                 — discounted price string
 *   {offer.package.priceBeforeDiscount}   — original price string
 *   {offer.package.unitPrice}             — discounted per-unit price
 *   {offer.package.unitPriceBeforeDiscount} — original per-unit price
 *   {offer.package.qty}                   — units per package
 *   {offer.package.image}                 — package image URL
 *
 * The template must include these attributes on the root card element for registration:
 *   data-next-offer-card
 *   data-next-offer-id="{offer.ref_id}"
 *   data-next-offer-package-id="{offer.package.id}"
 *
 * Behavior on selection:
 *   - condition.type "any"    → adds default package with qty 1
 *   - condition.type "count"  → adds default package with qty = condition.value
 *
 * To allow per-item variant configuration after the offer is applied, use
 * CartItemSlotsEnhancer (data-next-cart-slots) in your cart view.
 */

import { BaseEnhancer } from '@/enhancers/base/BaseEnhancer';
import { useCartStore } from '@/stores/cartStore';
import { useCampaignStore } from '@/stores/campaignStore';
import type { Offer } from '@/types/campaign';

interface OfferCard {
  element: HTMLElement;
  offerId: number;
  defaultPackageId: number;
  offer: Offer;
}

export class CartOfferListEnhancer extends BaseEnhancer {
  private template?: string;
  private replaceCart: boolean = true;
  private filterCriteria: Record<string, string> = {};
  private cards: OfferCard[] = [];
  private selectedCard: OfferCard | null = null;
  private clickHandlers = new Map<HTMLElement, (e: Event) => void>();

  public async initialize(): Promise<void> {
    this.validateElement();

    this.replaceCart = this.getAttribute('data-next-offer-replace-cart') !== 'false';

    const filterAttr = this.getAttribute('data-next-offer-filter');
    if (filterAttr) {
      try {
        this.filterCriteria = JSON.parse(filterAttr);
      } catch {
        this.logger.warn('Invalid JSON in data-next-offer-filter, ignoring filter', filterAttr);
      }
    }

    const templateId = this.getAttribute('data-next-offer-template-id');
    if (templateId) {
      const el = document.getElementById(templateId);
      this.template = el?.innerHTML.trim() || undefined;
    } else {
      const inline = this.getAttribute('data-next-offer-template');
      if (inline) this.template = inline;
    }

    const campaignState = useCampaignStore.getState();
    if (campaignState.data) {
      this.render(campaignState.data.offers || []);
    } else {
      const unsubscribe = useCampaignStore.subscribe((state) => {
        if (state.data) {
          unsubscribe();
          this.render(state.data.offers || []);
        }
      });
    }

    this.logger.debug('CartOfferListEnhancer initialized');
  }

  // ─── Rendering ─────────────────────────────────────────────────────────────

  private render(offers: Offer[]): void {
    const filtered = this.applyFilter(offers);
    if (this.template && filtered.length > 0) {
      this.element.innerHTML = filtered.map(o => this.renderTemplate(o)).join('');
    }
    this.scanCards();
  }

  private applyFilter(offers: Offer[]): Offer[] {
    const entries = Object.entries(this.filterCriteria);
    if (entries.length === 0) return offers;
    return offers.filter(offer =>
      entries.every(([key, value]) => {
        const actual = key.split('.').reduce<unknown>((obj, k) => (obj && typeof obj === 'object' ? (obj as Record<string, unknown>)[k] : undefined), offer);
        return String(actual) === String(value);
      })
    );
  }

  private renderTemplate(offer: Offer): string {
    const pkg = offer.packages[0];
    const vars: Record<string, string> = {
      'offer.name': offer.name,
      'offer.ref_id': String(offer.ref_id),
      'offer.type': offer.type,
      'offer.condition.description': offer.condition.description,
      'offer.condition.type': offer.condition.type,
      'offer.condition.value': String(offer.condition.value),
      'offer.benefit.description': offer.benefit.description,
      'offer.benefit.type': offer.benefit.type,
      'offer.benefit.value': offer.benefit.value,
      'offer.package.id': pkg ? String(pkg.package_id) : '',
      'offer.package.name': pkg?.package_name || '',
      'offer.package.productName': pkg?.product_name || '',
      'offer.package.variantName': pkg?.product_variant_name || '',
      'offer.package.price': pkg?.package_price || '',
      'offer.package.priceBeforeDiscount': pkg?.package_price_before_discount || '',
      'offer.package.unitPrice': pkg?.unit_price || '',
      'offer.package.unitPriceBeforeDiscount': pkg?.unit_price_before_discount || '',
      'offer.package.qty': pkg ? String(pkg.package_unit_qty) : '',
      'offer.package.image': pkg?.package_image || '',
    };
    return this.template!.replace(/\{([^}]+)\}/g, (_, key) => vars[key] ?? '');
  }

  // ─── Card registration ──────────────────────────────────────────────────────

  private scanCards(): void {
    this.element.querySelectorAll<HTMLElement>('[data-next-offer-card]').forEach(el => {
      if (!this.cards.find(c => c.element === el)) {
        this.registerCard(el);
      }
    });
  }

  private registerCard(el: HTMLElement): void {
    const offerIdAttr = el.getAttribute('data-next-offer-id');
    if (!offerIdAttr) {
      this.logger.warn('Offer card missing data-next-offer-id', el);
      return;
    }
    const offerId = parseInt(offerIdAttr, 10);
    const offer = useCampaignStore.getState().data?.offers?.find(o => o.ref_id === offerId);
    if (!offer) {
      this.logger.warn(`Offer ${offerId} not found in campaign data`);
      return;
    }

    const defaultPkgAttr = el.getAttribute('data-next-offer-package-id');
    const defaultPackageId = defaultPkgAttr
      ? parseInt(defaultPkgAttr, 10)
      : (offer.packages[0]?.package_id ?? 0);

    const card: OfferCard = { element: el, offerId, defaultPackageId, offer };
    this.cards.push(card);
    el.classList.add('next-offer-card');

    const handler = (e: Event) => this.handleCardClick(e, card);
    this.clickHandlers.set(el, handler);
    el.addEventListener('click', handler);

    this.logger.debug(`Registered offer card: offer ${offerId}, defaultPackage ${defaultPackageId}`);
  }

  // ─── Selection & apply ──────────────────────────────────────────────────────

  private handleCardClick(e: Event, card: OfferCard): void {
    e.preventDefault();
    if (this.selectedCard === card) return;
    this.selectCard(card);
  }

  private selectCard(card: OfferCard): void {
    this.cards.forEach(c => {
      c.element.classList.remove('next-selected');
      c.element.setAttribute('data-next-selected', 'false');
    });

    this.selectedCard = card;
    card.element.classList.add('next-selected');
    card.element.setAttribute('data-next-selected', 'true');

    this.emit('offer:selected', { offerId: card.offerId });
    this.applyOffer(card);
  }

  private async applyOffer(card: OfferCard): Promise<void> {
    const cartStore = useCartStore.getState();
    const offer = card.offer;

    if (!card.defaultPackageId) {
      this.logger.warn(`No package ID for offer ${offer.ref_id}`);
      return;
    }

    try {
      if (this.replaceCart) {
        await cartStore.clear();
      }

      const qty = offer.condition.type === 'count' ? offer.condition.value : 1;

      await cartStore.addItem({
        packageId: card.defaultPackageId,
        quantity: qty,
        isUpsell: false,
      });

      card.element.classList.add('next-in-cart');
      this.emit('offer:applied', { offerId: card.offerId });
      this.logger.debug(`Applied offer ${card.offerId}: package ${card.defaultPackageId} x${qty}`);
    } catch (error) {
      this.handleError(error, 'applyOffer');
    }
  }

  // ─── BaseEnhancer ───────────────────────────────────────────────────────────

  public update(): void {}

  protected override cleanupEventListeners(): void {
    this.clickHandlers.forEach((h, el) => el.removeEventListener('click', h));
    this.clickHandlers.clear();
  }

  public override destroy(): void {
    this.cleanupEventListeners();
    this.cards.forEach(c =>
      c.element.classList.remove('next-offer-card', 'next-selected', 'next-in-cart')
    );
    this.cards = [];
    super.destroy();
  }
}
