export type OAuthLinkDecision =
  | "LOGIN_LINKED"
  | "AUTOLINK"
  | "LINK_REQUIRED"
  | "NO_ACCOUNT";

/**
 * Pure decision for whether an OAuth login may attach to an existing user.
 * Auto-link only when the provider asserts a verified email (Google with
 * email_verified=true). Microsoft and unverified Google emails never auto-link.
 */
export function resolveOAuthLinkDecision(input: {
  linkedUserId: string | null;
  userByEmailId: string | null;
  emailVerified: boolean;
}): OAuthLinkDecision {
  if (input.linkedUserId) {
    return "LOGIN_LINKED";
  }
  if (!input.userByEmailId) {
    return "NO_ACCOUNT";
  }
  if (input.emailVerified) {
    return "AUTOLINK";
  }
  return "LINK_REQUIRED";
}

export const LINK_REQUIRED_MESSAGE =
  "An account already exists for that email. Sign in with your original method, then connect Google/Microsoft under Settings → Account.";
