import { ExpiryMechanism, StorageKeyDoc, UnscannableStorageKeyDoc } from './storage-keys';
export interface ExtractedKeyFacts {
    areas: string[];
    firstSite: string;
    siteCount: number;
}
export interface RenderStorageInput {
    docs: StorageKeyDoc[];
    unscannable: UnscannableStorageKeyDoc[];
    mechanisms: ExpiryMechanism[];
    facts: Map<string, ExtractedKeyFacts>;
}
export declare function renderStorageReference(input: RenderStorageInput): string;
//# sourceMappingURL=render-storage-reference.d.ts.map