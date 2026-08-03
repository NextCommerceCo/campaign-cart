/**
 * `EcommerceEvents`' browse category — extracted verbatim from
 * `ecommerce-events.ts`. Product-discovery events (list views, single-item
 * views, list clicks, search results). None of these read the cart or
 * campaign store; every field comes from the `items`/`item` argument.
 */

import type { DataLayerEvent, EcommerceData } from '../types';
import { EventBuilder } from './event-builder';
import type { CartItem, EnrichedCartLine } from '@/types/global';

/**
 * Create view_item_list event (GA4 format)
 */
export function createViewItemListEvent(
  items: (CartItem | EnrichedCartLine | any)[],
  listId?: string,
  listName?: string
): DataLayerEvent {
  const currency = EventBuilder.getCurrency();

  // Format items as GA4 items
  const formattedItems = items.map((item, index) =>
    EventBuilder.formatEcommerceItem(item, index, {
      id: listId,
      name: listName,
    })
  );

  // Store list attribution for future events
  EventBuilder.setListAttribution(listId, listName);

  const ecommerce: EcommerceData = {
    currency,
    items: formattedItems,
    item_list_id: listId,
    item_list_name: listName || listId,
  };

  return EventBuilder.createEvent('dl_view_item_list', {
    user_properties: EventBuilder.getUserProperties(),
    ecommerce,
  });
}

/**
 * Create view_item event (GA4 format)
 */
export function createViewItemEvent(
  item: CartItem | EnrichedCartLine | any
): DataLayerEvent {
  const currency = EventBuilder.getCurrency();
  const list = EventBuilder.getListAttribution();

  const formattedItem = EventBuilder.formatEcommerceItem(item, 0, list);

  const ecommerce: EcommerceData = {
    currency,
    // GA4 view_item requires `value` alongside `currency` (item revenue:
    // price × quantity). Without it GA4 cannot attribute item-view value.
    value: EventBuilder.sumItemsValue([formattedItem]),
    items: [formattedItem],
  };

  return EventBuilder.createEvent('dl_view_item', {
    user_properties: EventBuilder.getUserProperties(),
    ecommerce,
  });
}

/**
 * Create select_item event (product click) (GA4 format)
 */
export function createSelectItemEvent(
  item: CartItem | EnrichedCartLine | any,
  listId?: string,
  listName?: string
): DataLayerEvent {
  const currency = EventBuilder.getCurrency();

  const formattedItem = EventBuilder.formatEcommerceItem(item, 0, {
    id: listId,
    name: listName || listId,
  });

  const ecommerce: EcommerceData = {
    currency,
    items: [formattedItem],
    item_list_id: listId,
    item_list_name: listName || listId,
  };

  return EventBuilder.createEvent('dl_select_item', {
    user_properties: EventBuilder.getUserProperties(),
    ecommerce,
  });
}

/**
 * Create view_search_results event (GA4 format)
 */
export function createViewSearchResultsEvent(
  items: (CartItem | EnrichedCartLine | any)[],
  searchTerm?: string
): DataLayerEvent {
  const currency = EventBuilder.getCurrency();

  // Format items as GA4 items
  const formattedItems = items.map((item, index) =>
    EventBuilder.formatEcommerceItem(item, index, { name: 'search results' })
  );

  const ecommerce: EcommerceData = {
    currency,
    items: formattedItems,
    item_list_name: 'search results',
  };

  return EventBuilder.createEvent('dl_view_search_results', {
    user_properties: EventBuilder.getUserProperties(),
    ecommerce,
    search_term: searchTerm,
  });
}
