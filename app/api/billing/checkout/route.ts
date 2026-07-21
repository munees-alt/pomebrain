import { NextResponse } from "next/server";
import { getBillingPlan, stripePriceIdForPlan } from "@/lib/billing/plans";
import { getStripe } from "@/lib/billing/stripe.server";
import { createSupabaseServerClient, hasSupabaseServerEnv } from "@/lib/supabase-server";

function appOrigin(request: Request) {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || new URL(request.url).origin;
}

export async function POST(request: Request) {
  if (!hasSupabaseServerEnv()) {
    return NextResponse.json({ error: "The workspace service is unavailable." }, { status: 503 });
  }

  try {
    const { planSlug } = (await request.json()) as { planSlug?: unknown };
    const plan = getBillingPlan(planSlug);
    if (!plan) {
      return NextResponse.json({ error: "Choose a valid Pomebrain plan." }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: "Sign in before choosing a plan." }, { status: 401 });

    const workspaceId = user.app_metadata?.workspace_id;
    if (typeof workspaceId !== "string") {
      return NextResponse.json({ error: "Your account is missing its workspace." }, { status: 400 });
    }

    const { data: subscription } = await supabase
      .from("workspace_subscriptions")
      .select("external_customer_id,external_subscription_id,status")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (subscription?.external_subscription_id && subscription.status === "active") {
      return NextResponse.json({ error: "Your workspace already has an active plan. Use Manage billing to make changes." }, { status: 409 });
    }

    const { data: entitlementRows } = await supabase.rpc("get_workspace_entitlement_v2", { p_workspace_id: workspaceId });
    const entitlement = entitlementRows?.[0] as { trial_ends_at?: string | null } | undefined;
    const trialEnd = entitlement?.trial_ends_at ? Math.floor(new Date(entitlement.trial_ends_at).getTime() / 1000) : null;
    const minimumStripeTrialEnd = Math.floor(Date.now() / 1000) + 48 * 60 * 60;
    const stripePriceId = stripePriceIdForPlan(plan);
    const origin = appOrigin(request);
    const stripe = getStripe();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: subscription?.external_customer_id || undefined,
      customer_email: subscription?.external_customer_id ? undefined : user.email,
      client_reference_id: workspaceId,
      success_url: `${origin}/?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?billing=canceled`,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      metadata: { workspace_id: workspaceId, plan_slug: plan.slug },
      subscription_data: {
        metadata: { workspace_id: workspaceId, plan_slug: plan.slug },
        trial_end: trialEnd && trialEnd >= minimumStripeTrialEnd ? trialEnd : undefined,
      },
      line_items: [
        stripePriceId
          ? { price: stripePriceId, quantity: 1 }
          : {
              quantity: 1,
              price_data: {
                currency: plan.currency,
                unit_amount: plan.monthlyPriceCents,
                recurring: { interval: "month" },
                product_data: {
                  name: `Pomebrain ${plan.name}`,
                  description: `${plan.monthlyAgentActionLimit.toLocaleString("en-US")} protected agent actions per month. Model and connector usage is billed through the customer's own API keys.`,
                  metadata: { plan_slug: plan.slug },
                },
              },
            },
      ],
    });

    if (!session.url) throw new Error("Stripe did not return a checkout URL.");
    return NextResponse.json({ url: session.url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to start checkout." },
      { status: 500 },
    );
  }
}
