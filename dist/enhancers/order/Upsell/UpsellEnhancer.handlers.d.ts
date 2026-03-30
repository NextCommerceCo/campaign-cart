import { UpsellHandlerContext } from './UpsellEnhancer.types';
export declare function checkIfUpsellAlreadyAccepted(packageId: number): boolean;
export declare function navigateToUrl(url: string, refId: string | undefined, logger: UpsellHandlerContext['logger']): void;
export declare function trackUpsellPageView(logger: UpsellHandlerContext['logger'], emit: UpsellHandlerContext['emit']): void;
export declare function addUpsellToOrder(nextUrl: string | null | undefined, ctx: UpsellHandlerContext): Promise<void>;
export declare function skipUpsell(nextUrl: string | null | undefined, ctx: UpsellHandlerContext): void;
export declare function handleActionClick(event: Event, ctx: UpsellHandlerContext): Promise<void>;
//# sourceMappingURL=UpsellEnhancer.handlers.d.ts.map