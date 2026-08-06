import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getSuccessUrl, getFailureUrl } from '../utils/url-utils';
import { useParameterStore } from '@/state/parameter';

/**
 * The URLs the orders API sends the shopper back to after a payment gateway.
 *
 * A redirect payment (PayPal, Apple Pay, a card needing 3-D Secure) leaves the
 * site and returns through `success_url` or `payment_failed_url`. Both are built
 * here and handed to the API *before* the shopper leaves, so nothing on the return
 * page can add to them — which is why a debugging session used to end the moment
 * the gateway took over, on exactly the leg of the journey that is hardest to
 * reproduce.
 *
 * The other half of this is scope: these URLs travel to the orders API inside the
 * order payload, so they carry the listed parameters and nothing else.
 */

const setUrl = (href: string): void => {
  window.history.replaceState({}, '', href);
};

const meta = (name: string, content: string): void => {
  const tag = document.createElement('meta');
  tag.setAttribute('name', name);
  tag.setAttribute('content', content);
  document.head.appendChild(tag);
};

describe('checkout return URLs carry debugging across a gateway redirect', () => {
  beforeEach(() => {
    document.head.querySelectorAll('meta').forEach(t => t.remove());
    useParameterStore.setState({ params: {} });
    setUrl('/checkout');
  });

  afterEach(() => {
    document.head.querySelectorAll('meta').forEach(t => t.remove());
    setUrl('/checkout');
  });

  it('puts ?debugger=true on the success URL from a relative meta tag', () => {
    meta('next-success-url', '/thanks');
    setUrl('/checkout?debugger=true');

    expect(new URL(getSuccessUrl()).searchParams.get('debugger')).toBe('true');
  });

  it('puts ?debug=true on the success URL from an absolute meta tag', () => {
    meta('next-success-url', 'https://shop.test/thanks');
    setUrl('/checkout?debug=true');

    const url = new URL(getSuccessUrl());
    expect(url.origin).toBe('https://shop.test');
    expect(url.searchParams.get('debug')).toBe('true');
  });

  it('puts both on the default success URL when no meta tag is set', () => {
    setUrl('/checkout?debug=true&debugger=true');

    const url = new URL(getSuccessUrl());
    expect(url.pathname).toBe('/success');
    expect(url.searchParams.get('debug')).toBe('true');
    expect(url.searchParams.get('debugger')).toBe('true');
  });

  it('puts them on a merchant-configured failure URL', () => {
    meta('next-failure-url', '/payment-problem');
    setUrl('/checkout?debugger=true');

    const url = new URL(getFailureUrl());
    expect(url.pathname).toBe('/payment-problem');
    expect(url.searchParams.get('debugger')).toBe('true');
  });

  it('keeps them on the default failure URL, which is this page plus the flag', () => {
    setUrl('/checkout?debugger=true');

    const url = new URL(getFailureUrl());
    expect(url.searchParams.get('payment_failed')).toBe('true');
    expect(url.searchParams.get('debugger')).toBe('true');
  });

  it('adds nothing when the page is not being debugged', () => {
    // The negative control. Every other assertion here says "a parameter appears";
    // this one says the URL a real shopper's order carries is untouched.
    meta('next-success-url', '/thanks');

    const url = new URL(getSuccessUrl());
    expect(url.pathname).toBe('/thanks');
    expect(url.search).toBe('');
  });

  it('copies only the listed parameters, not the rest of the query string', () => {
    // preserveQueryParams defaults to 'all', which would copy every captured
    // parameter. That default is right for an in-site navigation; here the URL
    // goes to the orders API inside the order payload, so it takes an explicit
    // list. This is what fails if someone widens it back to 'all'.
    meta('next-success-url', '/thanks');
    useParameterStore.setState({
      params: { utm_source: 'newsletter', affid: 'a-42' },
    });
    setUrl('/checkout?debugger=true&utm_source=newsletter&affid=a-42');

    const url = new URL(getSuccessUrl());
    expect(url.searchParams.get('debugger')).toBe('true');
    expect(url.searchParams.get('utm_source')).toBeNull();
    expect(url.searchParams.get('affid')).toBeNull();
  });
});
