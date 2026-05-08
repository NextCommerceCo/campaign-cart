import { ApiClient } from '../../../api/client';
import { AutocompleteContext } from '../types';
export declare class NextCommerceAutocomplete {
    private ctx;
    private apiClient;
    constructor(ctx: AutocompleteContext, apiClient: ApiClient);
    setup(): void;
    private createInstance;
    private buildItem;
    private buildHighlightedLabel;
    private fillAddress;
    private setStateWithRetry;
}
//# sourceMappingURL=NextCommerceAutocomplete.d.ts.map