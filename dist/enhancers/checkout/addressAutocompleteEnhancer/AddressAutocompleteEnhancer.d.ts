import { ApiClient } from '../../../api/client';
export interface AddressAutocompleteOptions {
    enableGoogleMaps: boolean;
    enableNextCommerce: boolean;
}
export declare class AddressAutocompleteEnhancer {
    private ctx;
    private apiClient;
    private googleMaps?;
    private nextCommerce?;
    constructor(deps: {
        fields: Map<string, HTMLElement>;
        billingFields: Map<string, HTMLElement>;
        apiClient: ApiClient;
        getDetectedCountryCode: () => string;
        getHasTrackedShippingInfo: () => boolean;
        setHasTrackedShippingInfo: (value: boolean) => void;
    });
    initialize(options: AddressAutocompleteOptions): Promise<void>;
    destroy(): void;
    private setupLazyLoading;
}
//# sourceMappingURL=AddressAutocompleteEnhancer.d.ts.map