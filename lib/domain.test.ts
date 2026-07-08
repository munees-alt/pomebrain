import { describe, expect, it } from "vitest";
import { createCrownPlan } from "@/lib/crown-planner";

describe("Pomebrain domain contracts", () => {
  it("routes a finance build to the imported Batch 1 agents", () => {
    const run = createCrownPlan("Build an invoice approval dashboard for a finance team");
    expect(run.agents).toContain("Pomebrain Architect Orchestrator");
    expect(run.agents).toContain("Brief Synthesizer");
    expect(run.agents).toContain("Database Schema Provisioner");
    expect(run.agents).toContain("NextJS Boilerplate Architect");
    expect(run.agents).toContain("Playwright E2E Tester");
    expect(run.skills).toContain("Recursive Task Resolution Loop");
    expect(run.status).toBe("awaiting_approval");
    expect(run.steps).toHaveLength(7);
  });

  it("rejects goals that are too vague", () => {
    expect(() => createCrownPlan("Build it")).toThrow();
  });
});
