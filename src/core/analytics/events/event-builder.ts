/**
 * Event Builder
 * Base class for creating standardized analytics events
 *
 * Split by layer: this file is the orchestrator (`createEvent` plus the
 * public static surface every caller uses); the context/session fields live in
 * `./event-builder.context`, the GA4 item formatter in
 * `./ecommerce-item-formatter`, list attribution storage in
 * `./list-attribution-storage`, and the deprecated Elevar format in
 * `./elevar-legacy-formatter`.
 */

import type { DataLayerEvent } from '../types';
import {
  generateEventId,
  getUserProperties,
  getEventContext,
  getCampaignContext,
  getEventMetadata,
  getSessionId,
} from './event-builder.context';
import {
  sumItemsValue,
  getCurrency,
  formatEcommerceItem,
} from './ecommerce-item-formatter';
import {
  getListAttribution,
  setListAttribution,
  clearListAttribution,
} from './list-attribution-storage';
import {
  formatElevarProduct,
  formatElevarImpression,
} from './elevar-legacy-formatter';

export class EventBuilder {
  /**
   * Create base event with standard properties
   */
  static createEvent(
    eventName: string,
    eventData: Partial<DataLayerEvent> = {}
  ): DataLayerEvent {
    const event: DataLayerEvent = {
      event: eventName,
      event_id: generateEventId(),
      event_time: new Date().toISOString(),
      user_properties: getUserProperties(),
      ...getEventContext(),
      ...eventData,
      _metadata: getEventMetadata(),
    };

    return event;
  }

  static getUserProperties = getUserProperties;
  static getEventContext = getEventContext;
  static getCampaignContext = getCampaignContext;
  static getSessionId = getSessionId;

  static sumItemsValue = sumItemsValue;
  static getCurrency = getCurrency;
  static formatEcommerceItem = formatEcommerceItem;

  static getListAttribution = getListAttribution;
  static setListAttribution = setListAttribution;
  static clearListAttribution = clearListAttribution;

  static formatElevarProduct = formatElevarProduct;
  static formatElevarImpression = formatElevarImpression;
}
