# Stripe Issuing `issuingCardCopyButton` — copy fails in Chrome (missing `clipboard-write`)

**The ask: add `clipboard-write` to the `allow` attribute Stripe.js sets on the
`issuingCardCopyButton` iframe.**

Stripe.js creates that iframe with `allow="payment *"`. Because `clipboard-write`'s
Permissions-Policy default allowlist is `self`, a cross-origin frame is denied the feature unless
the iframe element carries it. Chrome enforces this, so the clipboard write inside Stripe's frame is
blocked: nothing is copied, and the element's `click` event never fires — the integration gets no
error and no signal, so the success state never renders. Firefox and Safari do not enforce it and
work correctly.

Integrations cannot work around this. The attribute is on an iframe Stripe.js owns, and a frame's
Permissions Policy is snapshotted when its document navigates — setting the attribute after mount is
a no-op.

## Prior reports of this defect

This has been reported to Stripe at least twice and closed both times without the cause being
found — in each case the integration was blamed.

| Report | What was said | Outcome |
| --- | --- | --- |
| [stripe-js#449](https://github.com/stripe/stripe-js/issues/449) (May 2023) | "The copy button is not visible, and it is not copying to the clipboard… There are no errors in the console." The reporter also observed `https://r.stripe.com/0` — Stripe's own client error/telemetry endpoint — being called on each click. | Closed as completed, attributed to Angular's DOM handling. The reporter replied "still it's not working, copied data is not shown in the clipboard." Left closed. |
| [stripe-js#724](https://github.com/stripe/stripe-js/issues/724) (Mar 2025) | Copy of card details stopped working in an Android webview with no integration change. | Closed. "There have been no known changes to the issuing elements recently. I was able to test the copy functionality in my demo using Chrome." Reporter directed to support. The linked demo (`asi-issuing-elements.glitch.me`) now returns 410 Gone. |

Two things explain why the cause was missed both times, and why the report count is low:

1. **The failure is completely silent to the integration.** Stripe emits no `click` event and surfaces
   no error, so there is nothing to catch or log. #449's reporter explicitly noted an empty console.
2. **Until recently the browser said nothing either.** Chrome only began reporting
   `[Violation] Potential permissions policy violation: clipboard-write is not allowed in this document`
   in [Chrome 136+](https://chromestatus.com/feature/5154241037205504) (April 2025) — after #724 was
   closed. The denial itself is not new; only its diagnosability is.

That `r.stripe.com` call in #449 suggests Stripe's own client code was already catching an internal
error on click back in 2023, which is consistent with a rejected clipboard write.

## ⚠️ Read this before testing

**Steps 1 and 3 mount the copy button with no card data. Stripe has nothing to write, so the `click`
event fires normally even in Chrome. That is not the feature working.** Only step 2, with a real
card, exercises the clipboard write. This tripped up our own investigation for a full round.

## The definitive evidence — 2 minutes, no Issuing card needed

1. `npm install`
2. `cp .env.example .env`, set `STRIPE_PUBLISHABLE_KEY` to a test `pk_test_…`
3. `npm start`, open http://localhost:4242 in **Chrome**, click **Mount copy button only**
4. Chrome DevTools → **Application** → **Frames** → the `js.stripe.com` copy-button frame →
   **Permissions Policy**

Chrome reports, for Stripe's own frame:

```
Allowed Features:  … payment, picture-in-picture, …
Disabled Features: … clipboard-read, clipboard-write, …
```

`payment` is allowed because Stripe requests it. `clipboard-write` is disabled because Stripe does
not. The page's diagnostics panel prints the raw `allow` attribute alongside it.

## Reproducing the user-visible failure

Needs a test secret key and a **test-mode** Issuing card. A live-mode card id will not work with
test keys — `createEphemeralKeyNonce` returns no nonce.

1. Set `STRIPE_SECRET_KEY` (`sk_test_…`) in `.env`; set `STRIPE_ACCOUNT` (`acct_…`) too if the card
   lives on a connected account
2. `npm run seed-card` — creates a test cardholder and virtual card, prints an `ISSUING_CARD_ID`
3. Put that id in `.env` and restart the server
4. Click **Run full flow**, click the copy affordance, then paste into the box on the page

| Browser | Result |
| --- | --- |
| Chrome | Nothing copied. `numberCopy.on("click")` never fires, so no success state. No error reaches the integration. |
| Firefox | Copies correctly. |
| Safari | Copies correctly (intermittent in our production app). |

The page mirrors the documented integration at https://docs.stripe.com/issuing/elements exactly:
`createEphemeralKeyNonce` → server-side `ephemeralKeys.create` → `retrieveIssuingCard` →
`issuingCardNumberDisplay` + `issuingCardCopyButton` → `numberCopy.on("click")`.

## Ruled out, each by measurement

Listing these so they don't get re-litigated — every one cost us a round.

| Hypothesis | Verdict |
| --- | --- |
| Copy button iframe mis-sized or misaligned | **No.** Measured rect sits exactly on the icon, and `document.elementFromPoint()` at its centre returns the Stripe iframe. |
| The integration's CSS overrides | **No.** Step 3 reproduces forced `20x20` metrics and `position: static !important`; measured rect confirms they applied, and `click` still fires. |
| The integration steals focus from the frame | **No.** After the click, `document.activeElement` is the Stripe iframe and `document.hasFocus()` is `true`. |
| The integration's own click handler or state | **No.** Identical code in Safari sets the success attribute and re-renders correctly. |
| A restrictive `Permissions-Policy` response header on the embedding page | **No.** None present — and a header cannot grant `clipboard-write` to a cross-origin child frame regardless; the `allow` attribute is required. |

## Secondary issue: cursor

`cursor` over an iframe's area is controlled by that iframe's own document, so integrations cannot
give the copy affordance a `cursor: pointer`. Setting it inside the copy-button frame would fix it.

## Notes

No credentials are committed — `.env` is gitignored, `.env.example` holds placeholders. Use test
mode keys only; `seed-card` refuses to run against a live key.

MIT licensed.
