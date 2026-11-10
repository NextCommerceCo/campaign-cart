---
title: 'Page tracking'
group: 'Analytics Reference/Pages'
---

# Page tracking

Tracking events: `page_viewed`, `product_viewed`, `product_list_viewed`.

![Page tracking: sdk.ready sends page_viewed on every page, then product_viewed when the page shows exactly one package, product_list_viewed when it shows more than one, and neither when it shows none](pages-lifecycle.svg)

| Tracking event        | Sent by     | When                                 | `dl_*` push         |
| --------------------- | ----------- | ------------------------------------ | ------------------- |
| `page_viewed`         | `sdk.ready` | Every page load                      | `dl_user_data`      |
| `product_viewed`      | `sdk.ready` | The page shows exactly one package   | `dl_view_item`      |
| `product_list_viewed` | `sdk.ready` | The page shows more than one package | `dl_view_item_list` |

A package the page shows is a `data-next-package-id` the campaign has, counted once. The Meta
pixel, when on, gets `PageView` for `page_viewed`. [How analytics works](../how-it-works.md) says
when analytics loads and how events from before it are read back.
