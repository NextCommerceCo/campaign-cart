import { UpsellBundleItem } from './upsell.types';
export declare function resolveExternalSelection(packageSelectorId: string | undefined): number | undefined;
export declare function resolveExternalBundleItems(bundleSelectorId: string | undefined): UpsellBundleItem[] | null;
export declare function resolveExternalBundleVouchers(bundleSelectorId: string | undefined): string[];
export declare function collectDefaultProperties(): Record<string, string>;
export declare function collectContainerProperties(element: HTMLElement): Record<string, string>;
export declare function resolveProperties(element: HTMLElement): Record<string, string> | undefined;
//# sourceMappingURL=upsell.properties.d.ts.map