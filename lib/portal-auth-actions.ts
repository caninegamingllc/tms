"use server";

import { redirect } from "next/navigation";
import { hashPassword, verifyPassword } from "@/lib/auth";
import {
  assertPortalInviteAcceptNotRateLimited,
  assertPortalLoginNotRateLimited
} from "@/lib/auth-rate-limit";
import { prisma } from "@/lib/db";
import {
  createPortalUserSession,
  hashPortalToken
} from "@/lib/portal-auth";

export async function portalLogin(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  await assertPortalLoginNotRateLimited(email);

  if (!email || !password) {
    redirect(`/portal/login?error=${encodeURIComponent("Email and password are required.")}`);
  }

  const portalUser = await prisma.customerPortalUser.findFirst({
    where: {
      email,
      status: "ACTIVE",
      disabledAt: null,
      company: { status: "ACTIVE" }
    }
  });

  if (!portalUser || !(await verifyPassword(password, portalUser.passwordHash))) {
    redirect(`/portal/login?error=${encodeURIComponent("Invalid email or password.")}`);
  }

  await createPortalUserSession(portalUser.id, portalUser.customerId);
  redirect("/portal");
}

export async function portalAcceptInvite(formData: FormData) {
  const token = String(formData.get("token") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  await assertPortalInviteAcceptNotRateLimited(token);

  if (!token) {
    redirect(`/portal/accept-invite?error=${encodeURIComponent("Invite token is missing.")}`);
  }
  if (password.length < 8) {
    redirect(
      `/portal/accept-invite?token=${encodeURIComponent(token)}&error=${encodeURIComponent("Password must be at least 8 characters.")}`
    );
  }
  if (password !== confirmPassword) {
    redirect(
      `/portal/accept-invite?token=${encodeURIComponent(token)}&error=${encodeURIComponent("Passwords do not match.")}`
    );
  }

  const portalUser = await prisma.customerPortalUser.findFirst({
    where: {
      inviteTokenHash: hashPortalToken(token),
      status: "INVITED",
      disabledAt: null
    }
  });

  if (!portalUser || !portalUser.inviteExpiresAt || portalUser.inviteExpiresAt < new Date()) {
    redirect(
      `/portal/accept-invite?error=${encodeURIComponent("This invite is invalid or has expired.")}`
    );
  }

  await prisma.customerPortalUser.update({
    where: { id: portalUser.id },
    data: {
      name: name || portalUser.name,
      passwordHash: await hashPassword(password),
      status: "ACTIVE",
      inviteTokenHash: null,
      inviteExpiresAt: null
    }
  });

  await createPortalUserSession(portalUser.id, portalUser.customerId);
  redirect("/portal");
}
