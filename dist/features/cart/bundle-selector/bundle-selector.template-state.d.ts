import { Logger } from '../../../core/logger';
export declare function extractNestedSlotTemplate(cardTemplate: string): {
    card: string;
    slot: string;
};
export declare function extractNestedVariantTemplates(slotTemplate: string): {
    slot: string;
    variantSelector: string;
    variantOption: string;
};
export interface ResolvedBundleTemplates {
    template: string;
    slotTemplate: string;
    variantOptionTemplate: string;
    variantSelectorTemplate: string;
}
export declare function resolveBundleTemplates(element: HTMLElement, externalSlotsEl: HTMLElement | null, logger: Logger): ResolvedBundleTemplates;
//# sourceMappingURL=bundle-selector.template-state.d.ts.map