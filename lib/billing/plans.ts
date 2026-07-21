export const billingPlanSlugs = ["builder", "pro", "studio"] as const;

export type BillingPlanSlug = (typeof billingPlanSlugs)[number];

export type BillingPlan = {
  slug: BillingPlanSlug;
  name: string;
  description: string;
  monthlyPriceCents: number;
  currency: "usd";
  monthlyAgentActionLimit: number;
  highlighted?: boolean;
  features: string[];
};

export const billingPlans: BillingPlan[] = [
  {
    slug: "builder",
    name: "Builder",
    description: "For founders turning focused ideas into working products.",
    monthlyPriceCents: 4_900,
    currency: "usd",
    monthlyAgentActionLimit: 200,
    features: ["All 19 protected agents", "200 agent actions each month", "Unlimited Crown plans and projects", "Customer-owned API keys and connectors"],
  },
  {
    slug: "pro",
    name: "Pro",
    description: "For teams shipping and improving products every week.",
    monthlyPriceCents: 14_900,
    currency: "usd",
    monthlyAgentActionLimit: 1_000,
    highlighted: true,
    features: ["All 19 protected agents", "1,000 agent actions each month", "Unlimited Crown plans and projects", "Approval-gated execution"],
  },
  {
    slug: "studio",
    name: "Studio",
    description: "For agencies and product studios running multiple builds.",
    monthlyPriceCents: 39_900,
    currency: "usd",
    monthlyAgentActionLimit: 5_000,
    features: ["All 19 protected agents", "5,000 agent actions each month", "Unlimited Crown plans and projects", "Built for multiple client projects"],
  },
];

export function getBillingPlan(slug: unknown) {
  return billingPlans.find((plan) => plan.slug === slug) ?? null;
}

export function formatPlanPrice(plan: BillingPlan) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: plan.currency,
    maximumFractionDigits: 0,
  }).format(plan.monthlyPriceCents / 100);
}

export function stripePriceIdForPlan(plan: BillingPlan) {
  const keys: Record<BillingPlanSlug, string> = {
    builder: "STRIPE_PRICE_BUILDER",
    pro: "STRIPE_PRICE_PRO",
    studio: "STRIPE_PRICE_STUDIO",
  };

  return process.env[keys[plan.slug]]?.trim() || null;
}
