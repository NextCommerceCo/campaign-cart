import { IApiClient } from '../../../api/client.types';
import { AutocompleteContext } from '../checkout.types';
export declare class NextCommerceAutocomplete {
    private ctx;
    private apiClient;
    private instances;
    constructor(ctx: AutocompleteContext, apiClient: IApiClient);
    setup(): void;
    destroy(): void;
}
//# sourceMappingURL=next-commerce-autocomplete.d.ts.map