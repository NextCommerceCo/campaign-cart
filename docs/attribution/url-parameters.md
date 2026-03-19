# Attribution URL Parameters

The Next Commerce JS SDK automatically captures attribution data from URL parameters to track marketing campaigns, affiliate referrals, and conversion sources. This data is persisted throughout the user's session and included with all orders.

## Overview

Attribution parameters are:
- **Automatically captured** from URL query strings when the SDK initializes
- **Persisted** in sessionStorage throughout the user's session
- **URL parameters always override** any existing persisted values
- **Included automatically** in checkout and order API calls
- **Cross-page persistent** - navigate anywhere and attribution is preserved

## Core Attribution Parameters

### Funnel

Identifies the marketing funnel or campaign flow.

**Parameter:** `funnel`

**Example:**
```
https://yoursite.com/checkout?funnel=summer-sale-2024
```

**Usage:**
- Track different marketing funnels
- Identify which landing page or campaign the user came from
- Segment orders by funnel for reporting

**Behavior:**
- Can also be set via meta tags (URL parameter takes priority)
- Once set, persists across all pages in the session
- URL parameter will override any existing funnel value
- Also accepts `next.setAttribution({ funnel: 'funnel-name' })` programmatically

### Affiliate ID

Tracks affiliate or partner referrals.

**Parameters:** `affid` or `aff` (both accepted)

**Example:**
```
https://yoursite.com/product?affid=partner123
https://yoursite.com/product?aff=affiliate-xyz
```

**Usage:**
- Track affiliate commissions
- Attribute sales to specific partners
- Segment traffic by referral source

### Google Click ID (GCLID)

Google Ads click identifier for conversion tracking.

**Parameter:** `gclid`

**Example:**
```
https://yoursite.com/landing?gclid=EAIaIQobChMI7...
```

**Usage:**
- Google Ads conversion tracking
- Automatically captured from Google Ads campaigns
- Required for Google Ads conversion API

## UTM Parameters

Standard UTM tracking parameters for campaign analytics.

### UTM Source

Identifies the source of traffic (e.g., google, facebook, newsletter).

**Parameter:** `utm_source`

**Example:**
```
https://yoursite.com/offer?utm_source=facebook
```

### UTM Medium

Identifies the marketing medium (e.g., cpc, email, social).

**Parameter:** `utm_medium`

**Example:**
```
https://yoursite.com/offer?utm_medium=cpc
```

### UTM Campaign

Identifies the specific campaign.

**Parameter:** `utm_campaign`

**Example:**
```
https://yoursite.com/offer?utm_campaign=summer-sale-2024
```

### UTM Content

Identifies specific ad or link content (for A/B testing).

**Parameter:** `utm_content`

**Example:**
```
https://yoursite.com/offer?utm_content=banner-ad-blue
```

### UTM Term

Identifies paid search keywords.

**Parameter:** `utm_term`

**Example:**
```
https://yoursite.com/offer?utm_term=weight+loss+supplement
```

### Complete UTM Example

```
https://yoursite.com/product?utm_source=facebook&utm_medium=cpc&utm_campaign=summer-2024&utm_content=carousel-ad-1&utm_term=fitness
```

## Subaffiliate Tracking

Track up to 5 levels of sub-affiliate data for multi-tier affiliate programs.

**Parameters:** `subaffiliate1-5` or `sub1-5` (both formats accepted)

**Character Limit:** Each subaffiliate value is limited to 225 characters (automatically truncated with a warning)

**Examples:**
```
https://yoursite.com/product?subaffiliate1=region-west&subaffiliate2=agent-123
https://yoursite.com/product?sub1=tier1&sub2=tier2&sub3=tier3
```

**Usage:**
- Multi-level marketing (MLM) tracking
- Regional affiliate tracking
- Sales team commission tracking
- Hierarchical partner structures

**Subaffiliate Levels:**
- `subaffiliate1` / `sub1` - Primary sub-affiliate
- `subaffiliate2` / `sub2` - Secondary level
- `subaffiliate3` / `sub3` - Tertiary level
- `subaffiliate4` / `sub4` - Fourth level
- `subaffiliate5` / `sub5` - Fifth level

## Click Tracking Parameters

### Facebook Click ID (FBCLID)

Facebook Ads click identifier for conversion tracking.

**Parameter:** `fbclid`

**Example:**
```
https://yoursite.com/landing?fbclid=IwAR1X...
```

**Usage:**
- Facebook Ads conversion tracking
- Automatically appended by Facebook to ad links
- Stored in attribution metadata

### Everflow Click ID (EVCLID)

Everflow affiliate network tracking identifier.

**Parameter:** `evclid`

**Example:**
```
https://yoursite.com/offer?evclid=123456789
```

**Usage:**
- Everflow affiliate network tracking
- Performance marketing attribution
- Stored as `everflow_transaction_id` in metadata

### SG Everflow Click ID

Secondary Everflow tracking identifier (SG variant).

**Parameter:** `sg_evclid`

**Example:**
```
https://yoursite.com/offer?sg_evclid=987654321
```

**Usage:**
- Alternate Everflow tracking
- Multi-channel Everflow campaigns

### Generic Click ID

Generic click tracking for various platforms.

**Parameter:** `clickid`

**Example:**
```
https://yoursite.com/product?clickid=abc123xyz
```

**Usage:**
- Custom tracking platforms
- Generic click tracking systems
- Platform-agnostic click attribution

## How Attribution Works

### 1. Automatic Capture

When a user visits any page with attribution parameters:

```
https://yoursite.com/landing?funnel=summer-sale&affid=partner123&utm_source=facebook
```

The SDK automatically:
- Captures all attribution parameters
- Stores them in sessionStorage
- Logs the capture event (visible with debug mode)

### 2. Session Persistence

Once captured, attribution data persists throughout the session:

```
Page 1: /landing?funnel=summer-sale&affid=partner123
Page 2: /products (no params)
Page 3: /checkout (no params)
```

All attribution data from Page 1 remains available on Pages 2 and 3.

### 3. Parameter Override

URL parameters **always override** existing persisted values:

```
Visit 1: ?funnel=spring-sale
  → Sets funnel to "spring-sale"

Visit 2: ?funnel=summer-sale
  → Overrides funnel to "summer-sale"
  → Logs: "🔄 Funnel override: 'spring-sale' -> 'summer-sale'"
```

### 4. Order Inclusion

All captured attribution data is automatically included in:
- Cart creation API calls
- Checkout submission
- Order completion
- Upsell additions

## JavaScript API

### Get Current Attribution

```javascript
// Get all attribution data
const attribution = next.getAttribution();
console.log(attribution);
// {
//   funnel: 'summer-sale',
//   affiliate: 'partner123',
//   utm_source: 'facebook',
//   utm_campaign: 'summer-2024',
//   metadata: { ... }
// }
```

### Set Attribution Programmatically

```javascript
// Set specific attribution fields
next.setAttribution({
  funnel: 'vip-funnel',
  affiliate: 'special-partner'
});
```

### Add Custom Metadata

```javascript
// Add custom tracking data
next.addMetadata('custom_field', 'custom_value');

// Set multiple metadata fields
next.setMetadata({
  landing_variant: 'A',
  offer_code: 'SUMMER50',
  sales_rep: 'john-smith'
});
```

### Debug Attribution

```javascript
// View all attribution data in console
next.debugAttribution();

// Output includes:
// - All attribution fields
// - UTM parameters
// - Click tracking IDs
// - Metadata
// - Timestamps
```

## Common Use Cases

### 1. Affiliate Marketing Campaign

```
https://yoursite.com/offer?affid=partner123&subaffiliate1=region-west&subaffiliate2=agent-456
```

Tracks:
- Affiliate partner
- Region/territory
- Individual sales agent

### 2. Facebook Ad Campaign

```
https://yoursite.com/product?funnel=fb-summer-campaign&utm_source=facebook&utm_medium=cpc&utm_campaign=summer-2024&fbclid=IwAR1X...
```

Tracks:
- Campaign funnel
- UTM parameters for analytics
- Facebook click ID for conversion tracking

### 3. Google Ads Campaign

```
https://yoursite.com/landing?funnel=google-search&utm_source=google&utm_medium=cpc&utm_campaign=brand-terms&gclid=EAIaIQobChMI7...
```

Tracks:
- Search campaign funnel
- UTM parameters
- Google click ID for conversion API

### 4. Email Marketing

```
https://yoursite.com/exclusive?funnel=vip-email&utm_source=newsletter&utm_medium=email&utm_campaign=monthly-2024-06&utm_content=hero-cta
```

Tracks:
- Email funnel
- Newsletter source
- Specific email campaign
- Which CTA was clicked

### 5. Multi-Tier Affiliate Program

```
https://yoursite.com/product?affid=network1&sub1=master-affiliate&sub2=sub-affiliate&sub3=sales-rep&sub4=region&sub5=channel
```

Tracks complete affiliate hierarchy for commission distribution.

## Meta Tag Support

Attribution can also be set via meta tags (URL parameters take priority):

```html
<!-- Funnel name -->
<meta name="next-funnel" content="landing-page-a">

<!-- Or using tracking tag format -->
<meta name="data-next-tracking-tag" data-tag-name="funnel_name" data-tag-value="landing-page-a">
```

**Priority Order:**
1. URL parameters (highest priority, always override)
2. Persisted sessionStorage values
3. Meta tags (lowest priority)

## Best Practices

### 1. Use Consistent Naming

```javascript
// Good - descriptive and consistent
?funnel=summer-sale-2024&affid=partner-network-west

// Avoid - unclear abbreviations
?f=ss24&a=pnw
```

### 2. Combine Parameters Logically

```javascript
// Track complete campaign attribution
?funnel=fb-campaign&affid=social-partner&utm_source=facebook&utm_medium=cpc&utm_campaign=summer-2024
```

### 3. Document Your Funnels

Maintain a list of active funnels and their purposes:
- `summer-sale-2024` - Summer promotional campaign
- `vip-exclusive` - VIP member offers
- `affiliate-special` - Affiliate partner promotions

### 4. Test Attribution Capture

```javascript
// In console, verify attribution was captured
next.debugAttribution();

// Check specific fields
const attribution = next.getAttribution();
console.log('Funnel:', attribution.funnel);
console.log('Affiliate:', attribution.affiliate);
```

### 5. Monitor Attribution Data

Use your backend analytics to:
- Track conversion by funnel
- Calculate affiliate ROI
- Optimize campaign performance
- Identify top-performing sources

## Debugging

### View Current Attribution

```javascript
// Complete attribution debug
next.debugAttribution();

// Get attribution for API
const apiAttribution = next.getAttribution();
console.log(JSON.stringify(apiAttribution, null, 2));
```

### Check Stored Values

```javascript
// Check sessionStorage directly
const stored = sessionStorage.getItem('next-attribution');
console.log(JSON.parse(stored));

// Check specific persisted values
console.log('Funnel:', sessionStorage.getItem('next_funnel_name'));
console.log('EVCLID:', localStorage.getItem('evclid'));
```

### Enable SDK Debug Mode

```
https://yoursite.com/page?debug=true
```

Debug mode logs all attribution capture events to the console.

## Important Notes

### Character Limits

- **Subaffiliate values**: Limited to 225 characters each
- Values exceeding this limit are automatically truncated with a warning

### Persistence

- Attribution data persists in **sessionStorage** (cleared when browser closes)
- Some values (funnel, evclid) also persist in **localStorage** (survives browser restart)

### Security

- Attribution parameters are visible in URLs
- Do not use attribution parameters for sensitive data
- Validate all attribution data server-side

### API Integration

- Attribution data is automatically included in all order-related API calls
- No manual intervention required
- Data appears in order records for reporting

## Implementation Details

**Files:**
- `src/utils/attribution/AttributionCollector.ts` - Captures and processes attribution data
- `src/stores/attributionStore.ts` - Manages attribution state
- `src/core/NextCommerce.ts` - Provides JavaScript API

**Storage:**
- sessionStorage key: `next-attribution`
- Individual keys: `next_funnel_name`, `evclid`, etc.

## See Also

- [Getting Started - URL Parameters](../getting-started/url-parameters.md) - Other URL parameter features
- [API Reference - Attribution](../api-reference/attribution.md) - Complete attribution API
- [Meta Tags](../attributes/meta-tags.md) - Using meta tags for attribution
