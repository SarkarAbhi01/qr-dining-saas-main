let stripeClient = null;

/**
 * Whether online payment is actually usable right now. True only when
 * STRIPE_SECRET_KEY is set to something that looks like a real key —
 * not empty, and not the literal placeholder from .env.example — so a
 * fresh deploy that hasn't configured Stripe yet fails gracefully
 * ("not available") instead of crashing when a customer taps Pay Online.
 */
function isStripeConfigured() {
  const key = process.env.STRIPE_SECRET_KEY;
  return Boolean(key && key.startsWith('sk_') && !key.includes('xxxx'));
}

function getStripeClient() {
  if (!isStripeConfigured()) return null;
  if (!stripeClient) {
    // Required lazily so environments without the key configured never
    // even attempt to construct a Stripe instance.
    const Stripe = require('stripe');
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripeClient;
}

module.exports = { isStripeConfigured, getStripeClient };
