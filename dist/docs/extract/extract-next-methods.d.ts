export type MemberKind = 'method' | 'getter' | 'property';
export interface ExtractedMember {
    name: string;
    kind: MemberKind;
    isStatic: boolean;
    signature: string;
    hasSummary: boolean;
    category?: string;
    hasExample: boolean;
    deprecated: boolean;
    symbol: string;
}
export interface ExtractedGlobal {
    name: string;
    keys: string[];
    sites: string[];
}
export interface ExtractedGlobalRead {
    name: string;
    sites: string[];
}
export interface ExtractedWindowSurface {
    installs: ExtractedGlobal[];
    reads: ExtractedGlobalRead[];
}
export declare function extractPublicMembers(file: string, className: string): ExtractedMember[];
export declare function extractInterfaceCallables(file: string, interfaceName: string): Array<{
    name: string;
    signature: string;
}>;
export declare function extractWindowSurface(srcRoot: string, roots?: string[]): ExtractedWindowSurface;
//# sourceMappingURL=extract-next-methods.d.ts.map