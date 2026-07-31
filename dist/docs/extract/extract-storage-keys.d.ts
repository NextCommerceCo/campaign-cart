export declare const STORAGE_AREAS: readonly ["sessionStorage", "localStorage"];
export type StorageArea = (typeof STORAGE_AREAS)[number];
export type KeySource = 'constant' | 'persist' | 'call';
export interface ExtractedStorageKey {
    key: string;
    pattern: string;
    dynamic: boolean;
    areas: StorageArea[];
    sources: KeySource[];
    where: string[];
}
export declare function extractStorageKeys(files: Array<[string, string]>): ExtractedStorageKey[];
export declare function toPattern(key: string): string;
//# sourceMappingURL=extract-storage-keys.d.ts.map