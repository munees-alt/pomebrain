import "server-only";

import type { CapabilityRequest } from "@/lib/mcp/capabilities";

const GITHUB_TOKEN = process.env.POMEBRAIN_GITHUB_PAT;
const GITHUB_API = "https://api.github.com";

function assertConfigured() {
  if (!GITHUB_TOKEN) {
    throw new Error("GitHub connector is not configured: missing POMEBRAIN_GITHUB_PAT.");
  }
}

async function githubRequest(path: string, init: RequestInit = {}) {
  assertConfigured();

  const response = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
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

async function handlePullRequestCreate(request: Extract<CapabilityRequest, { capabilityId: "github.pull_requests.create" }>) {
  const { owner, repo, title, headBranch, baseBranch, bodyDescription } = request.payload;

  const pr = await githubRequest(`/repos/${owner}/${repo}/pulls`, {
    method: "POST",
    body: JSON.stringify({ title, head: headBranch, base: baseBranch, body: bodyDescription }),
  });

  return { number: pr.number, url: pr.html_url, state: pr.state };
}

async function handleBranchMerge(request: Extract<CapabilityRequest, { capabilityId: "github.branches.merge" }>) {
  const { owner, repo, headBranch, baseBranch, pullRequestNumber } = request.payload;

  if (pullRequestNumber) {
    const result = await githubRequest(`/repos/${owner}/${repo}/pulls/${pullRequestNumber}/merge`, { method: "PUT" });
    return { merged: result.merged, sha: result.sha, message: result.message };
  }

  const result = await githubRequest(`/repos/${owner}/${repo}/merges`, {
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
