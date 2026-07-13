import { createHmac, timingSafeEqual } from "crypto";

export type OAuthProvider = "GOOGLE" | "MICROSOFT";

export type IdentityOAuthMode = "login" | "register" | "accept-invite" | "link";

export type IdentityOAuthState = {
  mode: IdentityOAuthMode;
  provider: OAuthProvider;
  nonce: string;
  companyName?: string;
  inviteToken?: string;
  returnTo?: string;
};

export type MailOAuthState = {
  mode: "mailbox";
  provider: OAuthProvider;
  nonce: string;
  userId: string;
  returnTo?: string;
};

export type OAuthStatePayload = IdentityOAuthState | MailOAuthState;

export const IDENTITY_OAUTH_STATE_COOKIE = "tms_oauth_state";
export const MAIL_OAUTH_STATE_COOKIE = "tms_mail_oauth_state";

function appBaseUrl() {
  return (process.env.APP_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function stateSecret() {
  return (
    process.env.OAUTH_STATE_SECRET ||
    process.env.TOKEN_ENCRYPTION_KEY ||
    process.env.INTUIT_TOKEN_ENCRYPTION_KEY ||
    "dev-oauth-state-secret"
  );
}

export function getAppBaseUrl() {
  return appBaseUrl();
}

export function encodeOAuthState(payload: OAuthStatePayload) {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", stateSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function decodeOAuthState(raw: string): OAuthStatePayload | null {
  const [body, sig] = raw.split(".");
  if (!body || !sig) {
    return null;
  }

  const expected = createHmac("sha256", stateSecret()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as OAuthStatePayload;
  } catch {
    return null;
  }
}

export function parseOAuthProvider(value: string): OAuthProvider | null {
  const normalized = value.trim().toUpperCase();
  if (normalized === "GOOGLE" || normalized === "MICROSOFT") {
    return normalized;
  }
  return null;
}

export function shouldUseSecureCookies() {
  if (process.env.COOKIE_SECURE === "true") {
    return true;
  }
  if (process.env.COOKIE_SECURE === "false") {
    return false;
  }
  return process.env.NODE_ENV === "production";
}
