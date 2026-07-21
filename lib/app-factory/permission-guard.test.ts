import { describe, expect, it } from "vitest";
import { assertPrivilegedAppFactoryContext } from "@/lib/app-factory/permission-guard";

const userId = "00000000-0000-4000-8000-000000000001";
const workspaceId = "00000000-0000-4000-8000-000000000002";
const runId = "00000000-0000-4000-8000-000000000003";
const versionId = "00000000-0000-4000-8000-000000000004";

describe("privileged App Factory context", () => {
  it("accepts a fully scoped authenticated request", () => {
    expect(() => assertPrivilegedAppFactoryContext({ authenticatedUserId: userId, workspaceId, runWorkspaceId: workspaceId, runId, protectedAgentVersionId: versionId })).not.toThrow();
  });

  it("rejects a workspace mismatch before a service-role read", () => {
    expect(() => assertPrivilegedAppFactoryContext({ authenticatedUserId: userId, workspaceId, runWorkspaceId: userId, runId, protectedAgentVersionId: versionId })).toThrow(/outside the authenticated workspace/i);
  });
});
