import { Logger } from '../../../utils/logger';
import { Package } from '../../../types/campaign';
import { BundleCard, BundleItem, BundlePackageState } from './BundleSelectorEnhancer.types';
export declare function makePackageState(pkg: Package): BundlePackageState;
export declare function getEffectiveItems(card: BundleCard): BundleItem[];
export declare function parseVouchers(attr: string | null, logger: Logger): string[];
export declare function extractNestedSlotTemplate(cardTemplate: string): {
    card: string;
    slot: string;
};
export declare function extractNestedVariantTemplates(slotTemplate: string): {
    slot: string;
    variantSelector: string;
    variantOption: string;
};
export interface ForceBundleSpec {
    selectorId: string | null;
    bundleId: string;
}
export declare function parseForceBundleId(raw: string | null | undefined): ForceBundleSpec[];
export declare function resolveForcedBundleId(specs: ForceBundleSpec[], selectorId: string | null): string | null;
export interface DefaultCardChoice {
    card: BundleCard | null;
    fromForce: boolean;
    forcedMiss: string | null;
    usedFirstCardFallback: boolean;
}
export declare function pickDefaultCard(cards: BundleCard[], rawForceBundleId: string | null | undefined, selectorId: string | null): DefaultCardChoice;
//# sourceMappingURL=BundleSelectorEnhancer.state.d.ts.map