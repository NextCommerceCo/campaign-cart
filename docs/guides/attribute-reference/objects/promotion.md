---
title: 'Promotion'
group: 'Attribute Reference/Objects'
order: 206
---

# Promotion

Marks a banner, a card or a link as a promotion the page tracks: it is reported as viewed once
half of it is on screen, and as clicked on each click.

```html
<a
  href="#offer"
  data-next-promotion="summer-sale"
  data-next-promotion-name="Summer sale"
  data-next-promotion-creative="hero-v2"
>
  …
</a>
```

## Attributes

| Attribute                      | Means                                                                                                                |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `data-next-promotion="<id>"`   | The promotion's `id`, sent as `promotion_id`. Required: an empty value logs a warning and the element is not tracked |
| `data-next-promotion-name`     | Its name, sent as `promotion_name`                                                                                   |
| `data-next-promotion-creative` | The image or version shown, sent as `creative_name`                                                                  |

Each element is reported as viewed once per page, the first time at least half of it is visible.
Elements added later are tracked after `next.bind(root)`.

The exit-intent popup is a promotion too, set up with `next.exitIntent({ id, name, … })` (see the
[JavaScript API](../../javascript-api.md)).

## Events

[promotion.viewed](/event-reference/promotions/promotion.viewed) and
[promotion.clicked](/event-reference/promotions/promotion.clicked), with `type: 'banner'`; their
tracking events are `promotion_viewed` and `promotion_selected`. See the
[Promotion lifecycle](../../event-reference/promotions/lifecycle.md).
