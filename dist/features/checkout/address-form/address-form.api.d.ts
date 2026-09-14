export type AddressRole = string;
export interface AddressFieldSpec {
    name: string;
    label: string;
    required: boolean;
    autocomplete: AddressRole;
    control: 'text' | 'select' | 'tel';
    optionsSource?: 'states';
    placeholder?: string;
    hint?: string;
    example?: string;
    maxLength?: number;
    inputMode?: 'text' | 'numeric' | 'tel';
    autoCapitalize?: 'none' | 'words' | 'characters';
    span?: number;
}
export interface AddressSpec {
    country: string;
    layout: string[][];
    fields: Record<string, AddressFieldSpec | undefined>;
    fallback?: boolean;
}
export declare function fetchAddressSpec(countryCode: string, options?: {
    baseUrl?: string;
    lang?: string;
}): Promise<AddressSpec>;
//# sourceMappingURL=address-form.api.d.ts.map