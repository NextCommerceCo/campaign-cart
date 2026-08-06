export declare function parseExcludeProperty(attr: string | null | undefined): Set<string> | 'all' | undefined;
export declare function applyPropertyExclusion(properties: Record<string, string> | undefined, exclude: Set<string> | 'all' | undefined): Record<string, string> | undefined;
export declare function collectDefaultProperties(): Record<string, string>;
export declare function mergeWithDefaults(itemProperties: Record<string, string> | undefined): Record<string, string> | undefined;
export declare function attachPropertyListeners(containerEl: HTMLElement, properties: Record<string, string>, signal: AbortSignal, onBlur?: () => void): void;
//# sourceMappingURL=properties.d.ts.map