const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertPrivilegedAppFactoryContext({
  authenticatedUserId,
  workspaceId,
  runWorkspaceId,
  runId,
  protectedAgentVersionId,
}: {
  authenticatedUserId: string;
  workspaceId: string;
  runWorkspaceId: string;
  runId: string;
  protectedAgentVersionId: string;
}) {
  const identifiers = { authenticatedUserId, workspaceId, runWorkspaceId, runId, protectedAgentVersionId };
  for (const [label, value] of Object.entries(identifiers)) {
    if (!UUID_PATTERN.test(value)) throw new Error(`Invalid ${label} in privileged App Factory request.`);
  }
  if (workspaceId !== runWorkspaceId) throw new Error("Privileged App Factory access is outside the authenticated workspace.");
}
