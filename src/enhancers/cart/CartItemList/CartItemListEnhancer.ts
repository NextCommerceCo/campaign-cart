import { BaseEnhancer } from '@/enhancers/base/BaseEnhancer';
import { useCartStore } from '@/stores/cartStore';
import type { CartState, CartItem } from '@/types/global';
import type { TitleMap } from './CartItemListEnhancer.types';
import {
  renderCartItem,
  groupIdenticalItems,
  getDefaultItemTemplate,
} from './CartItemListEnhancer.renderer';

export class CartItemListEnhancer extends BaseEnhancer {
  private template?: string;
  private emptyTemplate?: string;
  private titleMap?: TitleMap;
  private lastRenderedItems: string = '';
  private groupItems: boolean = false;

  public async initialize(): Promise<void> {
    this.validateElement();

    const templateId = this.getAttribute('data-item-template-id');
    const templateSelector = this.getAttribute('data-item-template-selector');

    if (templateId) {
      const templateEl = document.getElementById(templateId);
      this.template = templateEl?.innerHTML.trim() ?? '';
    } else if (templateSelector) {
      const templateEl = document.querySelector(templateSelector);
      this.template =
        (templateEl as HTMLElement | null)?.innerHTML.trim() ?? '';
    } else {
      this.template =
        this.getAttribute('data-item-template') ??
        this.element.innerHTML.trim();
    }

    if (
      !this.template ||
      this.template.replace(/<!--[\s\S]*?-->/g, '').trim() === ''
    ) {
      this.template = getDefaultItemTemplate();
    }

    this.emptyTemplate =
      this.getAttribute('data-empty-template') ??
      '<div class="cart-empty">Your cart is empty</div>';

    const titleMapAttr = this.getAttribute('data-title-map');
    if (titleMapAttr) {
      try {
        this.titleMap = JSON.parse(titleMapAttr) as TitleMap;
      } catch (error) {
        this.logger.warn('Invalid title map JSON:', error);
      }
    }

    this.groupItems = this.hasAttribute('data-group-items');

    this.subscribe(useCartStore, this.handleCartUpdate.bind(this));
    this.handleCartUpdate(useCartStore.getState());

    this.logger.debug('CartItemListEnhancer initialized');
  }

  public update(data?: unknown): void {
    if (data) {
      void this.handleCartUpdate(data as CartState);
    }
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private async handleCartUpdate(cartState: CartState): Promise<void> {
    try {
      if (cartState.isEmpty || cartState.items.length === 0) {
        this.renderEmptyCart();
      } else {
        await this.renderCartItems(cartState.items);
      }
    } catch (error) {
      this.handleError(error, 'handleCartUpdate');
    }
  }

  private renderEmptyCart(): void {
    this.element.innerHTML = this.emptyTemplate ?? '';
    this.addClass('cart-empty');
    this.removeClass('cart-has-items');
  }

  private async renderCartItems(items: CartItem[]): Promise<void> {
    this.removeClass('cart-empty');
    this.addClass('cart-has-items');

    const itemsToRender = this.groupItems
      ? groupIdenticalItems(items)
      : items;
    const template = this.template ?? getDefaultItemTemplate();

    const htmlParts: string[] = [];
    for (const item of itemsToRender) {
      const html = renderCartItem(item, template, this.titleMap);
      if (html) htmlParts.push(html);
    }

    const newHTML = htmlParts.join('');

    if (newHTML !== this.lastRenderedItems) {
      this.element.innerHTML = newHTML;
      this.lastRenderedItems = newHTML;
      await this.enhanceNewElements();
    } else {
      this.logger.debug('Cart items HTML unchanged, skipping DOM update');
    }
  }

  private async enhanceNewElements(): Promise<void> {
    const quantityButtons =
      this.element.querySelectorAll('[data-next-quantity]');
    const removeButtons =
      this.element.querySelectorAll('[data-next-remove-item]');

    if (quantityButtons.length > 0) {
      const { QuantityControlEnhancer } = await import(
        '@/enhancers/cart/QuantityControl'
      );
      for (const button of Array.from(quantityButtons)) {
        if (button instanceof HTMLElement) {
          try {
            const enhancer = new QuantityControlEnhancer(button);
            await enhancer.initialize();
          } catch (error) {
            this.logger.error(
              'Failed to enhance quantity button:',
              error,
              button,
            );
          }
        }
      }
    }

    if (removeButtons.length > 0) {
      const { RemoveItemEnhancer } = await import(
        '@/enhancers/cart/RemoveItem'
      );
      for (const button of Array.from(removeButtons)) {
        if (button instanceof HTMLElement) {
          try {
            const enhancer = new RemoveItemEnhancer(button);
            await enhancer.initialize();
          } catch (error) {
            this.logger.error(
              'Failed to enhance remove button:',
              error,
              button,
            );
          }
        }
      }
    }

    this.logger.debug(
      `Enhanced ${quantityButtons.length} quantity buttons and ${removeButtons.length} remove buttons`,
    );
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  public getItemCount(): number {
    return this.element.querySelectorAll('[data-cart-item-id]').length;
  }

  public getItemElements(): NodeListOf<Element> {
    return this.element.querySelectorAll('[data-cart-item-id]');
  }

  public refreshItem(_packageId: number): void {
    void this.handleCartUpdate(useCartStore.getState());
  }
}
