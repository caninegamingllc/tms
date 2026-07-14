export function appBaseUrl() {
  const configured = process.env.APP_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}

function isLocalhostUrl(value: string) {
  try {
    const host = new URL(value).hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return /localhost|127\.0\.0\.1/i.test(value);
  }
}

/**
 * Resolve an OAuth redirect URI for the current deployment.
 * Explicit env overrides are honored, except leftover localhost values when
 * APP_BASE_URL points at a public host (common prod misconfiguration).
 */
export function resolveOAuthRedirectUri(explicit: string | undefined, callbackPath: string) {
  const path = callbackPath.startsWith("/") ? callbackPath : `/${callbackPath}`;
  const derived = `${appBaseUrl()}${path}`;
  const override = explicit?.trim();
  if (!override) {
    return derived;
  }

  if (isLocalhostUrl(override) && !isLocalhostUrl(derived)) {
    return derived;
  }

  return override;
}
