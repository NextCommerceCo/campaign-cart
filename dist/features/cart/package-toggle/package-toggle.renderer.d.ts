import { Logger } from '../../../core/logger';
import { SummaryLine } from '../../../types/api';
import { PackageDef, ToggleCard } from './package-toggle.types';
export declare function buildToggleVars(def: PackageDef, card: Omit<ToggleCard, 'element' | 'isPreSelected' | 'isSyncMode' | 'syncPackageIds' | 'syncProductIds' | 'isUpsell' | 'stateContainer' | 'addText' | 'removeText' | 'discounts'>): Record<string, string>;
export declare function renderToggleTemplate(template: string, def: PackageDef, logger: Logger): HTMLElement | null;
export declare function renderToggleImage(card: ToggleCard): void;
export declare function updateCardDisplayElements(card: ToggleCard): void;
export declare function renderTogglePrice(card: ToggleCard, line: SummaryLine): void;
//# sourceMappingURL=package-toggle.renderer.d.ts.map