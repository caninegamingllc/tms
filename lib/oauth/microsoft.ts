import { resolveOAuthRedirectUri } from "@/lib/app-url";
import type { OAuthProvider } from "@/lib/oauth/types";
import type { OAuthProfile } from "@/lib/oauth/google";

const MS_AUTHORIZE = (tenant: string) =>
  `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`;
const MS_TOKEN = (tenant: string) =>
  `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;

function microsoftTenant() {
  return process.env.MICROSOFT_TENANT_ID?.trim() || "common";
}

export function isMicrosoftOAuthConfigured() {
  return Boolean(
    process.env.MICROSOFT_CLIENT_ID?.trim() && process.env.MICROSOFT_CLIENT_SECRET?.trim()
  );
}

function microsoftIdentityRedirectUri(requestOrigin?: string | null) {
  return resolveOAuthRedirectUri(
    process.env.MICROSOFT_REDIRECT_URI,
    "/api/auth/oauth/microsoft/callback",
    requestOrigin
  );
}

function microsoftMailRedirectUri(requestOrigin?: string | null) {
  return resolveOAuthRedirectUri(
    process.env.MICROSOFT_MAIL_REDIRECT_URI,
    "/api/mail/oauth/microsoft/callback",
    requestOrigin
  );
}

export function getMicrosoftIdentityAuthorizeUrl(state: string, requestOrigin?: string | null) {
  const clientId = process.env.MICROSOFT_CLIENT_ID?.trim();
  if (!clientId) {
    throw new Error("MICROSOFT_CLIENT_ID is not configured.");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: microsoftIdentityRedirectUri(requestOrigin),
    response_mode: "query",
    // Sign-in only needs OIDC claims from the ID token. Avoid Graph scopes
    // (User.Read / offline_access / Mail.*) so locked-down tenants don't
    // block non-admins with AADSTS90094 after org admin consent.
    scope: "openid profile email",
    state,
    prompt: "select_account"
  });

  return `${MS_AUTHORIZE(microsoftTenant())}?${params.toString()}`;
}

export function getMicrosoftMailAuthorizeUrl(state: string, requestOrigin?: string | null) {
  const clientId = process.env.MICROSOFT_CLIENT_ID?.trim();
  if (!clientId) {
    throw new Error("MICROSOFT_CLIENT_ID is not configured.");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: microsoftMailRedirectUri(requestOrigin),
    response_mode: "query",
    scope: "openid profile email offline_access User.Read Mail.Send Mail.Read",
    state,
    // Do not use prompt=consent. With user consent disabled, that forces
    // "Need admin approval" even after org-wide admin consent is already granted.
    prompt: "select_account"
  });

  return `${MS_AUTHORIZE(microsoftTenant())}?${params.toString()}`;
}

async function exchangeMicrosoftCode(code: string, redirectUri: string) {
  const clientId = process.env.MICROSOFT_CLIENT_ID?.trim();
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("Microsoft OAuth is not configured.");
  }

  const response = await fetch(MS_TOKEN(microsoftTenant()), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    })
  });

  if (!response.ok) {
    throw new Error(`Microsoft token exchange failed: ${await response.text()}`);
  }

  return (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
    id_token?: string;
  };
}

function profileFromMicrosoftIdToken(idToken: string): OAuthProfile {
  const parts = idToken.split(".");
  if (parts.length < 2) {
    throw new Error("Microsoft ID token was malformed.");
  }

  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as {
    aud?: string | string[];
    oid?: string;
    sub?: string;
    email?: string;
    preferred_username?: string;
    name?: string;
  };

  const clientId = process.env.MICROSOFT_CLIENT_ID?.trim();
  const audienceOk =
    payload.aud === clientId ||
    (Array.isArray(payload.aud) && clientId != null && payload.aud.includes(clientId));
  if (!audienceOk) {
    throw new Error("Microsoft ID token audience mismatch.");
  }

  const email = (payload.email || payload.preferred_username || "").toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error("Microsoft account did not return an email address.");
  }

  const providerAccountId = payload.oid || payload.sub;
  if (!providerAccountId) {
    throw new Error("Microsoft ID token did not include a user id.");
  }

  return {
    provider: "MICROSOFT" satisfies OAuthProvider,
    providerAccountId,
    email,
    name: payload.name?.trim() || email.split("@")[0]
  };
}

async function fetchMicrosoftProfile(accessToken: string): Promise<OAuthProfile> {
  const response = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    throw new Error(`Microsoft Graph /me failed: ${await response.text()}`);
  }

  const data = (await response.json()) as {
    id: string;
    displayName?: string;
    mail?: string;
    userPrincipalName?: string;
  };

  const email = (data.mail || data.userPrincipalName || "").toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error("Microsoft account did not return an email address.");
  }

  return {
    provider: "MICROSOFT" satisfies OAuthProvider,
    providerAccountId: data.id,
    email,
    name: data.displayName?.trim() || email.split("@")[0]
  };
}

export async function completeMicrosoftIdentityOAuth(
  code: string,
  requestOrigin?: string | null
) {
  const tokens = await exchangeMicrosoftCode(code, microsoftIdentityRedirectUri(requestOrigin));
  if (!tokens.id_token) {
    throw new Error("Microsoft sign-in did not return an ID token.");
  }
  const profile = profileFromMicrosoftIdToken(tokens.id_token);
  return { profile, tokens };
}

export async function completeMicrosoftMailOAuth(code: string, requestOrigin?: string | null) {
  const tokens = await exchangeMicrosoftCode(code, microsoftMailRedirectUri(requestOrigin));
  const profile = await fetchMicrosoftProfile(tokens.access_token);
  return { profile, tokens };
}

export async function refreshMicrosoftAccessToken(refreshToken: string) {
  const clientId = process.env.MICROSOFT_CLIENT_ID?.trim();
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("Microsoft OAuth is not configured.");
  }

  const response = await fetch(MS_TOKEN(microsoftTenant()), {
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
    throw new Error(`Microsoft token refresh failed: ${await response.text()}`);
  }

  return (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
  };
}

export async function sendMicrosoftMail(
  accessToken: string,
  message: {
    subject: string;
    to: string[];
    bodyText: string;
    bodyHtml?: string;
    attachments?: Array<{
      name: string;
      contentType: string;
      contentBytes: string;
    }>;
  }
) {
  const response = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: {
        subject: message.subject,
        body: {
          contentType: message.bodyHtml ? "HTML" : "Text",
          content: message.bodyHtml ?? message.bodyText
        },
        toRecipients: message.to.map((address) => ({
          emailAddress: { address }
        })),
        attachments: message.attachments?.map((attachment) => ({
          "@odata.type": "#microsoft.graph.fileAttachment",
          name: attachment.name,
          contentType: attachment.contentType,
          contentBytes: attachment.contentBytes
        }))
      },
      saveToSentItems: true
    })
  });

  if (!response.ok) {
    throw new Error(`Microsoft sendMail failed: ${await response.text()}`);
  }
}

export async function listMicrosoftConversationMessages(
  accessToken: string,
  conversationId: string
) {
  // Do not combine $filter(conversationId) with $orderby — Graph returns InefficientFilter.
  // Sort client-side after fetch.
  const params = new URLSearchParams({
    $filter: `conversationId eq '${conversationId.replace(/'/g, "''")}'`,
    $top: "50",
    $select: "id,subject,from,toRecipients,bodyPreview,receivedDateTime,sentDateTime,conversationId"
  });

  const response = await fetch(`https://graph.microsoft.com/v1.0/me/messages?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    throw new Error(`Microsoft conversation fetch failed: ${await response.text()}`);
  }

  const payload = (await response.json()) as {
    value: Array<{
      id: string;
      subject?: string;
      bodyPreview?: string;
      conversationId?: string;
      receivedDateTime?: string;
      sentDateTime?: string;
      from?: { emailAddress?: { address?: string } };
      toRecipients?: Array<{ emailAddress?: { address?: string } }>;
    }>;
  };

  payload.value.sort((a, b) => {
    const aTime = a.receivedDateTime ? Date.parse(a.receivedDateTime) : 0;
    const bTime = b.receivedDateTime ? Date.parse(b.receivedDateTime) : 0;
    return aTime - bTime;
  });

  return payload;
}

export async function searchMicrosoftMessages(accessToken: string, search: string) {
  const params = new URLSearchParams({
    $search: `"${search.replace(/"/g, "")}"`,
    $top: "25",
    $select: "id,subject,from,toRecipients,bodyPreview,receivedDateTime,sentDateTime,conversationId"
  });

  const response = await fetch(`https://graph.microsoft.com/v1.0/me/messages?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ConsistencyLevel: "eventual"
    }
  });

  if (!response.ok) {
    throw new Error(`Microsoft message search failed: ${await response.text()}`);
  }

  return (await response.json()) as {
    value: Array<{
      id: string;
      subject?: string;
      bodyPreview?: string;
      conversationId?: string;
      receivedDateTime?: string;
      sentDateTime?: string;
      from?: { emailAddress?: { address?: string } };
      toRecipients?: Array<{ emailAddress?: { address?: string } }>;
    }>;
  };
}
