import { Logger } from '../../../core/logger';
import { Package } from '../../../types/campaign';
import { BundleCard, BundleItem, BundlePackageState, ClassNames } from './bundle-selector.types';
export { extractNestedSlotTemplate, extractNestedVariantTemplates, resolveBundleTemplates, } from './bundle-selector.template-state';
export type { ResolvedBundleTemplates } from './bundle-selector.template-state';
export { parseForceBundleId, resolveForcedBundleId, pickDefaultCard, pickAndLogDefaultCard, } from './bundle-selector.selection-state';
export type { ForceBundleSpec, DefaultCardChoice, } from './bundle-selector.selection-state';
export declare function makePackageState(pkg: Package): BundlePackageState;
export declare function getEffectiveItems(card: BundleCard): BundleItem[];
export declare function attachBundleAccessors(element: HTMLElement, getSelectedCard: () => BundleCard | null): void;
export declare function parseClassNames(element: HTMLElement): ClassNames;
export declare function parseVouchers(attr: string | null, logger: Logger): string[];
export declare function getBundleVouchers(cards: BundleCard[]): string[];
export declare function getAllKnownBundleVouchers(allCards: BundleCard[][]): Set<string>;
//# sourceMappingURL=bundle-selector.state.d.ts.map