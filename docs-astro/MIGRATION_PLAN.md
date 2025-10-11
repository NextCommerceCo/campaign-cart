# Documentation Structure Migration Plan

## Current Files Assessment

### ✅ Keep & Relocate (8 files with real content)
- `index.mdx` → Keep as homepage
- `introduction.mdx` → Merge into `getting-started/core-concepts.mdx`
- `installation.mdx` → Move to `getting-started/installation.mdx`
- `quick-start.mdx` → Move to `getting-started/index.mdx`
- `first-product-page.mdx` → Move to `complete-flows/product-page.mdx`
- `playground.mdx` → Keep as `/playground.mdx` (special interactive page)
- `api/methods.mdx` → Move to `javascript-api/index.mdx`
- `config/configuration-reference.mdx` → Split across configuration section

### 🗑️ Delete (26 placeholder files)
All these files are empty or just have placeholder content:

**Components (all empty):**
- `components/buttons.md`
- `components/conditionals.md`
- `components/display.md`
- `components/forms.md`
- `components/quantity.md`

**Features (all empty):**
- `features/cart-system.md`
- `features/checkout.md`
- `features/dynamic-pricing.md`
- `features/product-selection.md`
- `features/upsells.md`

**Examples (all empty):**
- `examples/cart-systems.md`
- `examples/checkout-flows.md`
- `examples/product-pages.md`
- `examples/upsell-funnels.md`

**API (mostly empty):**
- `api/attributes.md`
- `api/callbacks.md`
- `api/css-classes.md`
- `api/events.md`

**Config (mostly empty):**
- `config/advanced.md`
- `config/api-setup.md`
- `config/meta-tags.md`
- `config/url-parameters.md`

**Guides (all empty):**
- `guides/accessibility.md`
- `guides/best-practices.md`
- `guides/example.md`
- `guides/migration.md`
- `guides/performance.md`
- `guides/troubleshooting.md`

**Reference (empty):**
- `reference/example.md`

### 📝 Minor content files to handle
- `quick-start-clean.mdx` → Delete (duplicate of quick-start)
- `quick-start-simple.mdx` → Delete (duplicate of quick-start)

## New Structure to Create

```
docs/
├── getting-started/
│   ├── index.mdx                 # From quick-start.mdx
│   ├── installation.mdx          # From installation.mdx
│   ├── first-cart.mdx           # New - simple cart in 10 lines
│   └── core-concepts.mdx        # From introduction.mdx
│
├── data-attributes/
│   ├── index.mdx                # New - complete reference
│   ├── actions.mdx              # New - data-next-action
│   ├── display.mdx              # New - data-next-display
│   ├── state.mdx                # New - data-next-if
│   └── configuration.mdx       # New - data-next-config
│
├── building-blocks/
│   ├── index.mdx                # New - overview
│   ├── add-to-cart.mdx        # New - button patterns
│   ├── cart-display.mdx       # New - showing cart
│   ├── quantity-controls.mdx   # New - stock management
│   ├── price-display.mdx      # New - dynamic pricing
│   ├── product-selection.mdx  # New - variants
│   └── checkout-forms.mdx     # New - form enhancement
│
├── complete-flows/
│   ├── index.mdx               # New - overview
│   ├── product-page.mdx       # From first-product-page.mdx
│   ├── cart-drawer.mdx        # New
│   ├── checkout-flow.mdx      # New
│   └── upsell-funnel.mdx      # New
│
├── javascript-api/
│   ├── index.mdx               # From api/methods.mdx
│   ├── cart-methods.mdx       # New - extracted from methods
│   ├── events.mdx              # New
│   ├── callbacks.mdx          # New
│   └── analytics.mdx          # New
│
├── configuration/
│   ├── index.mdx               # New - overview
│   ├── meta-tags.mdx          # New
│   ├── url-parameters.mdx     # New
│   ├── profiles.mdx           # New
│   ├── multi-currency.mdx     # New
│   └── debugging.mdx          # New
│
├── guides/
│   ├── migration/
│   │   ├── index.mdx          # New
│   │   └── from-shopify.mdx   # New
│   ├── optimization/
│   │   ├── performance.mdx    # New
│   │   └── accessibility.mdx  # New
│   └── troubleshooting/
│       └── common-issues.mdx   # New
│
├── reference/
│   ├── css-classes.mdx        # New
│   ├── error-codes.mdx        # New
│   └── changelog.mdx          # New
│
├── index.mdx                   # Keep - homepage
└── playground.mdx              # Keep - interactive demos
```

## Migration Steps

### Step 1: Clean Up (Delete placeholder files)
```bash
# Delete empty component files
rm docs-astro/src/content/docs/components/*.md

# Delete empty feature files  
rm docs-astro/src/content/docs/features/*.md

# Delete empty example files
rm docs-astro/src/content/docs/examples/*.md

# Delete empty API files (keeping methods.mdx)
rm docs-astro/src/content/docs/api/attributes.md
rm docs-astro/src/content/docs/api/callbacks.md
rm docs-astro/src/content/docs/api/css-classes.md
rm docs-astro/src/content/docs/api/events.md

# Delete empty config files (keeping configuration-reference.mdx)
rm docs-astro/src/content/docs/config/advanced.md
rm docs-astro/src/content/docs/config/api-setup.md
rm docs-astro/src/content/docs/config/meta-tags.md
rm docs-astro/src/content/docs/config/url-parameters.md

# Delete empty guide files
rm docs-astro/src/content/docs/guides/*.md

# Delete reference example
rm docs-astro/src/content/docs/reference/example.md

# Delete duplicate quick-start files
rm docs-astro/src/content/docs/quick-start-clean.mdx
rm docs-astro/src/content/docs/quick-start-simple.mdx
```

### Step 2: Create New Structure
```bash
# Create new directories
mkdir -p docs-astro/src/content/docs/getting-started
mkdir -p docs-astro/src/content/docs/data-attributes
mkdir -p docs-astro/src/content/docs/building-blocks
mkdir -p docs-astro/src/content/docs/complete-flows
mkdir -p docs-astro/src/content/docs/javascript-api
mkdir -p docs-astro/src/content/docs/configuration
mkdir -p docs-astro/src/content/docs/guides/migration
mkdir -p docs-astro/src/content/docs/guides/optimization
mkdir -p docs-astro/src/content/docs/guides/troubleshooting
mkdir -p docs-astro/src/content/docs/reference
```

### Step 3: Move Existing Content
```bash
# Move getting started content
mv docs-astro/src/content/docs/quick-start.mdx docs-astro/src/content/docs/getting-started/index.mdx
mv docs-astro/src/content/docs/installation.mdx docs-astro/src/content/docs/getting-started/installation.mdx
mv docs-astro/src/content/docs/introduction.mdx docs-astro/src/content/docs/getting-started/core-concepts.mdx

# Move complete flows
mv docs-astro/src/content/docs/first-product-page.mdx docs-astro/src/content/docs/complete-flows/product-page.mdx

# Move API documentation
mv docs-astro/src/content/docs/api/methods.mdx docs-astro/src/content/docs/javascript-api/index.mdx

# Configuration reference needs to be split up
# Keep the original for now, will be processed in step 4
```

### Step 4: Update Astro Config for Navigation

The navigation structure in `astro.config.mjs` needs to be updated to reflect the new organization.

### Step 5: Create Index Files for New Sections

Each major section needs an index.mdx that explains what's in that section.

## Priority for New Content Creation

### Week 1 - Foundation
1. **data-attributes/index.mdx** - Complete attribute reference (CRITICAL)
2. **data-attributes/actions.mdx** - All action attributes
3. **data-attributes/display.mdx** - All display attributes
4. **building-blocks/add-to-cart.mdx** - Most common pattern
5. **building-blocks/cart-display.mdx** - Second most common

### Week 2 - Core Patterns
1. **complete-flows/cart-drawer.mdx** - Full implementation
2. **complete-flows/checkout-flow.mdx** - Payment processing
3. **javascript-api/cart-methods.mdx** - Cart manipulation
4. **javascript-api/events.mdx** - Event system

### Week 3 - Advanced & Polish
1. **configuration/profiles.mdx** - A/B testing setup
2. **configuration/multi-currency.mdx** - International stores
3. **guides/troubleshooting/common-issues.mdx** - Top 20 issues
4. **guides/migration/from-shopify.mdx** - Migration guide