import { Logger } from '../../../utils/logger';
import { SummaryLine } from '../../../types/api';
import { PackageDef, ToggleCard, TogglePackageState } from './PackageToggleEnhancer.types';
export declare function buildToggleVars(def: PackageDef, pkgState: TogglePackageState): Record<string, string>;
export declare function renderToggleTemplate(template: string, def: PackageDef, logger: Logger): HTMLElement | null;
export declare function renderToggleImage(card: ToggleCard): void;
export declare function updateCardDisplayElements(card: ToggleCard): void;
export declare function renderTogglePrice(card: ToggleCard, line: SummaryLine): void;
//# sourceMappingURL=PackageToggleEnhancer.renderer.d.ts.map