/**
 * Event Builder — list attribution storage
 *
 * Remembers which list (e.g. a search-results page or a related-products rail)
 * a product was viewed/selected from, in sessionStorage, so the next event
 * (add_to_cart, view_item) can attach `item_list_id` / `item_list_name`.
 */

import { scopedKey } from '@/core/storage';

/**
 * Get list attribution from sessionStorage
 */
export function getListAttribution():
  | { id?: string; name?: string }
  | undefined {
  if (typeof window !== 'undefined') {
    const listId = sessionStorage.getItem(scopedKey('analytics_list_id'));
    const listName = sessionStorage.getItem(scopedKey('analytics_list_name'));

    if (listId || listName) {
      const result: { id?: string; name?: string } = {};
      if (listId) result.id = listId;
      if (listName) result.name = listName;
      return result;
    }
  }
  return undefined;
}

/**
 * Set list attribution in sessionStorage
 */
export function setListAttribution(listId?: string, listName?: string): void {
  if (typeof window !== 'undefined') {
    if (listId) {
      sessionStorage.setItem(scopedKey('analytics_list_id'), listId);
    }
    if (listName) {
      sessionStorage.setItem(scopedKey('analytics_list_name'), listName);
    }
  }
}

/**
 * Clear list attribution
 */
export function clearListAttribution(): void {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(scopedKey('analytics_list_id'));
    sessionStorage.removeItem(scopedKey('analytics_list_name'));
  }
}
