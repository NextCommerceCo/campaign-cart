export interface ContractUsage {
    name: string;
    sites: Array<{
        where: string;
        consumer: string;
        access?: string;
    }>;
}
export declare function renderMetaTags(extracted: ContractUsage[]): string;
export declare function renderUrlParameters(extracted: ContractUsage[]): string;
//# sourceMappingURL=render-core-contracts.d.ts.map