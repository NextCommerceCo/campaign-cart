import { catalogItem } from './items';
import type { Report } from './report';

export function reportPage({ engine, emit, skip }: Report): void {
  emit('page_viewed', {}, { trigger: 'sdk.ready', reason: 'Every page load' });
  const ids = [
    ...new Set(
      [...document.querySelectorAll('[data-next-package-id]')].map((el) =>
        Number(el.getAttribute('data-next-package-id')),
      ),
    ),
  ];
  const viewed = ids
    .filter((id) => engine.getPackage(id))
    .map((id) => catalogItem(engine, { package_id: id, quantity: 1 }));
  const packages = `${viewed.length} packages on the page`;
  if (viewed.length === 1) {
    emit('product_viewed', viewed[0]!, { trigger: 'sdk.ready', reason: 'One package on the page' });
    skip('sdk.ready', 'product_list_viewed', 'Only one package on the page, so product_viewed instead');
  } else if (viewed.length > 1) {
    emit('product_list_viewed', viewed, { trigger: 'sdk.ready', reason: packages });
    skip('sdk.ready', 'product_viewed', `${packages}, so product_list_viewed instead`);
  } else {
    skip('sdk.ready', 'product_viewed', 'No package on the page');
    skip('sdk.ready', 'product_list_viewed', 'No package on the page');
  }
}
