# Stripe Issuing `issuingCardCopyButton` — copy fails in Chrome

**Status: cause not yet confirmed. Do not treat this as a filed Stripe bug.** This repo is the
harness for isolating it.

An integration's copy button does not copy in Chrome: nothing lands on the clipboard and the
element's `click` event never fires, so the success state never renders. The same code works in
Firefox and is intermittent in Safari. This harness runs the documented integration in isolation so
the failing variable can be found by bisection.

## What is measured so far

| Observation | Detail |
| --- | --- |
| The element's iframe has `allow="payment *"` | No `clipboard-write`. `clipboard-write`'s Permissions-Policy default allowlist is `self`, so a cross-origin frame is denied it unless the iframe element carries it. |
| **But `click` still fires here** | Mounted standalone with that same `allow` value, `numberCopy.on("click")` fires normally — so the missing permission alone does not explain a missing `click`. |
| Clicks reach the frame | `document.elementFromPoint()` at the icon's centre returns the Stripe iframe. |
| The frame keeps focus | After the click, `document.activeElement` is the iframe and `document.hasFocus()` is `true`. Nothing steals focus. |

## The two candidates, and the test that separates them

1. **The integration's CSS.** In the failing app the iframe is forced to `20x20` with
   `height`/`width`/`position: static` at `!important`, inside an absolutely positioned mount
   target with a sibling icon. Left alone, Stripe sizes the frame itself (`24 x 16.8` here).
   → **Step 3** below reproduces those overrides. If `click` stops firing, this is the cause.

2. **The clipboard permission after all.** Step 1 mounts the button with *no card data*, so Stripe
   may skip the clipboard entirely and emit `click` on a nothing-to-copy path. With a real card the
   write would actually be attempted, and could reject.
   → **Step 2** below, with a real test card, settles it. If `click` fires there and the paste box
   receives the number, this candidate is dead.

Run step 3 and step 2. Between them they eliminate one candidate.

## Setup

1. `npm install`
2. `cp .env.example .env` and set `STRIPE_PUBLISHABLE_KEY` to a test `pk_test_…`
3. `npm start`
4. Open http://localhost:4242 in **Chrome**

`dotenv` reads `.env` at boot — restart the server after editing it.

## Step 1 — mount the copy button only

Needs only the publishable key. Prints the iframe's `allow` attribute, rect, and hit test.

## Step 2 — the full documented flow

Needs a test secret key and a **test-mode** Issuing card. A live-mode card id will not work with
test keys — `createEphemeralKeyNonce` returns no nonce.

1. Set `STRIPE_SECRET_KEY` (`sk_test_…`) in `.env`. Set `STRIPE_ACCOUNT` (`acct_…`) too if the card
   lives on a connected account.
2. `npm run seed-card` — creates a test cardholder and virtual card, prints an `ISSUING_CARD_ID`
3. Put that id in `.env` and restart the server
4. Click **Run full flow**, click the copy affordance, then paste into the box on the page

## Step 3 — mount with the integration's CSS overrides

Same Stripe code as step 1, wrapped in the failing app's structure and forced iframe metrics.
Compare whether `click` fires against step 1.

## Ruled out

| Hypothesis | Verdict |
| --- | --- |
| Copy icon hit area mis-sized or misaligned | **No.** Rect sits exactly on the icon; hit test returns the Stripe iframe. |
| A focus trap steals focus from the frame | **No.** The frame holds focus, `hasFocus` is `true`. |
| A restrictive `Permissions-Policy` response header | **No.** None present, and a header cannot grant `clipboard-write` to a cross-origin child frame regardless. |

## Notes

`cursor` over an iframe's area is controlled by that iframe's own document, so an integration cannot
make the copy affordance show `cursor: pointer`.

No credentials are committed — `.env` is gitignored and `.env.example` holds placeholders. Use test
mode keys only. `seed-card` refuses to run against a live key.

MIT licensed.
