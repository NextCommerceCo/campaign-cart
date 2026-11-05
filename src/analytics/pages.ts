import { ecommerce } from './ecommerce';
import type { Report } from './report';

export function reportPage({ engine, emit, skip }: Report): void {
  const { page_location, page_referrer } = engine.eventContext();
  const page_title = document.title;
  emit('page_view', { page_location, page_title, page_referrer }, { trigger: 'sdk.ready', reason: 'Every page load' });
  const ids = [
    ...new Set(
      [...document.querySelectorAll('[data-next-package-id]')].map((el) =>
        Number(el.getAttribute('data-next-package-id')),
      ),
    ),
  ];
  const viewed = ids.filter((id) => engine.getPackage(id)).map((id) => ({ package_id: id, quantity: 1 }));
  const packages = `${viewed.length} packages on the page`;
  if (viewed.length === 1) {
    emit('view_item', ecommerce(engine, viewed), { trigger: 'sdk.ready', reason: 'One package on the page' });
    skip('sdk.ready', 'view_item_list', 'Only one package on the page, so view_item instead');
  } else if (viewed.length > 1) {
    const { value: _, ...list } = ecommerce(engine, viewed);
    emit(
      'view_item_list',
      { ...list, item_list_id: 'product_list', item_list_name: 'Product List' },
      { trigger: 'sdk.ready', reason: packages },
    );
    skip('sdk.ready', 'view_item', `${packages}, so view_item_list instead`);
  } else {
    skip('sdk.ready', 'view_item', 'No package on the page');
    skip('sdk.ready', 'view_item_list', 'No package on the page');
  }
}
