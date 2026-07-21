import { describe, expect, it } from "vitest";
import { inferConnectorRequirements, planUniversalConnectors } from "@/lib/connectors/universal-catalog";

describe("universal connector catalog", () => {
  it("maps app goals to connector-agnostic build requirements", () => {
    const requirements = inferConnectorRequirements(
      "Build a client portal with login, document uploads, email reminders, CSV exports, analytics, and a live URL",
    );

    expect(requirements).toContain("auth");
    expect(requirements).toContain("file_storage");
    expect(requirements).toContain("email_delivery");
    expect(requirements).toContain("spreadsheet_data");
    expect(requirements).toContain("analytics");
    expect(requirements).toContain("app_hosting");
  });

  it("offers available customer connectors with live executable capabilities", () => {
    const plan = planUniversalConnectors("Build a document workflow with uploaded files and Google Drive source material", {
      google: true,
      supabase: false,
    });
    const fileStorage = plan.find((requirement) => requirement.requirement === "file_storage");

    expect(fileStorage?.candidates.map((candidate) => candidate.connectorId)).toContain("supabase_connector");
    expect(fileStorage?.candidates.map((candidate) => candidate.connectorId)).toContain("google_workspace_connector");
    expect(fileStorage?.candidates.find((candidate) => candidate.connectorId === "supabase_connector")?.ready).toBe(false);
    expect(fileStorage?.candidates.find((candidate) => candidate.connectorId === "google_workspace_connector")?.ready).toBe(true);
  });
});
