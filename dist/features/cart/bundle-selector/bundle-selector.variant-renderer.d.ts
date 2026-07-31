import { Package } from '../../../types/campaign';
import { RenderContext } from './bundle-selector.types';
export declare function renderVariantSelectors(container: HTMLElement, bundleId: string, slotIndex: number, currentPkg: Package, allPackages: Package[], ctx: RenderContext): void;
export declare function isVariantValueAvailable(value: string, code: string, productPkgs: Package[], allSelectedAttrs: Record<string, string>): boolean;
//# sourceMappingURL=bundle-selector.variant-renderer.d.ts.map