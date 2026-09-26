import { RulesField } from '../../../core/country-service';
export interface AddressRenderContext {
    form: 'shipping' | 'billing';
    values?: Record<string, string>;
    alreadyCollected?: ReadonlySet<string>;
}
export declare function sdkFieldName(name: string, form: 'shipping' | 'billing'): string | null;
export declare function renderLayout(container: HTMLElement, layout: readonly string[][], fields: Readonly<Record<string, RulesField | undefined>>, ctx: AddressRenderContext): string[];
export declare function readRenderedValues(container: HTMLElement): Record<string, string>;
//# sourceMappingURL=address-form.renderer.d.ts.map