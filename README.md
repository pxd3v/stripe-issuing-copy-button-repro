# Stripe Issuing `issuingCardCopyButton` — copy silently fails in Chrome

**TL;DR:** Stripe.js mounts the `issuingCardCopyButton` element into an iframe created with
`allow="payment *"`. It has no `clipboard-write`. Because `clipboard-write`'s Permissions-Policy
default allowlist is `self`, Chrome denies the clipboard write inside that cross-origin frame, so
clicking the button copies nothing and the element's `click` event never fires. Firefox and Safari
permit clipboard access in iframes by default, so the same code works there.

**The fix we're asking for:** add `clipboard-write` to the `allow` attribute Stripe.js sets on the
copy-button iframe.

Integrations cannot work around this. The `allow` attribute is on an iframe Stripe.js creates and
owns, and a frame's Permissions Policy is snapshotted when its document navigates — so setting the
attribute after mount is a no-op unless the frame is forced to re-navigate.

---

## Reproduce in 2 minutes (no server, no Issuing card needed)

This part proves the missing permission. It needs only a **test-mode publishable key**.

1. `npm install`
2. `cp .env.example .env` and set `STRIPE_PUBLISHABLE_KEY` to your test `pk_test_…`
3. `npm start`
4. Open http://localhost:4242 in **Chrome** and click **Mount copy button only**

The diagnostics panel prints the copy-button iframe's `allow` attribute. Observed:

```
allow: payment *
```

Expected: `allow` includes `clipboard-write`.

## Reproduce the user-visible failure (needs a test Issuing card)

This part shows the actual broken copy. It needs a test-mode secret key and a test Issuing card id.

1. In `.env`, also set `STRIPE_SECRET_KEY` (`sk_test_…`) and `ISSUING_CARD_ID` (`ic_…`).
   Set `STRIPE_ACCOUNT` (`acct_…`) too if the card lives on a connected account.
2. `npm start`
3. Open http://localhost:4242 and click **Run full flow**
4. Click the copy button, then paste somewhere

| Browser | Result |
| --- | --- |
| Chrome | Nothing is copied. `numberCopy.on("click")` never fires, so the success state never renders. No error surfaces to the integration. |
| Firefox | Copies correctly. |
| Safari | Intermittent — sometimes copies after several clicks. |

The page mirrors the documented integration from
https://docs.stripe.com/issuing/elements exactly: `createEphemeralKeyNonce` →
server-side `ephemeralKeys.create` → `retrieveIssuingCard` →
`issuingCardNumberDisplay` + `issuingCardCopyButton` → `numberCopy.on("click")`.

## What we ruled out

These were each measured, not assumed. Listing them so they don't get re-litigated.

| Hypothesis | Result |
| --- | --- |
| Copy button iframe mis-sized or misaligned, clicks missing it | **Ruled out.** Measured `getBoundingClientRect()` is exactly the icon's box, and `document.elementFromPoint()` at its centre returns the Stripe iframe. |
| Our page steals focus from the frame (focus trap) | **Ruled out.** After the click, `document.activeElement` is the Stripe iframe and `document.hasFocus()` is `true`. It keeps focus. |
| A restrictive `Permissions-Policy` response header on our page | **Ruled out.** No such header. And a header alone cannot grant `clipboard-write` to a cross-origin child frame — the `allow` attribute on the iframe element is required. |
| Our CSS on the iframe interfering | **Ruled out.** Stripe.js sets `width`/`min-width` inline with `!important`, which beats any stylesheet rule, so integration CSS on the iframe largely does not apply anyway. |

## Secondary issue: cursor

`cursor` over an iframe's area is controlled by that iframe's own document, so integrations cannot
make the copy affordance show `cursor: pointer`. Stripe.js setting `cursor: pointer` inside the
copy-button frame would fix that.

## Notes

No credentials are committed. `.env` is gitignored; `.env.example` holds placeholders only. Use
**test mode** keys — never a live key, and never a real card.

MIT licensed.
