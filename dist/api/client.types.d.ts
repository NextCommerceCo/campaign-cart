import { AddUpsellLine, Campaign, Cart, CartBase, CartCalculateSummary, CartSummary, CreateOrder, Order } from '../types/api';
export interface IApiClient {
    getCampaigns(currency?: string): Promise<Campaign>;
    createCart(data: CartBase & {
        currency?: string;
    }): Promise<Cart>;
    calculateSummary(data: CartCalculateSummary, signal?: AbortSignal, options?: {
        upsell?: boolean;
    }): Promise<CartSummary>;
    createOrder(data: CreateOrder & {
        currency?: string;
    }): Promise<Order>;
    getOrder(refId: string): Promise<Order>;
    addUpsell(refId: string, data: AddUpsellLine): Promise<Order>;
    createProspectCart(data: any): Promise<any>;
    updateProspectCart(cartId: string, data: any): Promise<any>;
    getProspectCart(cartId: string): Promise<any>;
    abandonProspectCart(cartId: string): Promise<any>;
    convertProspectCart(cartId: string): Promise<any>;
    getAddressesAutocomplete(query_text: string, country?: string, language?: string, signal?: AbortSignal): Promise<any>;
    getApiKey(): string;
}
//# sourceMappingURL=client.types.d.ts.map