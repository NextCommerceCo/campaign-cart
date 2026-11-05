---
title: 'Campaign and params'
group: 'Attribute Reference/Objects'
order: 207
---

# Campaign and params

`campaign.*` is the campaign the loader names: `campaign.name`, `campaign.currency`,
`campaign.language`. `param.<name>` is a URL parameter of this visit, kept for the rest of the tab
(see [URL parameters](../setup/url-parameters.md)).

```html
<p data-next-show="param.banner != off">Summer sale</p>
<span data-next-query="param.price" data-next-format="currency"></span>
```
