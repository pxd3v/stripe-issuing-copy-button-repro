# Harness: isolating a Stripe Issuing copy-button failure

**Stripe's `issuingCardCopyButton` is NOT at fault. This harness proves it works.** Do not send this
to Stripe as a bug report. It exists to eliminate hypotheses about a copy failure seen in one
specific application, and its most useful result so far is a long list of things that are *not* the
cause.

## The failure being chased

In a production React app, the Stripe Issuing copy button does not copy in Chrome: nothing reaches
the clipboard and `numberCopy.on("click")` never fires, so no success state renders. The same code
works in Firefox and Safari.

## What this harness establishes

Running the documented integration with **real test card data**, in Chromium, with no permission
grants of any kind:

```
click event : FIRED
pasted      : 16 chars, starts "40…"     (verified by a real keyboard paste)
```

**The copy works.** So the cause is something this harness does not yet reproduce.

## Eliminated hypotheses

Every one of these was measured, and several were believed to be the answer at some point. Recorded
so nobody re-treads them.

| Hypothesis | Verdict |
| --- | --- |
| Copy iframe mis-sized, clicks missing it | **No.** Measured rect sits exactly on the icon; `document.elementFromPoint()` at its centre returns the Stripe iframe. |
| The app's CSS overrides on the iframe | **No.** Step 3 reproduces forced `20x20` metrics and `position: static !important` — rect confirms they applied — and the click still fires. |
| The app steals focus from the frame | **No.** After the click, `document.activeElement` is the Stripe iframe and `document.hasFocus()` is `true`. |
| The app's click handler or React state | **No.** The identical app code works in Safari, setting its success attribute and re-rendering. |
| **Stripe's iframe lacks `clipboard-write`** | **No — this is a red herring.** It genuinely is absent (`allow="payment *"`), and Chrome DevTools → Application → Frames → Permissions Policy genuinely lists `clipboard-write` under Disabled Features for that frame. **But the copy works anyway**, so Stripe is not using the permission-gated async Clipboard API. Do not report this to Stripe. |
| A restrictive `Permissions-Policy` response header | **No.** None present, and a header cannot grant `clipboard-write` to a cross-origin child frame regardless. |

### The trap that cost two rounds

Mounting the copy button with **no card data** makes Stripe emit `click` with no clipboard call at
all. That false pass is not evidence of anything. Steps 1 and 3 both do this. Only step 2 exercises
a real write.

## What has not been reproduced yet

The failing app renders the copy button inside a **Chakra UI Modal/Drawer** — a React portal with an
overlay, `aria-hidden` applied to outside content, scroll locking, and `react-focus-lock`. None of
that is reproduced here. It is the largest remaining structural difference.

## Setup

1. `npm install`
2. `cp .env.example .env` and fill in `STRIPE_PUBLISHABLE_KEY` (test `pk_test_…`)
3. `npm start`, open http://localhost:4242

`dotenv` reads `.env` at boot — restart after editing it. Values are trimmed of stray quotes and
whitespace, which is worth knowing: an untrimmed card id makes `createEphemeralKeyNonce` return no
nonce with no useful error.

## The three modes

| Mode | Needs | Shows |
| --- | --- | --- |
| 1. Mount copy button only | publishable key | The iframe's `allow`, rect, and hit test. **Fires `click` with no card data — not a pass.** |
| 2. Run full flow | secret key + test Issuing card | The real thing. `npm run seed-card` creates a test-mode card; a live-mode card id will not work with test keys. |
| 3. Mount with the app's CSS | publishable key | Same as 1, wrapped in the failing app's structure and forced iframe metrics. |

Both keys must come from the **same** Stripe platform, and `STRIPE_ACCOUNT` (`acct_…`) is required if
the card lives on a connected account.

## Secondary observation

`cursor` over an iframe's area is controlled by that iframe's own document, so an integration cannot
give the copy affordance a `cursor: pointer`. Cosmetic, and genuinely Stripe-side.

## Notes

No credentials committed — `.env` is gitignored, `.env.example` holds placeholders. Test mode only;
`seed-card` refuses to run against a live key.

MIT licensed.
