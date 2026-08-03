import { AttributeDoc } from '../schema/feature-manifest';
export type MetaTagStatus = 'active' | 'legacy' | 'inert';
export interface MetaTagDoc extends AttributeDoc {
    owner: string;
    group: string;
    status: MetaTagStatus;
    supersededBy?: string;
    example: string;
    writtenBySdk?: boolean;
}
export declare const META_TAG_GROUPS: readonly ["Booting the SDK", "Debugging", "Where the page goes next", "Attribution", "Analytics"];
export declare const META_TAGS: MetaTagDoc[];
//# sourceMappingURL=meta-tags.d.ts.map