export interface DisplayPath {
    name: string;
    format: string;
    negated: boolean;
}
export declare function findPropertyMappings(candidates: string[]): string;
export declare function extractDisplayPaths(displayTypesPath: string): Record<string, DisplayPath[]>;
//# sourceMappingURL=extract-display-paths.d.ts.map