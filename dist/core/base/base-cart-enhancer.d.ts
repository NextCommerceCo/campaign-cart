import { BaseEnhancer } from './base-enhancer';
import { CartState, CartItem } from '../../types/global';
export declare abstract class BaseCartEnhancer extends BaseEnhancer {
    protected cartState?: CartState;
    protected setupCartSubscription(): void;
    protected abstract handleCartUpdate(state: CartState): void;
    protected isCartEmpty(): boolean;
    protected getCartItem(packageId: number): CartItem | undefined;
    protected getTotalQuantity(): number;
    protected getCartItems(): CartItem[];
    protected hasPackageInCart(packageId: number): boolean;
}
//# sourceMappingURL=base-cart-enhancer.d.ts.map