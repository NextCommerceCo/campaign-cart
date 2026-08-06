import { DataLayerEvent } from '../types';
import { getUserProperties, getEventContext, getCampaignContext, getSessionId } from './event-builder.context';
import { sumItemsValue, getCurrency, formatEcommerceItem } from './ecommerce-item-formatter';
import { getListAttribution, setListAttribution, clearListAttribution } from './list-attribution-storage';
import { formatElevarProduct, formatElevarImpression } from './elevar-legacy-formatter';
export declare class EventBuilder {
    static createEvent(eventName: string, eventData?: Partial<DataLayerEvent>): DataLayerEvent;
    static getUserProperties: typeof getUserProperties;
    static getEventContext: typeof getEventContext;
    static getCampaignContext: typeof getCampaignContext;
    static getSessionId: typeof getSessionId;
    static sumItemsValue: typeof sumItemsValue;
    static getCurrency: typeof getCurrency;
    static formatEcommerceItem: typeof formatEcommerceItem;
    static getListAttribution: typeof getListAttribution;
    static setListAttribution: typeof setListAttribution;
    static clearListAttribution: typeof clearListAttribution;
    static formatElevarProduct: typeof formatElevarProduct;
    static formatElevarImpression: typeof formatElevarImpression;
}
//# sourceMappingURL=event-builder.d.ts.map