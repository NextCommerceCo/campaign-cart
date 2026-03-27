import { Package } from '../../../types/campaign';
import { Logger } from '../../../utils/logger';
import { BundleCard, BundleDef, RenderContext } from './BundleSelectorEnhancer.types';
export declare function renderBundleTemplate(template: string, bundle: BundleDef, logger: Logger): HTMLElement | null;
export declare function renderSlotsForCard(card: BundleCard, ctx: RenderContext, targetEl?: HTMLElement): void;
export declare function renderVariantSelectors(container: HTMLElement, bundleId: string, slotIndex: number, currentPkg: Package, allPackages: Package[], ctx: RenderContext): void;
export declare function isVariantValueAvailable(value: string, code: string, productPkgs: Package[], allSelectedAttrs: Record<string, string>): boolean;
//# sourceMappingURL=BundleSelectorEnhancer.renderer.d.ts.map