/** Max length for a staff display name (matches common form UX). */
export const DISPLAY_NAME_MAX_LENGTH = 100;

export function normalizeDisplayName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/**
 * Validate a display name. Returns an error message, or null when valid.
 */
export function validateDisplayName(raw: string): string | null {
  const name = normalizeDisplayName(raw);
  if (!name) {
    return "Name is required";
  }
  if (name.length > DISPLAY_NAME_MAX_LENGTH) {
    return `Name must be ${DISPLAY_NAME_MAX_LENGTH} characters or fewer`;
  }
  return null;
}

/**
 * Shared password-change field checks (does not verify the current password).
 * Returns an error message, or null when valid.
 */
export function validatePasswordChangeInput(input: {
  newPassword: string;
  confirmPassword: string;
}): string | null {
  if (input.newPassword.length < 8 || input.newPassword !== input.confirmPassword) {
    return "Password must match and be at least 8 characters";
  }
  return null;
}
