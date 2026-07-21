import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import {
  LINK_REQUIRED_MESSAGE,
  resolveOAuthLinkDecision
} from "@/lib/oauth/link-decision";
import { profileFromMicrosoftIdToken } from "@/lib/oauth/microsoft";
import type { OAuthProfile } from "@/lib/oauth/google";

function encodeIdTokenPayload(payload: Record<string, unknown>) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.sig`;
}

describe("resolveOAuthLinkDecision", () => {
  it("returns LOGIN_LINKED when the provider account is already linked", () => {
    assert.equal(
      resolveOAuthLinkDecision({
        linkedUserId: "user-1",
        userByEmailId: "user-other",
        emailVerified: false
      }),
      "LOGIN_LINKED"
    );
  });

  it("returns LOGIN_LINKED even when the provider email changed (stable provider id)", () => {
    // Email lookup is irrelevant once the provider link exists.
    assert.equal(
      resolveOAuthLinkDecision({
        linkedUserId: "user-1",
        userByEmailId: null,
        emailVerified: true
      }),
      "LOGIN_LINKED"
    );
  });

  it("auto-links a verified Google email to an existing credentials user", () => {
    assert.equal(
      resolveOAuthLinkDecision({
        linkedUserId: null,
        userByEmailId: "user-1",
        emailVerified: true
      }),
      "AUTOLINK"
    );
  });

  it("requires explicit linking for an unverified OAuth email matching an existing user", () => {
    assert.equal(
      resolveOAuthLinkDecision({
        linkedUserId: null,
        userByEmailId: "user-1",
        emailVerified: false
      }),
      "LINK_REQUIRED"
    );
  });

  it("requires explicit linking for Microsoft (emailVerified always false)", () => {
    assert.equal(
      resolveOAuthLinkDecision({
        linkedUserId: null,
        userByEmailId: "user-1",
        emailVerified: false
      }),
      "LINK_REQUIRED"
    );
  });

  it("returns NO_ACCOUNT when nothing matches", () => {
    assert.equal(
      resolveOAuthLinkDecision({
        linkedUserId: null,
        userByEmailId: null,
        emailVerified: true
      }),
      "NO_ACCOUNT"
    );
  });

  it("exports a recovery message without tokens or secrets", () => {
    assert.match(LINK_REQUIRED_MESSAGE, /Sign in with your original method/i);
    assert.doesNotMatch(LINK_REQUIRED_MESSAGE, /token|secret|password|access_token/i);
  });
});

describe("profileFromMicrosoftIdToken", () => {
  const previousClientId = process.env.MICROSOFT_CLIENT_ID;

  before(() => {
    process.env.MICROSOFT_CLIENT_ID = "test-client-id";
  });

  after(() => {
    if (previousClientId === undefined) {
      delete process.env.MICROSOFT_CLIENT_ID;
    } else {
      process.env.MICROSOFT_CLIENT_ID = previousClientId;
    }
  });

  it("parses oid, tid, and email; emailVerified is always false", () => {
    const token = encodeIdTokenPayload({
      aud: "test-client-id",
      oid: "oid-stable-1",
      sub: "sub-1",
      tid: "tenant-abc",
      email: "Broker@Example.COM",
      name: "Broker User"
    });

    const profile = profileFromMicrosoftIdToken(token);
    assert.equal(profile.provider, "MICROSOFT");
    assert.equal(profile.providerAccountId, "oid-stable-1");
    assert.equal(profile.email, "broker@example.com");
    assert.equal(profile.name, "Broker User");
    assert.equal(profile.emailVerified, false);
    assert.equal(profile.tenantId, "tenant-abc");
    assertProfileHasNoSecrets(profile);
  });

  it("falls back to preferred_username when email is absent", () => {
    const token = encodeIdTokenPayload({
      aud: "test-client-id",
      oid: "oid-2",
      tid: "tenant-xyz",
      preferred_username: "user@contoso.com",
      name: "Contoso User"
    });

    const profile = profileFromMicrosoftIdToken(token);
    assert.equal(profile.email, "user@contoso.com");
    assert.equal(profile.emailVerified, false);
    assert.equal(profile.providerAccountId, "oid-2");
    assert.equal(profile.tenantId, "tenant-xyz");
  });

  it("throws when neither email nor preferred_username is usable", () => {
    const token = encodeIdTokenPayload({
      aud: "test-client-id",
      oid: "oid-3",
      tid: "tenant-xyz",
      preferred_username: "DOMAIN\\samAccount"
    });

    assert.throws(() => profileFromMicrosoftIdToken(token), /email address/i);
  });

  it("throws on audience mismatch", () => {
    const token = encodeIdTokenPayload({
      aud: "wrong-client",
      oid: "oid-4",
      email: "a@b.com"
    });

    assert.throws(() => profileFromMicrosoftIdToken(token), /audience/i);
  });

  it("keeps the same providerAccountId when email/username changes", () => {
    const first = profileFromMicrosoftIdToken(
      encodeIdTokenPayload({
        aud: "test-client-id",
        oid: "oid-stable",
        tid: "tenant-1",
        email: "old@example.com"
      })
    );
    const second = profileFromMicrosoftIdToken(
      encodeIdTokenPayload({
        aud: "test-client-id",
        oid: "oid-stable",
        tid: "tenant-1",
        preferred_username: "new@example.com"
      })
    );

    assert.equal(first.providerAccountId, second.providerAccountId);
    assert.equal(first.email, "old@example.com");
    assert.equal(second.email, "new@example.com");
    assert.equal(first.emailVerified, false);
    assert.equal(second.emailVerified, false);
  });

  it("prefers oid over sub for providerAccountId", () => {
    const profile = profileFromMicrosoftIdToken(
      encodeIdTokenPayload({
        aud: "test-client-id",
        oid: "oid-preferred",
        sub: "sub-fallback",
        email: "a@b.com",
        tid: "t1"
      })
    );
    assert.equal(profile.providerAccountId, "oid-preferred");
  });
});

function assertProfileHasNoSecrets(profile: OAuthProfile) {
  const keys = Object.keys(profile);
  for (const key of keys) {
    assert.doesNotMatch(key, /token|secret|refresh|access/i);
  }
  const serialized = JSON.stringify(profile);
  assert.doesNotMatch(serialized, /access_token|refresh_token|client_secret/i);
}
