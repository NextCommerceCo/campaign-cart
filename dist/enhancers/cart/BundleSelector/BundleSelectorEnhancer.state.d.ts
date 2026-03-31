import { Logger } from '../../../utils/logger';
import { Package } from '../../../types/campaign';
import { BundleCard, BundleItem, BundlePackageState } from './BundleSelectorEnhancer.types';
export declare function makePackageState(pkg: Package): BundlePackageState;
export declare function getEffectiveItems(card: BundleCard): BundleItem[];
export declare function parseVouchers(attr: string | null, logger: Logger): string[];
//# sourceMappingURL=BundleSelectorEnhancer.state.d.ts.map