---
title: 'Building Pages/Payments'
group: 'Building Pages'
category: 'Building Pages'
---

# Payments

How a checkout takes payment: the methods, what happens when the shopper pays, how card details
stay safe, and what the shopper sees when a payment does not go through.

```html
<form data-next-checkout data-next-go="upsell.html">
  …
  <div data-next-payment></div>
  <p data-next-query="checkout.errors.payment"></p>
  <div data-next-express></div>
  <button>Complete order</button>
</form>
```

## Methods

A method shows only when the campaign offers it.

| Kind            | Methods                                                                   | Drawn by                                                                                                              |
| --------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Card            | Credit or debit card                                                      | [data-next-payment](../attribute-reference/widgets/data-next-payment.md)                                              |
| Wallet          | PayPal, Apple Pay (not on Android), Google Pay; Shop Pay as a button only | `data-next-payment` as a choice, [data-next-express](../attribute-reference/widgets/data-next-express.md) as a button |
| At the provider | Klarna, iDEAL, SEPA Direct Debit, Bancontact, Affirm, Twint, Swish, …     | `data-next-payment`                                                                                                   |

## When the shopper pays

1. The form is checked: every field for a card or a provider method. A wallet picked in the form
   checks what `requireValidation` asks ([Migrating from 0.4.x](../migrating-from-0.4.md)); an
   express button checks nothing, since the wallet gives the details.
2. The SDK waits for the cart's latest price, so the order matches what the page shows.
3. A card is turned into a token by the payment provider.
4. The order is created. Paid at once, the shopper goes to the page `data-next-go` names. Otherwise
   the shopper goes to the provider to finish (PayPal, Klarna, a wallet, 3-D Secure) and comes back
   to that page once paid.

## Card details

The card number and security code are typed into fields the payment provider hosts, so they never
reach the page or the SDK, as PCI DSS asks. Those fields also forget what was typed:

| What                | Forgotten                                    | The shopper sees                                                      |
| ------------------- | -------------------------------------------- | --------------------------------------------------------------------- |
| Security code (CVV) | 3 minutes after its last digit               | Its field asks for it again (`payment.card.cvv.errors.cleared`)       |
| The whole card      | 1 hour after the page loaded the card fields | "Your card details timed out" (`payment.card.errors.session_expired`) |

## When a payment does not go through

| What happened                         | The shopper sees                                                                                                                              |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| The card is declined                  | The reason in `checkout.errors.payment` (`payment.errors.<code>`, see [Language](../attribute-reference/setup/language.md)); the cart is kept |
| Not paid at the provider              | The checkout again with `?payment_failed=true` and the same cart                                                                              |
| Back from the provider without paying | The checkout as it was; paying again places a new order                                                                                       |

Events for each case: [Payment lifecycle](../event-reference/payments/lifecycle.md).
