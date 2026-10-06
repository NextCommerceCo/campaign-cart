import { PostcodeResult } from '../../../core/i18n-rules';
export interface PostcodeStateContext {
    readPostcode: (postcode: string, country: string, state?: string) => Promise<PostcodeResult | undefined>;
    getField: (name: string) => HTMLElement | undefined;
    passesPattern: (postcode: string, country: string) => boolean;
    showError: (name: string, message: string) => void;
    clearError: (name: string) => void;
}
export declare function affectsPostcodeState(fieldName: string): boolean;
export declare function checkPostcodeState(ctx: PostcodeStateContext, fieldName: string): Promise<void>;
//# sourceMappingURL=postcode-state-check.d.ts.map