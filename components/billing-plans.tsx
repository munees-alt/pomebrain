"use client";

import { useState } from "react";
import { ArrowRight, Check, CreditCard, LoaderCircle, Sparkles } from "lucide-react";
import { billingPlans, formatPlanPrice, type BillingPlanSlug } from "@/lib/billing/plans";

type BillingEntitlement = {
  plan_slug: string;
  status: string;
  can_build: boolean;
  monthly_build_limit?: number | null;
  builds_used?: number;
  monthly_agent_execution_limit?: number | null;
  agent_executions_used?: number;
  current_period_ends_at?: string | null;
  cancel_at_period_end?: boolean;
  has_billing_account?: boolean;
};

export function BillingPlans({ entitlement }: { entitlement: BillingEntitlement | null }) {
  const [busyPlan, setBusyPlan] = useState<BillingPlanSlug | "portal" | null>(null);
  const [error, setError] = useState("");

  async function redirectFromBilling(endpoint: "checkout" | "portal", planSlug?: BillingPlanSlug) {
    setBusyPlan(endpoint === "portal" ? "portal" : planSlug ?? null);
    setError("");

    try {
      const response = await fetch(`/api/billing/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: endpoint === "checkout" ? JSON.stringify({ planSlug }) : undefined,
      });
      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload.url) throw new Error(payload.error ?? "Billing is temporarily unavailable.");
      window.location.assign(payload.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Billing is temporarily unavailable.");
      setBusyPlan(null);
    }
  }

  const paid = entitlement?.status === "active" && entitlement.plan_slug !== "free_trial";

  return (
    <section className="billing-section" id="plans">
      <div className="billing-heading">
        <div>
          <span className="section-label">POMEBRAIN AGENT PLANS</span>
          <h2>Keep your build team working.</h2>
          <p>Your first month includes the complete 19-agent network and 200 agent actions. Crown planning and projects are unlimited; your own API keys cover model and connector usage.</p>
        </div>
        {entitlement?.has_billing_account ? (
          <button className="manage-billing" type="button" onClick={() => void redirectFromBilling("portal")} disabled={busyPlan !== null}>
            {busyPlan === "portal" ? <LoaderCircle className="spin" size={15} /> : <CreditCard size={15} />}
            Manage billing
          </button>
        ) : null}
      </div>

      {paid ? (
        <div className="current-plan-summary">
          <Sparkles size={18} />
          <div>
            <span>CURRENT PLAN</span>
            <strong>{entitlement.plan_slug} · {(entitlement.agent_executions_used ?? 0).toLocaleString("en-US")} of {entitlement.monthly_agent_execution_limit?.toLocaleString("en-US") ?? "unlimited"} agent actions used</strong>
            <p>{entitlement.cancel_at_period_end ? "Access remains active until the end of this billing period." : "Your agent build access renews monthly."}</p>
          </div>
        </div>
      ) : null}

      <div className="pricing-grid">
        {billingPlans.map((plan) => {
          const isCurrent = paid && entitlement?.plan_slug === plan.slug;
          return (
            <article key={plan.slug} className={`pricing-card${plan.highlighted ? " pricing-featured" : ""}`}>
              {plan.highlighted ? <span className="popular-plan">MOST POPULAR</span> : null}
              <h3>{plan.name}</h3>
              <p>{plan.description}</p>
              <div className="plan-price"><strong>{formatPlanPrice(plan)}</strong><span>/ month</span></div>
              <div className="plan-capacity"><b>{plan.monthlyAgentActionLimit.toLocaleString("en-US")}</b> agent actions every month</div>
              <ul>
                {plan.features.map((feature) => <li key={feature}><Check size={14} /> {feature}</li>)}
              </ul>
              <button
                type="button"
                disabled={busyPlan !== null || isCurrent}
                onClick={() => void redirectFromBilling(paid && entitlement?.has_billing_account ? "portal" : "checkout", plan.slug)}
              >
                {busyPlan === plan.slug || busyPlan === "portal" ? <LoaderCircle className="spin" size={16} /> : isCurrent ? <Check size={16} /> : <ArrowRight size={16} />}
                {busyPlan === plan.slug || busyPlan === "portal" ? "Opening secure billing" : isCurrent ? "Current plan" : paid ? "Change plan" : "Choose plan"}
              </button>
            </article>
          );
        })}
      </div>
      <p className="billing-note">One agent action is one protected specialist completing one assigned task. Model tokens, hosting, and connector provider charges are paid directly through your own keys and accounts.</p>
      {error ? <p className="billing-error">{error}</p> : null}
    </section>
  );
}
