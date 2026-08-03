import { BundleCard, BundlePackageState, BundleSlot, RenderContext } from './bundle-selector.types';
export declare function buildSlotVars(slot: BundleSlot, pkgState: BundlePackageState): Record<string, string>;
export declare function renderSlotsForCard(card: BundleCard, ctx: RenderContext, targetEl?: HTMLElement): void;
export declare function renderExternalSlotsForCard(card: BundleCard, renderCtx: RenderContext, externalSlotsEl: HTMLElement | null, slotTemplate: string): void;
//# sourceMappingURL=bundle-selector.slot-renderer.d.ts.map