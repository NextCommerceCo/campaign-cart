export type Resolution = 'literal' | 'helper argument' | 'local variable';
export type ParamAccess = 'get' | 'has' | 'getAll' | 'set' | 'append' | 'delete';
export interface ContractSite {
    where: string;
    consumer: string;
    resolution: Resolution;
    access?: ParamAccess;
}
export interface ExtractedContract {
    name: string;
    sites: ContractSite[];
}
export interface CoreContracts {
    metaTags: ExtractedContract[];
    urlParameters: ExtractedContract[];
}
export declare function isReadAccess(access: ParamAccess | undefined): boolean;
export declare function coreContractSources(): Array<[string, string]>;
export declare function extractCoreContracts(files: Array<[string, string]>): CoreContracts;
//# sourceMappingURL=extract-core-contracts.d.ts.map