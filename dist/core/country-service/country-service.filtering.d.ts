import { Logger } from '../logger';
import { AddressConfig } from '../../types/global';
import { LocationData, State } from '.';
export interface FilterCtx {
    campaignShippingCountries: string[] | null;
    config: AddressConfig;
    logger: Logger;
}
export declare function applyCountryFiltering(ctx: FilterCtx, data: LocationData): Promise<LocationData>;
export declare function applyStateFiltering(config: AddressConfig, states: State[]): State[];
//# sourceMappingURL=country-service.filtering.d.ts.map