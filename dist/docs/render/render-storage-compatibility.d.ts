import { StorageKeyDoc } from '../content/storage-keys';
import { ExtractedStorageKey } from '../extract/extract-storage-keys';
export declare function renderStorageCompatibility(input: {
    sdkVersion: string;
    extracted: ExtractedStorageKey[];
    docs: StorageKeyDoc[];
    provenanceInputs: Array<[string, string]>;
}): string;
//# sourceMappingURL=render-storage-compatibility.d.ts.map