require("dotenv").config();

const Stripe = require("stripe");

// Creates a test-mode cardholder + virtual Issuing card so the full flow has real card
// data to copy. A live-mode card id cannot be used with test keys.
async function main() {
  const secret = (process.env.STRIPE_SECRET_KEY || "").trim().replace(/^["']|["']$/g, "");
  if (!secret) throw new Error("STRIPE_SECRET_KEY is not set in .env");
  if (!secret.startsWith("sk_test_")) {
    throw new Error("Refusing to run: STRIPE_SECRET_KEY is not a test key (expected sk_test_…)");
  }

  const account = (process.env.STRIPE_ACCOUNT || "").trim().replace(/^["']|["']$/g, "");
  const options = account ? { stripeAccount: account } : {};
  const stripe = new Stripe(secret);

  console.log(account ? `Using connected account ${account}` : "Using the platform account");

  const cardholder = await stripe.issuing.cardholders.create(
    {
      name: "Repro Cardholder",
      email: "repro@example.com",
      phone_number: "+15555550100",
      status: "active",
      type: "individual",
      billing: {
        address: {
          line1: "510 Townsend St",
          city: "San Francisco",
          state: "CA",
          postal_code: "94103",
          country: "US",
        },
      },
    },
    options,
  );
  console.log("cardholder:", cardholder.id);

  const card = await stripe.issuing.cards.create(
    { cardholder: cardholder.id, currency: "usd", type: "virtual", status: "active" },
    options,
  );

  console.log("");
  console.log("Set this in your .env, then restart the server:");
  console.log(`ISSUING_CARD_ID=${card.id}`);
}

main().catch((error) => {
  console.error("");
  console.error("Failed:", error.message);
  console.error("");
  console.error("If Issuing is not enabled on this test account, enable it in the Stripe");
  console.error("dashboard (test mode) or use an account that already has Issuing.");
  process.exit(1);
});
