import "server-only";

import crypto from "node:crypto";

export const GOOGLE_WORKSPACE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/gmail.send",
] as const;

export type GoogleTokenResponse = {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type: string;
  id_token?: string;
};

export type GoogleUserInfo = {
  email?: string;
};

export function googleConnectorEnv() {
  const clientId = process.env.POMEBRAIN_GOOGLE_CLIENT_ID ?? process.env.GOOGLE_CONNECTOR_CLIENT_ID;
  const clientSecret = process.env.POMEBRAIN_GOOGLE_CLIENT_SECRET ?? process.env.GOOGLE_CONNECTOR_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  const redirectUri =
    process.env.POMEBRAIN_GOOGLE_REDIRECT_URI ??
    process.env.GOOGLE_CONNECTOR_REDIRECT_URI ??
    (appUrl ? `${appUrl}/api/connectors/google/callback` : undefined);

  return { clientId, clientSecret, redirectUri };
}

export function hasGoogleConnectorEnv() {
  const env = googleConnectorEnv();
  return Boolean(env.clientId && env.clientSecret && env.redirectUri);
}

export function createGoogleOAuthState() {
  return crypto.randomBytes(24).toString("base64url");
}

export function createGoogleAuthorizationUrl({ state }: { state: string }) {
  const { clientId, redirectUri } = googleConnectorEnv();
  if (!clientId || !redirectUri) {
    throw new Error("Google connector is not configured: missing client ID or redirect URI.");
  }

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_WORKSPACE_SCOPES.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  return url;
}

export async function exchangeGoogleCodeForTokens(code: string): Promise<GoogleTokenResponse> {
  const { clientId, clientSecret, redirectUri } = googleConnectorEnv();
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Google connector is not configured.");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code,
    }),
  });

  const payload = (await response.json()) as GoogleTokenResponse & { error?: string; error_description?: string };
  if (!response.ok) {
    throw new Error(payload.error_description ?? payload.error ?? "Google token exchange failed.");
  }

  return payload;
}

export async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    return {};
  }

  return (await response.json()) as GoogleUserInfo;
}
