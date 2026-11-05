---
title: 'NEXT campaign script'
group: 'Analytics Reference/Providers'
order: 0.24
---

# NEXT campaign script

Built in. Once the analytics chunk has loaded, it adds
`https://campaigns.apps.29next.com/js/v1/campaign/` to the page, unless the page already has it,
and when it loads calls:

```js
nextCampaign.config({ apiKey });
nextCampaign.event('page_view', { title: document.title, url: location.href });
```

It gets no other standard event. The script and the Campaigns API share the campaign session
(`ncsid`), the `session_id` in every event's `context`.

`nextConfig.analytics.providers.nextCampaign.enabled: false` keeps the script off the page.
