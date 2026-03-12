import { AutocompleteContext } from '../types';
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
//# sourceMappingURL=GoogleMapsAutocomplete.d.ts.map