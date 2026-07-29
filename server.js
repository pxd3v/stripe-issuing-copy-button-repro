require("dotenv").config();

const express = require("express");
const Stripe = require("stripe");

const PORT = process.env.PORT || 4242;
// ephemeralKeys.create requires an explicit apiVersion; override if your Stripe.js expects another.
const API_VERSION = process.env.STRIPE_API_VERSION || "2024-06-20";

const app = express();
app.use(express.json());
app.use(express.static("public"));

// Strips the quotes and stray whitespace people leave in .env files.
const env = (name) => {
  const raw = process.env[name];
  if (!raw) return null;
  const value = raw.trim().replace(/^["']|["']$/g, "");
  return value || null;
};

app.get("/config", (_req, res) => {
  res.json({
    publishableKey: env("STRIPE_PUBLISHABLE_KEY"),
    cardId: env("ISSUING_CARD_ID"),
    stripeAccount: env("STRIPE_ACCOUNT"),
    fullFlowConfigured: Boolean(env("STRIPE_SECRET_KEY") && env("ISSUING_CARD_ID")),
  });
});

// Mints the ephemeral key the Issuing display elements need. Mirrors the documented
// server side of https://docs.stripe.com/issuing/elements
app.post("/ephemeral-key", async (req, res) => {
  const { cardId, nonce } = req.body || {};

  if (!env("STRIPE_SECRET_KEY")) {
    return res.status(400).json({ error: "STRIPE_SECRET_KEY is not set" });
  }
  if (!cardId || !nonce) {
    return res.status(400).json({
      error: `cardId and nonce are required (received cardId=${cardId || "missing"}, nonce=${nonce || "missing"})`,
    });
  }

  try {
    const stripe = new Stripe(env("STRIPE_SECRET_KEY"));
    const requestOptions = { apiVersion: API_VERSION };
    if (env("STRIPE_ACCOUNT")) requestOptions.stripeAccount = env("STRIPE_ACCOUNT");

    const key = await stripe.ephemeralKeys.create({ issuing_card: cardId, nonce }, requestOptions);
    res.json({ ephemeralKeySecret: key.secret });
  } catch (error) {
    console.error("ephemeralKeys.create failed:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Repro running at http://localhost:${PORT}`);
  if (!env("STRIPE_PUBLISHABLE_KEY")) {
    console.warn("STRIPE_PUBLISHABLE_KEY is not set — copy .env.example to .env first.");
  }
  // dotenv reads .env once at boot, so an edited .env needs a restart to take effect.
  console.log("Edited .env? Restart this process.");
});
