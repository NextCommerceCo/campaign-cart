import { B as BaseEnhancer } from "./index-WbFNZle8.js";
import { u as useCartStore } from "./analytics-BuAKAb38.js";
import { u as useCampaignStore } from "./utils-CQa_9vcu.js";
class CartOfferListEnhancer extends BaseEnhancer {
  constructor() {
    super(...arguments);
    this.replaceCart = true;
    this.filterCriteria = {};
    this.cards = [];
    this.selectedCard = null;
    this.clickHandlers = /* @__PURE__ */ new Map();
  }
  async initialize() {
    this.validateElement();
    this.replaceCart = this.getAttribute("data-next-offer-replace-cart") !== "false";
    const filterAttr = this.getAttribute("data-next-offer-filter");
    if (filterAttr) {
      try {
        this.filterCriteria = JSON.parse(filterAttr);
      } catch {
        this.logger.warn("Invalid JSON in data-next-offer-filter, ignoring filter", filterAttr);
      }
    }
    const templateId = this.getAttribute("data-next-offer-template-id");
    if (templateId) {
      const el = document.getElementById(templateId);
      this.template = el?.innerHTML.trim() || void 0;
    } else {
      const inline = this.getAttribute("data-next-offer-template");
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
    this.logger.debug("CartOfferListEnhancer initialized");
  }
  // ─── Rendering ─────────────────────────────────────────────────────────────
  render(offers) {
    const filtered = this.applyFilter(offers);
    if (this.template && filtered.length > 0) {
      this.element.innerHTML = filtered.map((o) => this.renderTemplate(o)).join("");
    }
    this.scanCards();
  }
  applyFilter(offers) {
    const entries = Object.entries(this.filterCriteria);
    if (entries.length === 0) return offers;
    return offers.filter(
      (offer) => entries.every(([key, value]) => {
        const actual = key.split(".").reduce((obj, k) => obj && typeof obj === "object" ? obj[k] : void 0, offer);
        return String(actual) === String(value);
      })
    );
  }
  renderTemplate(offer) {
    const pkg = offer.packages[0];
    const vars = {
      "offer.name": offer.name,
      "offer.ref_id": String(offer.ref_id),
      "offer.type": offer.type,
      "offer.condition.description": offer.condition.description,
      "offer.condition.type": offer.condition.type,
      "offer.condition.value": String(offer.condition.value),
      "offer.benefit.description": offer.benefit.description,
      "offer.benefit.type": offer.benefit.type,
      "offer.benefit.value": offer.benefit.value,
      "offer.package.id": pkg ? String(pkg.package_id) : "",
      "offer.package.name": pkg?.package_name || "",
      "offer.package.productName": pkg?.product_name || "",
      "offer.package.variantName": pkg?.product_variant_name || "",
      "offer.package.price": pkg?.package_price || "",
      "offer.package.priceBeforeDiscount": pkg?.package_price_before_discount || "",
      "offer.package.unitPrice": pkg?.unit_price || "",
      "offer.package.unitPriceBeforeDiscount": pkg?.unit_price_before_discount || "",
      "offer.package.qty": pkg ? String(pkg.package_unit_qty) : "",
      "offer.package.image": pkg?.package_image || ""
    };
    return this.template.replace(/\{([^}]+)\}/g, (_, key) => vars[key] ?? "");
  }
  // ─── Card registration ──────────────────────────────────────────────────────
  scanCards() {
    this.element.querySelectorAll("[data-next-offer-card]").forEach((el) => {
      if (!this.cards.find((c) => c.element === el)) {
        this.registerCard(el);
      }
    });
  }
  registerCard(el) {
    const offerIdAttr = el.getAttribute("data-next-offer-id");
    if (!offerIdAttr) {
      this.logger.warn("Offer card missing data-next-offer-id", el);
      return;
    }
    const offerId = parseInt(offerIdAttr, 10);
    const offer = useCampaignStore.getState().data?.offers?.find((o) => o.ref_id === offerId);
    if (!offer) {
      this.logger.warn(`Offer ${offerId} not found in campaign data`);
      return;
    }
    const defaultPkgAttr = el.getAttribute("data-next-offer-package-id");
    const defaultPackageId = defaultPkgAttr ? parseInt(defaultPkgAttr, 10) : offer.packages[0]?.package_id ?? 0;
    const card = { element: el, offerId, defaultPackageId, offer };
    this.cards.push(card);
    el.classList.add("next-offer-card");
    const handler = (e) => this.handleCardClick(e, card);
    this.clickHandlers.set(el, handler);
    el.addEventListener("click", handler);
    this.logger.debug(`Registered offer card: offer ${offerId}, defaultPackage ${defaultPackageId}`);
  }
  // ─── Selection & apply ──────────────────────────────────────────────────────
  handleCardClick(e, card) {
    e.preventDefault();
    if (this.selectedCard === card) return;
    this.selectCard(card);
  }
  selectCard(card) {
    this.cards.forEach((c) => {
      c.element.classList.remove("next-selected");
      c.element.setAttribute("data-next-selected", "false");
    });
    this.selectedCard = card;
    card.element.classList.add("next-selected");
    card.element.setAttribute("data-next-selected", "true");
    this.emit("offer:selected", { offerId: card.offerId });
    this.applyOffer(card);
  }
  async applyOffer(card) {
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
      const qty = offer.condition.type === "count" ? offer.condition.value : 1;
      await cartStore.addItem({
        packageId: card.defaultPackageId,
        quantity: qty,
        isUpsell: false
      });
      card.element.classList.add("next-in-cart");
      this.emit("offer:applied", { offerId: card.offerId });
      this.logger.debug(`Applied offer ${card.offerId}: package ${card.defaultPackageId} x${qty}`);
    } catch (error) {
      this.handleError(error, "applyOffer");
    }
  }
  // ─── BaseEnhancer ───────────────────────────────────────────────────────────
  update() {
  }
  cleanupEventListeners() {
    this.clickHandlers.forEach((h, el) => el.removeEventListener("click", h));
    this.clickHandlers.clear();
  }
  destroy() {
    this.cleanupEventListeners();
    this.cards.forEach(
      (c) => c.element.classList.remove("next-offer-card", "next-selected", "next-in-cart")
    );
    this.cards = [];
    super.destroy();
  }
}
export {
  CartOfferListEnhancer
};
