import { CartCreationContext } from './prospect-cart.types';
export declare function createProspectCart(context: CartCreationContext): Promise<void>;
export declare function updateProspectCart(context: CartCreationContext): Promise<void>;
export declare function collectUtmData(context: Pick<CartCreationContext, 'logger'>): Record<string, string>;
export declare function getCurrency(): string;
//# sourceMappingURL=cart-creation.d.ts.map