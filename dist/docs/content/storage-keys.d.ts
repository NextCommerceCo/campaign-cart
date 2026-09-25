export type StorageArea = 'sessionStorage' | 'localStorage';
export type StoreId = 'attribution' | 'campaign' | 'cart' | 'checkout' | 'config' | 'order' | 'parameter';
export type StorageGroupId = 'cart' | 'campaign' | 'order' | 'checkout' | 'attribution' | 'preferences' | 'analytics' | 'reference-data' | 'page-behaviour' | 'debug' | 'unused';
export interface StorageGroup {
    id: StorageGroupId;
    title: string;
    intro: string;
}
export declare const STORAGE_GROUPS: StorageGroup[];
export interface StorageMigration {
    since: string;
    legacyKey: string;
    releaseEvidence: {
        commit: string;
        tag: string;
        previousTag: string;
    };
}
export interface StorageReplacement {
    kind: 'public-store';
    export: string;
    guide: string;
}
export interface StorageKeyDoc {
    migration?: StorageMigration;
    replacement?: StorageReplacement;
    key: string;
    examples?: string[];
    group: StorageGroupId;
    ttl: string | null;
    ttlMechanism?: string;
    holds: string;
    clearing: string;
    store?: StoreId;
    storeRelation?: 'persist-key' | 'manual-cache' | 'side-write';
    notes?: string;
}
export declare const STORAGE_KEYS_DOC: StorageKeyDoc[];
export interface ExpiryMechanism {
    name: string;
    file: string;
    evidence: string;
    window: string;
    governs: string;
}
export declare const EXPIRY_MECHANISMS: ExpiryMechanism[];
export interface UnscannableStorageKeyDoc extends StorageKeyDoc {
    areas: StorageArea[];
    invisibleBecause: string;
    file: string;
    evidence: string;
}
export declare const UNSCANNABLE_STORAGE_KEYS: UnscannableStorageKeyDoc[];
//# sourceMappingURL=storage-keys.d.ts.map