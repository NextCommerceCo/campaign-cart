import { Logger } from '../../../core/logger';
import { BundleCard, BundleDef, BundlePriceSummary, RenderContext } from './bundle-selector.types';
export { buildSlotVars } from './bundle-selector.slot-renderer';
export { isVariantValueAvailable } from './bundle-selector.variant-renderer';
export declare function renderBundleTemplate(template: string, bundle: BundleDef, logger: Logger): HTMLElement | null;
export declare function updateCardDisplayElements(card: BundleCard, bundlePrice: BundlePriceSummary): void;
export declare function autoRenderBundleCards(element: HTMLElement, bundlesAttr: string, template: string, logger: Logger): void;
export declare function relenderVariables(card: BundleCard, slotTemplate: string, renderCtx: RenderContext, externalSlotsEl: HTMLElement | null, selectedCard: BundleCard | null, selectorId: string | null): void;
//# sourceMappingURL=bundle-selector.renderer.d.ts.map