import "server-only";
import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function hasStripeEnv() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Stripe billing is not configured yet.");
  }

  stripeClient ??= new Stripe(secretKey);
  return stripeClient;
}
