import { Logger } from '../../../core/logger';
import { SelectorItem } from '../../../types/global';
import { LoadPackageDataResult } from './selection-display.types';
export declare function findSelectorIdFromContext(startElement: HTMLElement | null): string | undefined;
export declare function findAssociatedSelector(selectorId: string | undefined, logger: Logger): SelectorItem | null | undefined;
export declare function needsCartData(property: string | undefined): boolean;
export declare function loadPackageData(selectedItem: SelectorItem | null, campaignState: any, logger: Logger): LoadPackageDataResult;
//# sourceMappingURL=selection-display.handlers.d.ts.map