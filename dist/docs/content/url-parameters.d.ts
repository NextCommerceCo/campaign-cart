import { AttributeDoc } from '../schema/feature-manifest';
export type ParamDirection = 'read' | 'read+written' | 'written';
export interface UrlParameterDoc extends AttributeDoc {
    owner: string;
    group: string;
    direction: ParamDirection;
    productionHazard?: boolean;
    sticky?: boolean;
    example: string;
}
export declare const URL_PARAMETER_GROUPS: readonly ["Currency and country", "Debugging", "Test orders", "Resetting a session", "Forcing a page into a state", "Loading an order", "Analytics", "Attribution", "Written by the SDK"];
export declare const URL_PARAMETERS: UrlParameterDoc[];
//# sourceMappingURL=url-parameters.d.ts.map