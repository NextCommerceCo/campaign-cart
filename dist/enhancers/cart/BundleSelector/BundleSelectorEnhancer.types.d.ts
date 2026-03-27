import { EventMap } from '../../../types/global';
import { SummaryLine } from '../../../types/api';
import { Logger } from '../../../utils/logger';
export interface ClassNames {
    bundleCard: string;
    selected: string;
    inCart: string;
    variantSelected: string;
    variantUnavailable: string;
    bundleSlot: string;
    slotVariantGroup: string;
}
export interface BundleItem {
    packageId: number;
    quantity: number;
    configurable?: boolean;
    noSlot?: boolean;
}
export interface BundleDef {
    id: string;
    items: BundleItem[];
    vouchers?: string[];
    [key: string]: unknown;
}
export interface BundleSlot {
    slotIndex: number;
    unitIndex: number;
    originalPackageId: number;
    activePackageId: number;
    quantity: number;
    noSlot?: boolean;
}
export interface BundleCard {
    element: HTMLElement;
    bundleId: string;
    items: BundleItem[];
    slots: BundleSlot[];
    isPreSelected: boolean;
    vouchers: string[];
}
export interface RenderContext {
    slotTemplate: string;
    variantOptionTemplate: string;
    variantSelectorTemplate: string;
    selectHandlers: Map<HTMLSelectElement, EventListener>;
    previewLines: Map<string, SummaryLine[]>;
    logger: Logger;
    classNames: ClassNames;
    onSelectChange: (select: HTMLSelectElement, bundleId: string, slotIndex: number) => Promise<void>;
}
export interface HandlerContext {
    mode: 'swap' | 'select';
    logger: Logger;
    classNames: ClassNames;
    isApplyingRef: {
        value: boolean;
    };
    externalSlotsEl: HTMLElement | null;
    selectCard: (card: BundleCard) => void;
    getEffectiveItems: (card: BundleCard) => BundleItem[];
    fetchAndUpdateBundlePrice: (card: BundleCard) => Promise<void>;
    renderSlotsForCard: (card: BundleCard) => void;
    emit: <K extends 'bundle:selected' | 'bundle:selection-changed'>(event: K, detail: EventMap[K]) => void;
}
export interface PriceContext {
    includeShipping: boolean;
    previewLines: Map<string, SummaryLine[]>;
    cards: BundleCard[];
    logger: Logger;
    slotTemplate: string;
    renderSlotsForCard: (card: BundleCard) => void;
    getEffectiveItems: (card: BundleCard) => BundleItem[];
}
//# sourceMappingURL=BundleSelectorEnhancer.types.d.ts.map