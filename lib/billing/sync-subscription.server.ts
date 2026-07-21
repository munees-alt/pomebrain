import "server-only";
import type Stripe from "stripe";
import { getBillingPlan } from "@/lib/billing/plans";
import { createSupabaseAdminClient } from "@/lib/supabase-admin.server";

function appSubscriptionStatus(status: Stripe.Subscription.Status) {
  if (status === "active" || status === "trialing") return "active";
  if (status === "canceled" || status === "incomplete_expired") return "canceled";
  return "past_due";
}

function toIsoDate(unixSeconds: number | null | undefined) {
  return unixSeconds ? new Date(unixSeconds * 1000).toISOString() : null;
}

export async function syncStripeSubscription(subscription: Stripe.Subscription) {
  const workspaceId = subscription.metadata.workspace_id;
  const plan = getBillingPlan(subscription.metadata.plan_slug);
  if (!workspaceId || !plan) {
    throw new Error("Stripe subscription is missing valid Pomebrain workspace metadata.");
  }

  const periodStarts = subscription.items.data.map((item) => item.current_period_start).filter(Boolean);
  const periodEnds = subscription.items.data.map((item) => item.current_period_end).filter(Boolean);
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const priceId = subscription.items.data[0]?.price.id ?? null;

  const { error } = await createSupabaseAdminClient()
    .from("workspace_subscriptions")
    .upsert(
      {
        workspace_id: workspaceId,
        plan_slug: plan.slug,
        status: appSubscriptionStatus(subscription.status),
        monthly_build_limit: null,
        monthly_agent_execution_limit: plan.monthlyAgentActionLimit,
        trial_started_at: toIsoDate(subscription.trial_start),
        trial_ends_at: toIsoDate(subscription.trial_end),
        current_period_started_at: toIsoDate(periodStarts.length ? Math.min(...periodStarts) : null),
        current_period_ends_at: toIsoDate(periodEnds.length ? Math.max(...periodEnds) : null),
        external_customer_id: customerId,
        external_subscription_id: subscription.id,
        external_price_id: priceId,
        cancel_at_period_end: subscription.cancel_at_period_end,
      },
      { onConflict: "workspace_id" },
    );

  if (error) throw error;
}
