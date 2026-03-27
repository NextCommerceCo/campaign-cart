import { BundleCard, HandlerContext } from './BundleSelectorEnhancer.types';
export declare function handleCardClick(e: Event, card: BundleCard, previousCard: BundleCard | null, ctx: HandlerContext): Promise<void>;
export declare function applyBundle(previous: BundleCard | null, selected: BundleCard, ctx: HandlerContext): Promise<void>;
export declare function applyEffectiveChange(card: BundleCard, ctx: HandlerContext): Promise<void>;
export declare function applyVoucherSwap(previous: BundleCard | null, next: BundleCard): Promise<void>;
export declare function applyVariantChange(card: BundleCard, slotIndex: number, selectedAttrs: Record<string, string>, ctx: HandlerContext): Promise<void>;
export declare function handleVariantOptionClick(e: Event, cards: BundleCard[], ctx: HandlerContext): void;
export declare function handleSelectVariantChange(_select: HTMLSelectElement, bundleId: string, slotIndex: number, cards: BundleCard[], ctx: HandlerContext): Promise<void>;
//# sourceMappingURL=BundleSelectorEnhancer.handlers.d.ts.map