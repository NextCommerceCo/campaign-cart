/**
 * Manual Analytics Tracking
 * Simple utility for blocking auto-tracked events and manually triggering them
 *
 * SETUP (Call once on page load):
 * ================================
 * <script src="path/to/manualTracking.js"></script>
 * <script>
 *   setupManualTracking();
 * </script>
 *
 * This will:
 * - Block auto-tracked dl_add_to_cart and dl_view_item events
 * - Allow you to manually trigger them when you want
 *
 * USAGE EXAMPLES:
 * ================================
 *
 * 1. Add to Cart - Simple (using package ID):
 * --------------------------------------------
 * <button onclick="manualTrackAddToCart(2)">
 *   Add to Cart
 * </button>
 *
 * 2. Add to Cart - With list attribution:
 * ----------------------------------------
 * <button onclick="manualTrackAddToCart(2, 'homepage', 'Featured Products')">
 *   Add to Cart
 * </button>
 *
 * 3. Add to Cart - Using package object:
 * ---------------------------------------
 * <button onclick="handleAddClick()">Add to Cart</button>
 * <script>
 *   function handleAddClick() {
 *     const pkg = next.getPackage(2);
 *     manualTrackAddToCart(pkg, 'homepage', 'Featured Products');
 *   }
 * </script>
 *
 * 4. View Item - Simple:
 * -----------------------
 * <div onclick="manualTrackViewItem(2)">
 *   Product Card
 * </div>
 *
 * 5. View Item - Using package object:
 * -------------------------------------
 * <script>
 *   function handleViewClick() {
 *     const pkg = next.getPackage(2);
 *     manualTrackViewItem(pkg);
 *   }
 * </script>
 *
 * WHAT GETS TRACKED:
 * ================================
 * The package object from next.getPackage() is automatically mapped to:
 * - item_id: product_sku (e.g., "dwhawk-100")
 * - item_name: product_variant_name (e.g., "Drone Hawk")
 * - item_brand: product_name
 * - price: price (parsed as number)
 * - quantity: qty
 * - item_variant_id: product_variant_id
 * - item_product_id: product_id
 * - All GA4 ecommerce fields properly set
 */

/**
 * Setup manual tracking - call this once on page load
 */
function setupManualTracking() {
  if (typeof window === 'undefined') return;

  window.NextAnalytics.setTransformFunction((event) => {
    // Allow bypass
    if (event._bypassBlocking) {
      const { _bypassBlocking, ...clean } = event;
      return clean;
    }

    // Block auto-tracked events
    const blockedAutoEvents = ['dl_add_to_cart', 'dl_view_item'];
    if (blockedAutoEvents.includes(event.event) && !event._manual) {
      console.log(`Blocking auto-tracked: ${event.event}`);
      return null;
    }

    return event;
  });

  console.log('Manual tracking setup complete');
}

/**
 * Manually trigger add to cart event
 * @param {number|Object} packageIdOrObject - Package ID or package object from next.getPackage()
 * @param {string} listId - Optional list ID
 * @param {string} listName - Optional list name
 */
function manualTrackAddToCart(packageIdOrObject, listId, listName) {
  if (typeof window === 'undefined') return;

  // Get package object if ID was passed
  let pkg = packageIdOrObject;
  if (typeof packageIdOrObject === 'number') {
    pkg = window.next?.getPackage(packageIdOrObject);
    if (!pkg) {
      console.error(`Package with ID ${packageIdOrObject} not found`);
      return;
    }
  }

  // Map package object to ecommerce item format
  const item = {
    item_id: pkg.product_sku || pkg.external_id || pkg.ref_id,
    item_name: pkg.product_variant_name || pkg.product_name || pkg.name,
    item_brand: pkg.product_name,
    item_category: pkg.product?.name,
    item_variant: pkg.product_variant_name,
    item_variant_id: pkg.product_variant_id,
    item_product_id: pkg.product_id,
    price: parseFloat(pkg.price),
    quantity: pkg.qty || 1,
    item_list_id: listId,
    item_list_name: listName,
    currency: 'USD'
  };

  const value = item.price * item.quantity;

  window.NextDataLayerManager.push({
    event: 'dl_add_to_cart',
    _manual: true,
    _bypassBlocking: true,
    ecommerce: {
      currency: 'USD',
      value: value,
      items: [item]
    }
  });

  console.log('Manual add_to_cart tracked:', pkg.product_name, value);
}

/**
 * Manually trigger view item event
 * @param {number|Object} packageIdOrObject - Package ID or package object from next.getPackage()
 */
function manualTrackViewItem(packageIdOrObject) {
  if (typeof window === 'undefined') return;

  // Get package object if ID was passed
  let pkg = packageIdOrObject;
  if (typeof packageIdOrObject === 'number') {
    pkg = window.next?.getPackage(packageIdOrObject);
    if (!pkg) {
      console.error(`Package with ID ${packageIdOrObject} not found`);
      return;
    }
  }

  // Map package object to ecommerce item format
  const item = {
    item_id: pkg.product_sku || pkg.external_id || pkg.ref_id,
    item_name: pkg.product_variant_name || pkg.product_name || pkg.name,
    item_brand: pkg.product_name,
    item_category: pkg.product?.name,
    item_variant: pkg.product_variant_name,
    item_variant_id: pkg.product_variant_id,
    item_product_id: pkg.product_id,
    price: parseFloat(pkg.price),
    quantity: pkg.qty || 1,
    currency: 'USD'
  };

  window.NextDataLayerManager.push({
    event: 'dl_view_item',
    _manual: true,
    _bypassBlocking: true,
    ecommerce: {
      currency: 'USD',
      value: item.price,
      items: [item]
    }
  });

  console.log('Manual view_item tracked:', pkg.product_name);
}
