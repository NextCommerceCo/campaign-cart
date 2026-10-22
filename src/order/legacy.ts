/** @deprecated `accept` / `decline`. Use `data-next-upsell-action="add"` / `"skip"`. */
export const ACCEPT_WORDS = ['add', 'accept'];

/** @deprecated `data-next-next-url` / `data-os-next-url`. Use `data-next-url`. */
export const NEXT_URL_ATTRS = ['data-next-url', 'data-next-next-url', 'data-os-next-url'];

/** @deprecated `data-next-bundle-selector-id` on `[data-next-upsell]`. Put the `[data-next-bundle-selector]` inside the offer. */
export const legacyOfferSelector = (offer: Element) => offer.getAttribute('data-next-bundle-selector-id') ?? undefined;
