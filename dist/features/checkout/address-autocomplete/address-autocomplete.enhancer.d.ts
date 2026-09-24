import { IApiClient } from '../../../api/client.types';
export interface AddressAutocompleteOptions {
    enableGoogleMaps: boolean;
    enableNextCommerce: boolean;
}
export declare class AddressAutocompleteEnhancer {
    private ctx;
    private apiClient;
    private googleMaps?;
    private nextCommerce?;
    private listenerAbort;
    private enabled;
    private loaded;
    constructor(deps: {
        fields: Map<string, HTMLElement>;
        billingFields: Map<string, HTMLElement>;
        apiClient: IApiClient;
        getDetectedCountryCode: () => string;
        getHasTrackedShippingInfo: () => boolean;
        setHasTrackedShippingInfo: (value: boolean) => void;
    });
    initialize(options: AddressAutocompleteOptions): Promise<void>;
    rebind(): Promise<void>;
    destroy(): void;
    private setupLazyLoading;
}
//# sourceMappingURL=address-autocomplete.enhancer.d.ts.map