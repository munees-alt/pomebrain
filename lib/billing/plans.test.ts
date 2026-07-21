import { describe, expect, it } from "vitest";
import { billingPlans, formatPlanPrice, getBillingPlan } from "@/lib/billing/plans";

describe("Pomebrain billing plans", () => {
  it("offers all paid tiers with increasing agent-action capacity", () => {
    expect(billingPlans.map((plan) => plan.slug)).toEqual(["builder", "pro", "studio"]);
    expect(billingPlans.map((plan) => plan.monthlyAgentActionLimit)).toEqual([200, 1_000, 5_000]);
    expect(billingPlans.every((plan) => plan.features.includes("All 19 protected agents"))).toBe(true);
    expect(billingPlans.every((plan) => plan.features.includes("Unlimited Crown plans and projects"))).toBe(true);
  });

  it("rejects unknown plans and formats the public monthly price", () => {
    expect(getBillingPlan("unknown")).toBeNull();
    expect(formatPlanPrice(getBillingPlan("builder")!)).toBe("$49");
  });
});
