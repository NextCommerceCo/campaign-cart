import { AutocompleteContext } from '../checkout.types';
declare global {
    interface Window {
        google: any;
    }
}
export declare class GoogleMapsAutocomplete {
    private ctx;
    private googleMapsLoaded;
    private googleMapsLoading;
    private googleMapsLoadPromise;
    private autocompleteInstances;
    private countryListenersAttached;
    constructor(ctx: AutocompleteContext);
    setup(): Promise<void>;
    destroy(): void;
    private loadGoogleMapsAPI;
    private loadScript;
    private isPlacesAvailable;
    private createInstances;
    private createInstance;
    private setupCountryChangeListeners;
    private fillAddress;
    private formatAddressLine1;
    private extractCity;
    private parseAddressComponents;
    private setStateWithRetry;
}
//# sourceMappingURL=google-maps-autocomplete.d.ts.map