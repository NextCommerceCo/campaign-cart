import { CartItem } from '../../../types/global';
import { TitleMap } from './cart-item-list.types';
export declare function getDefaultItemTemplate(): string;
export declare function renderCartItem(item: CartItem, template: string, titleMap?: TitleMap): string;
export declare function groupIdenticalItems(items: CartItem[]): CartItem[];
//# sourceMappingURL=cart-item-list.renderer.d.ts.map