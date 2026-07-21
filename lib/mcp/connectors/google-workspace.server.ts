import "server-only";

import crypto from "node:crypto";
import type { CapabilityRequest } from "@/lib/mcp/capabilities";
import { googleConnectorEnv } from "@/lib/oauth/google-workspace.server";

const GOOGLE_DRIVE_API = "https://www.googleapis.com/drive/v3";
const GOOGLE_DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const GOOGLE_GMAIL_API = "https://gmail.googleapis.com/gmail/v1";

async function getRefreshToken(workspaceId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Google execution is unavailable because Supabase service credentials are missing.");

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_workspace_oauth_refresh_token`, {
    method: "POST",
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_workspace_id: workspaceId, p_provider: "google_workspace" }),
  });
  if (!response.ok) throw new Error(`Could not load the Google connection (${response.status}).`);
  const refreshToken = (await response.json()) as unknown;
  if (typeof refreshToken !== "string" || !refreshToken) throw new Error("Connect Google Workspace before agents use Drive or Gmail.");
  return refreshToken;
}

async function getAccessToken(workspaceId: string) {
  const refreshToken = await getRefreshToken(workspaceId);
  const { clientId, clientSecret } = googleConnectorEnv();
  if (!clientId || !clientSecret) throw new Error("Google OAuth is not configured on the server.");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
  });
  const payload = (await response.json()) as { access_token?: string; error_description?: string; error?: string };
  if (!response.ok || !payload.access_token) throw new Error(payload.error_description ?? payload.error ?? "Google token refresh failed.");
  return payload.access_token;
}

async function googleRequest(accessToken: string, url: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, ...(init.headers ?? {}) },
  });
  const text = await response.text();
  let body: unknown = text;
  try { body = text ? JSON.parse(text) : null; } catch { /* Non-JSON file content is valid. */ }
  if (!response.ok) {
    const message = body && typeof body === "object" && "error" in body
      ? JSON.stringify((body as { error: unknown }).error)
      : text;
    throw new Error(`Google API request failed (${response.status}): ${message}`);
  }
  return body;
}

async function executeDriveRead(request: Extract<CapabilityRequest, { capabilityId: "google.drive.read" }>) {
  const accessToken = await getAccessToken(request.metadata.workspaceId ?? "");
  if (request.payload.fileId) {
    const metadata = await googleRequest(accessToken, `${GOOGLE_DRIVE_API}/files/${encodeURIComponent(request.payload.fileId)}?fields=id,name,mimeType,size,modifiedTime,webViewLink`) as { size?: string };
    if (metadata.size && Number(metadata.size) > 200_000) throw new Error("Google Drive reads are limited to 200 KB per agent action.");
    const content = await googleRequest(accessToken, `${GOOGLE_DRIVE_API}/files/${encodeURIComponent(request.payload.fileId)}?alt=media`);
    const safeContent = typeof content === "string" ? content.slice(0, 200_000) : content;
    return { metadata, content: safeContent, truncated: typeof content === "string" && content.length > 200_000 };
  }

  const clauses = ["trashed = false"];
  if (request.payload.folderId) clauses.push(`'${request.payload.folderId.replaceAll("'", "\\'")}' in parents`);
  if (request.payload.query) clauses.push(`name contains '${request.payload.query.replaceAll("'", "\\'")}'`);
  const params = new URLSearchParams({ q: clauses.join(" and "), pageSize: "50", fields: "files(id,name,mimeType,size,modifiedTime,webViewLink,parents)" });
  return googleRequest(accessToken, `${GOOGLE_DRIVE_API}/files?${params}`);
}

async function executeDriveWrite(request: Extract<CapabilityRequest, { capabilityId: "google.drive.write" }>) {
  const accessToken = await getAccessToken(request.metadata.workspaceId ?? "");
  const digest = crypto.createHash("sha256").update(request.payload.content, "utf8").digest("hex");
  if (digest.toLowerCase() !== request.payload.contentDigest.toLowerCase()) {
    throw new Error("Google Drive content failed its SHA-256 integrity check.");
  }
  const metadata = await googleRequest(accessToken, `${GOOGLE_DRIVE_API}/files?fields=id,name,mimeType,webViewLink`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: request.payload.fileName, mimeType: request.payload.mimeType, parents: [request.payload.folderId] }),
  }) as { id?: string };
  if (!metadata.id) throw new Error("Google Drive did not return a file ID.");
  await googleRequest(accessToken, `${GOOGLE_DRIVE_UPLOAD_API}/files/${encodeURIComponent(metadata.id)}?uploadType=media`, {
    method: "PATCH",
    headers: { "Content-Type": request.payload.mimeType },
    body: request.payload.content,
  });
  return metadata;
}

function base64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

async function executeGmailSend(request: Extract<CapabilityRequest, { capabilityId: "google.gmail.send" }>) {
  const accessToken = await getAccessToken(request.metadata.workspaceId ?? "");
  const headers = [
    `To: ${request.payload.to.join(", ")}`,
    request.payload.cc?.length ? `Cc: ${request.payload.cc.join(", ")}` : null,
    `Subject: ${request.payload.subject.replace(/[\r\n]+/g, " ")}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "",
    request.payload.bodyPreview,
  ].filter((value): value is string => value !== null);
  return googleRequest(accessToken, `${GOOGLE_GMAIL_API}/users/me/messages/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ raw: base64Url(headers.join("\r\n")) }),
  });
}

export async function executeGoogleWorkspaceCapability(request: CapabilityRequest) {
  switch (request.capabilityId) {
    case "google.drive.read": return executeDriveRead(request);
    case "google.drive.write": return executeDriveWrite(request);
    case "google.gmail.send": return executeGmailSend(request);
    default: throw new Error(`Google Workspace connector cannot handle capability "${request.capabilityId}".`);
  }
}
