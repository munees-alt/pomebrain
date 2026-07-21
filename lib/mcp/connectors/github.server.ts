import "server-only";

import type { CapabilityRequest } from "@/lib/mcp/capabilities";
import { getWorkspaceConnectorConfig } from "@/lib/secrets/workspace-connector.server";

const GITHUB_API = "https://api.github.com";

export type RepositoryFile = { path: string; content: string };

function repositoryCoordinates(connector: Awaited<ReturnType<typeof getWorkspaceConnectorConfig>>) {
  if (!connector) throw new Error("Connect your GitHub personal access token before agents write code.");
  const owner = typeof connector.metadata.owner === "string" ? connector.metadata.owner.trim() : "";
  const repo = typeof connector.metadata.repo === "string" ? connector.metadata.repo.trim() : "";
  const baseBranch = typeof connector.metadata.base_branch === "string" ? connector.metadata.base_branch.trim() : "main";
  if (!owner || !repo) throw new Error("Add the GitHub owner and repository in Connectors before agents write code.");
  return { connector, owner, repo, baseBranch };
}

function validateRepositoryFiles(files: RepositoryFile[]) {
  if (!files.length) throw new Error("The build agent did not return any repository files.");
  if (files.length > 40) throw new Error("A single agent action can write at most 40 files.");
  let totalBytes = 0;
  const seen = new Set<string>();
  for (const file of files) {
    const path = file.path.replaceAll("\\", "/").replace(/^\/+/, "");
    if (!path || path.includes("..") || path.startsWith(".git/") || /(^|\/)\.env($|\.)/i.test(path)) {
      throw new Error(`Unsafe repository path returned by build agent: ${file.path}`);
    }
    if (seen.has(path)) throw new Error(`Duplicate repository path returned by build agent: ${path}`);
    seen.add(path);
    file.path = path;
    totalBytes += Buffer.byteLength(file.content, "utf8");
  }
  if (totalBytes > 500_000) throw new Error("A single agent action can write at most 500 KB of source files.");
}

async function githubRequest(token: string, path: string, init: RequestInit = {}) {

  const response = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(`GitHub ${init.method ?? "GET"} ${path} failed (${response.status}): ${body?.message ?? text}`);
  }

  return body;
}

export async function getWorkspaceGitHubRepository(workspaceId: string) {
  const connector = await getWorkspaceConnectorConfig(workspaceId, "github", "personal_access_token");
  const { owner, repo, baseBranch } = repositoryCoordinates(connector);
  return { owner, repo, baseBranch };
}

export async function verifyWorkspaceGitHubConnection(workspaceId: string) {
  const config = repositoryCoordinates(await getWorkspaceConnectorConfig(workspaceId, "github", "personal_access_token"));
  const { connector, owner, repo, baseBranch } = config;
  const repository = await githubRequest(connector.secret, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
  await githubRequest(connector.secret, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/ref/heads/${encodeURIComponent(baseBranch)}`);
  return { provider: "github" as const, account: repository.full_name as string, repositoryUrl: repository.html_url as string, baseBranch };
}

export async function commitFilesToWorkspaceRepository({
  workspaceId,
  runId,
  files,
  message,
}: {
  workspaceId: string;
  runId: string;
  files: RepositoryFile[];
  message: string;
}) {
  validateRepositoryFiles(files);
  const config = repositoryCoordinates(await getWorkspaceConnectorConfig(workspaceId, "github", "personal_access_token"));
  const { connector, owner, repo, baseBranch } = config;
  const branch = `pomebrain/${runId.replace(/[^a-z0-9-]/gi, "-").toLowerCase()}`.slice(0, 100);
  const baseRef = await githubRequest(connector.secret, `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(baseBranch)}`);

  try {
    await githubRequest(connector.secret, `/repos/${owner}/${repo}/git/refs`, {
      method: "POST",
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseRef.object.sha }),
    });
  } catch (cause) {
    if (!(cause instanceof Error) || !cause.message.includes("Reference already exists")) throw cause;
  }

  const branchRef = await githubRequest(connector.secret, `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`);
  const branchCommit = await githubRequest(connector.secret, `/repos/${owner}/${repo}/git/commits/${branchRef.object.sha}`);

  const tree = [];
  for (const file of files) {
    const blob = await githubRequest(connector.secret, `/repos/${owner}/${repo}/git/blobs`, {
      method: "POST",
      body: JSON.stringify({ content: file.content, encoding: "utf-8" }),
    });
    tree.push({ path: file.path, mode: "100644", type: "blob", sha: blob.sha });
  }
  const createdTree = await githubRequest(connector.secret, `/repos/${owner}/${repo}/git/trees`, {
    method: "POST",
    body: JSON.stringify({ base_tree: branchCommit.tree.sha, tree }),
  });
  const commit = await githubRequest(connector.secret, `/repos/${owner}/${repo}/git/commits`, {
    method: "POST",
    body: JSON.stringify({ message, tree: createdTree.sha, parents: [branchRef.object.sha] }),
  });
  await githubRequest(connector.secret, `/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha, force: false }),
  });

  return {
    owner,
    repo,
    branch,
    commitSha: commit.sha as string,
    commitUrl: `https://github.com/${owner}/${repo}/commit/${commit.sha}`,
    fileCount: files.length,
  };
}

async function handlePullRequestCreate(request: Extract<CapabilityRequest, { capabilityId: "github.pull_requests.create" }>) {
  const { owner, repo, title, headBranch, baseBranch, bodyDescription } = request.payload;
  const connector = await getWorkspaceConnectorConfig(request.metadata.workspaceId ?? "", "github", "personal_access_token");
  if (!connector) throw new Error("Connect your GitHub personal access token before agents use GitHub.");

  const pr = await githubRequest(connector.secret, `/repos/${owner}/${repo}/pulls`, {
    method: "POST",
    body: JSON.stringify({ title, head: headBranch, base: baseBranch, body: bodyDescription }),
  });

  return { number: pr.number, url: pr.html_url, state: pr.state };
}

async function handleBranchMerge(request: Extract<CapabilityRequest, { capabilityId: "github.branches.merge" }>) {
  const { owner, repo, headBranch, baseBranch, pullRequestNumber } = request.payload;
  const connector = await getWorkspaceConnectorConfig(request.metadata.workspaceId ?? "", "github", "personal_access_token");
  if (!connector) throw new Error("Connect your GitHub personal access token before agents use GitHub.");

  if (pullRequestNumber) {
    const result = await githubRequest(connector.secret, `/repos/${owner}/${repo}/pulls/${pullRequestNumber}/merge`, { method: "PUT" });
    return { merged: result.merged, sha: result.sha, message: result.message };
  }

  const result = await githubRequest(connector.secret, `/repos/${owner}/${repo}/merges`, {
    method: "POST",
    body: JSON.stringify({ base: baseBranch, head: headBranch }),
  });

  return { sha: result.sha, message: "Branch merged directly (no pull request)." };
}

export async function executeGitHubCapability(request: CapabilityRequest) {
  switch (request.capabilityId) {
    case "github.pull_requests.create":
      return handlePullRequestCreate(request);
    case "github.branches.merge":
      return handleBranchMerge(request);
    default:
      throw new Error(`GitHub connector cannot handle capability "${request.capabilityId}".`);
  }
}
