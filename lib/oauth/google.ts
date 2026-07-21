import { resolveOAuthRedirectUri } from "@/lib/app-url";
import type { OAuthProvider } from "@/lib/oauth/types";

export type OAuthProfile = {
  provider: OAuthProvider;
  providerAccountId: string;
  email: string;
  name: string;
  /** True only when the provider cryptographically asserts email ownership. */
  emailVerified: boolean;
  /** Microsoft Entra tenant id (tid), when present. */
  tenantId?: string;
};

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO = "https://openidconnect.googleapis.com/v1/userinfo";

export function isGoogleOAuthConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}

function googleRedirectUri(requestOrigin?: string | null) {
  return resolveOAuthRedirectUri(
    process.env.GOOGLE_REDIRECT_URI,
    "/api/auth/oauth/google/callback",
    requestOrigin
  );
}

function googleMailRedirectUri(requestOrigin?: string | null) {
  return resolveOAuthRedirectUri(
    process.env.GOOGLE_MAIL_REDIRECT_URI,
    "/api/mail/oauth/google/callback",
    requestOrigin
  );
}

export function getGoogleIdentityAuthorizeUrl(state: string, requestOrigin?: string | null) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID is not configured.");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: googleRedirectUri(requestOrigin),
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account"
  });

  return `${GOOGLE_AUTH}?${params.toString()}`;
}

export function getGoogleMailAuthorizeUrl(state: string, requestOrigin?: string | null) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID is not configured.");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: googleMailRedirectUri(requestOrigin),
    response_type: "code",
    scope: [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.readonly"
    ].join(" "),
    state,
    access_type: "offline",
    prompt: "consent"
  });

  return `${GOOGLE_AUTH}?${params.toString()}`;
}

async function exchangeGoogleCode(code: string, redirectUri: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth is not configured.");
  }

  const response = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    })
  });

  if (!response.ok) {
    throw new Error(`Google token exchange failed: ${await response.text()}`);
  }

  return (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
    id_token?: string;
  };
}

async function fetchGoogleProfile(accessToken: string): Promise<OAuthProfile> {
  const response = await fetch(GOOGLE_USERINFO, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    throw new Error(`Google userinfo failed: ${await response.text()}`);
  }

  const data = (await response.json()) as {
    sub: string;
    email?: string;
    name?: string;
    email_verified?: boolean;
  };

  if (!data.email) {
    throw new Error("Google account did not return an email address.");
  }

  return {
    provider: "GOOGLE",
    providerAccountId: data.sub,
    email: data.email.trim().toLowerCase(),
    name: data.name?.trim() || data.email.split("@")[0],
    emailVerified: data.email_verified === true
  };
}

export async function completeGoogleIdentityOAuth(code: string, requestOrigin?: string | null) {
  const tokens = await exchangeGoogleCode(code, googleRedirectUri(requestOrigin));
  const profile = await fetchGoogleProfile(tokens.access_token);
  return { profile, tokens };
}

export async function completeGoogleMailOAuth(code: string, requestOrigin?: string | null) {
  const tokens = await exchangeGoogleCode(code, googleMailRedirectUri(requestOrigin));
  const profile = await fetchGoogleProfile(tokens.access_token);
  return { profile, tokens };
}

export async function refreshGoogleAccessToken(refreshToken: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth is not configured.");
  }

  const response = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    })
  });

  if (!response.ok) {
    throw new Error(`Google token refresh failed: ${await response.text()}`);
  }

  return (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
  };
}

export async function sendGmailMessage(accessToken: string, rawMimeBase64Url: string) {
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ raw: rawMimeBase64Url })
  });

  if (!response.ok) {
    throw new Error(`Gmail send failed: ${await response.text()}`);
  }

  return (await response.json()) as { id: string; threadId: string };
}

export async function listGmailThreadMessages(accessToken: string, threadId: string) {
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(threadId)}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    throw new Error(`Gmail thread fetch failed: ${await response.text()}`);
  }

  return (await response.json()) as {
    id: string;
    messages?: Array<{
      id: string;
      threadId: string;
      snippet?: string;
      internalDate?: string;
      payload?: {
        headers?: Array<{ name: string; value: string }>;
      };
    }>;
  };
}

export async function searchGmailMessages(accessToken: string, query: string) {
  const params = new URLSearchParams({ q: query, maxResults: "25" });
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    throw new Error(`Gmail search failed: ${await response.text()}`);
  }

  return (await response.json()) as { messages?: Array<{ id: string; threadId: string }> };
}

export async function getGmailMessage(accessToken: string, messageId: string) {
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    throw new Error(`Gmail message fetch failed: ${await response.text()}`);
  }

  return (await response.json()) as {
    id: string;
    threadId: string;
    snippet?: string;
    internalDate?: string;
    payload?: {
      headers?: Array<{ name: string; value: string }>;
      body?: { data?: string };
      parts?: Array<{ mimeType?: string; body?: { data?: string }; parts?: unknown[] }>;
    };
  };
}
