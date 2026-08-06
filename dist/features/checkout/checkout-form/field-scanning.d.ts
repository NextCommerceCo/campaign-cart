import { Logger } from '../../../core/logger';
import { ExpirationFieldsContext } from './expiration-fields';
export type SubmitControl = HTMLButtonElement | HTMLInputElement;
export interface FieldScanContext {
    form: HTMLFormElement;
    fields: Map<string, HTMLElement>;
    paymentButtons: Map<string, HTMLElement>;
    logger: Logger;
    expirationFields: ExpirationFieldsContext;
}
export interface FieldLookupContext {
    fields: Map<string, HTMLElement>;
    billingFields: Map<string, HTMLElement>;
}
export declare function scanAllFields(ctx: FieldScanContext): SubmitControl | undefined;
export declare function getFieldNameFromElement(element: HTMLElement): string | null;
export declare function getFieldByName(ctx: FieldLookupContext, fieldName: string): HTMLElement | null;
//# sourceMappingURL=field-scanning.d.ts.map