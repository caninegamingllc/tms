function stripEnvQuotes(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export function appBaseUrl() {
  const raw = process.env.APP_BASE_URL;
  const configured = raw ? stripEnvQuotes(raw) : "";
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}

export function isLocalhostUrl(value: string) {
  try {
    const host = new URL(value).hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return /localhost|127\.0\.0\.1/i.test(value);
  }
}

/** Public origin for the current request (honors reverse-proxy headers). */
export function requestPublicOrigin(request: Request) {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host")?.trim() || url.host;
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto = (forwardedProto || url.protocol.replace(":", "") || "https").replace(/:$/, "");
  return `${proto}://${host}`.replace(/\/$/, "");
}

/**
 * Prefer the public request origin when APP_BASE_URL is still localhost
 * (common production misconfiguration that breaks Stripe return URLs).
 */
export function resolvePublicAppUrl(requestOrigin?: string | null) {
  const configured = appBaseUrl();
  const origin = requestOrigin?.trim().replace(/\/$/, "");

  if (!origin) {
    return configured;
  }

  if (isLocalhostUrl(configured) && !isLocalhostUrl(origin)) {
    return origin;
  }

  return configured;
}

/**
 * Absolute URL under the configured public app host.
 * Falls back to request.url only when APP_BASE_URL is still localhost.
 * Use for OAuth post-callback redirects so Microsoft cancel responses that
 * land on a leftover localhost reply URL still bounce to production.
 */
export function appAbsoluteUrl(pathWithQuery: string, request: Request) {
  const path = pathWithQuery.startsWith("/") ? pathWithQuery : `/${pathWithQuery}`;
  const configured = appBaseUrl();
  if (!isLocalhostUrl(configured)) {
    return new URL(path, `${configured}/`);
  }
  return new URL(path, request.url);
}

/**
 * Resolve an OAuth redirect URI for the current deployment.
 *
 * Priority:
 * 1. Non-localhost APP_BASE_URL + path (or public request origin if APP_BASE_URL is localhost)
 * 2. Explicit *_REDIRECT_URI env, unless it is leftover localhost while the base is public
 *
 * Never prefers a localhost request origin when APP_BASE_URL is already public —
 * Microsoft ignores the port on localhost reply URLs and may send cancel/back
 * responses to a different registered localhost port (e.g. :3001 instead of :3000).
 */
export function resolveOAuthRedirectUri(
  explicit: string | undefined,
  callbackPath: string,
  requestOrigin?: string | null
) {
  const path = callbackPath.startsWith("/") ? callbackPath : `/${callbackPath}`;
  const derived = `${resolvePublicAppUrl(requestOrigin)}${path}`;
  const override = explicit ? stripEnvQuotes(explicit) : "";
  if (!override) {
    return derived;
  }

  if (isLocalhostUrl(override) && !isLocalhostUrl(derived)) {
    return derived;
  }

  return override;
}
