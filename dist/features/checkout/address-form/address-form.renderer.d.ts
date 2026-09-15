import { AddressSpec } from './address-form.api';
export interface AddressRenderContext {
    form: 'shipping' | 'billing';
    values?: Record<string, string>;
    alreadyCollected?: ReadonlySet<string>;
}
export declare function sdkFieldName(name: string, form: 'shipping' | 'billing'): string | null;
export declare function renderAddressSpec(container: HTMLElement, spec: AddressSpec, ctx: AddressRenderContext): string[];
export declare function readRenderedValues(container: HTMLElement): Record<string, string>;
//# sourceMappingURL=address-form.renderer.d.ts.map