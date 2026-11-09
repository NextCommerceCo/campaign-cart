/** The campaign the page runs, on every event once it has loaded. */
export interface EventCampaign {
  /** The campaign's `id` in the Campaigns API and the dashboard. */
  id: number;
  name: string;
  /** The currency the page shows: the campaign's, or the one `?currency=` asked for. */
  currency: string;
  /** The campaign's language code, like `en`. */
  language: string;
}

/** Where the shopper came from, as sent with the Open Cart and the order. Only fields with a value are present. */
export interface EventAttribution {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  /** `affid` or `aff`. */
  affiliate?: string;
  subaffiliate1?: string;
  subaffiliate2?: string;
  subaffiliate3?: string;
  subaffiliate4?: string;
  subaffiliate5?: string;
  gclid?: string;
  /** `data-funnel`, else the campaign's name. */
  funnel?: string;
  everflow_transaction_id?: string;
  /** The first page of the visit, without its query string. */
  landing_page?: string;
  fbclid?: string;
  /** The `_fbp` cookie. */
  fbp?: string;
  /** The `_fbc` cookie. */
  fbc?: string;
  /** An affiliate network's click id. */
  clickid?: string;
}

/** The browser, read when the event is sent. */
export interface Browser {
  user_agent: string;
  /** The browser's language, such as `th-TH`. */
  language: string;
  /** `mobile` when the main pointer is coarse (a finger). */
  device_type: 'mobile' | 'desktop';
}

/** Where, for which campaign and in which browser an event happened. */
export interface EventContext {
  /** Origin and path, without the query string. */
  page_location: string;
  /** The page's title. */
  page_title: string;
  /** Without the query string. */
  page_referrer: string;
  /** Once the campaign has loaded. */
  campaign?: EventCampaign;
  /** The campaign session, as in the event envelope. */
  session_id: string;
  attribution: EventAttribution;
  browser: Browser;
}
