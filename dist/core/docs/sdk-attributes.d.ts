import { AttributeDoc } from './feature-manifest';
export interface SdkAttributeDoc extends AttributeDoc {
    owner: string;
    setBySdk?: boolean;
}
export declare const SDK_CLASSES: Array<{
    name: string;
    owner: string;
    description: string;
}>;
export declare const SDK_ATTRIBUTES: SdkAttributeDoc[];
//# sourceMappingURL=sdk-attributes.d.ts.map