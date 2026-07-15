"use server";

import { createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appBaseUrl } from "@/lib/app-url";
import { canAccessRecord } from "@/lib/branch-filter-server";
import { prisma } from "@/lib/db";
import { sendPortalInviteEmail } from "@/lib/mail";
import { requireWriteUser } from "@/lib/permissions";
import { createPortalRawToken, hashPortalToken } from "@/lib/portal-auth";

const INVITE_DAYS = 7;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function optionalString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || undefined;
}

function requiredString(formData: FormData, key: string) {
  const value = optionalString(formData, key);
  if (!value) {
    throw new Error(`${key} is required`);
  }
  return value;
}

async function requireAccessibleCustomer(customerId: string) {
  const user = await requireWriteUser();
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, companyId: user.companyId },
    include: { company: { select: { name: true } } }
  });
  if (!customer || !(await canAccessRecord(user, customer.branchId))) {
    throw new Error("Customer not found.");
  }
  return { user, customer };
}

export async function inviteCustomerPortalUser(formData: FormData) {
  const customerId = requiredString(formData, "customerId");
  const { user, customer } = await requireAccessibleCustomer(customerId);
  const name = requiredString(formData, "name");
  const email = requiredString(formData, "email").toLowerCase();

  const existing = await prisma.customerPortalUser.findUnique({
    where: {
      companyId_email: {
        companyId: user.companyId,
        email
      }
    }
  });

  if (existing && existing.customerId !== customerId) {
    redirect(
      `/customers/${customerId}?error=${encodeURIComponent("That email is already used for another customer portal account.")}`
    );
  }

  const rawToken = createPortalRawToken();
  const inviteExpiresAt = new Date();
  inviteExpiresAt.setDate(inviteExpiresAt.getDate() + INVITE_DAYS);

  const portalUser = existing
    ? await prisma.customerPortalUser.update({
        where: { id: existing.id },
        data: {
          name,
          status: "INVITED",
          disabledAt: null,
          passwordHash: null,
          inviteTokenHash: hashToken(rawToken),
          inviteExpiresAt
        }
      })
    : await prisma.customerPortalUser.create({
        data: {
          companyId: user.companyId,
          customerId,
          name,
          email,
          status: "INVITED",
          inviteTokenHash: hashToken(rawToken),
          inviteExpiresAt
        }
      });

  const inviteUrl = `${appBaseUrl()}/portal/accept-invite?token=${encodeURIComponent(rawToken)}`;
  await sendPortalInviteEmail(email, {
    inviteUrl,
    companyName: customer.company.name,
    customerName: customer.name,
    inviteeName: portalUser.name,
    expiresInDays: INVITE_DAYS
  });

  await prisma.customerActivity.create({
    data: {
      customerId,
      userId: user.id,
      action: "Portal invite sent",
      details: `Invited ${email} to the customer portal.`
    }
  });

  revalidatePath(`/customers/${customerId}`);
  redirect(`/customers/${customerId}?portalInvite=${encodeURIComponent(inviteUrl)}`);
}

export async function disableCustomerPortalUser(formData: FormData) {
  const customerId = requiredString(formData, "customerId");
  const portalUserId = requiredString(formData, "portalUserId");
  const { user } = await requireAccessibleCustomer(customerId);

  const portalUser = await prisma.customerPortalUser.findFirst({
    where: { id: portalUserId, customerId, companyId: user.companyId }
  });
  if (!portalUser) {
    throw new Error("Portal user not found.");
  }

  await prisma.$transaction([
    prisma.customerPortalUser.update({
      where: { id: portalUser.id },
      data: {
        status: "DISABLED",
        disabledAt: new Date(),
        inviteTokenHash: null,
        inviteExpiresAt: null
      }
    }),
    prisma.customerPortalSession.deleteMany({ where: { portalUserId: portalUser.id } })
  ]);

  revalidatePath(`/customers/${customerId}`);
  redirect(`/customers/${customerId}`);
}

export async function createCustomerPortalLink(formData: FormData) {
  const customerId = requiredString(formData, "customerId");
  const { user } = await requireAccessibleCustomer(customerId);
  const label = optionalString(formData, "label") ?? "Share link";
  const expiresInDays = Number(formData.get("expiresInDays") ?? "30");
  const days = Number.isFinite(expiresInDays) && expiresInDays > 0 ? Math.min(expiresInDays, 365) : 30;

  const rawToken = createPortalRawToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);

  await prisma.customerPortalLink.create({
    data: {
      companyId: user.companyId,
      customerId,
      label,
      tokenHash: hashPortalToken(rawToken),
      expiresAt,
      createdByUserId: user.id
    }
  });

  const accessUrl = `${appBaseUrl()}/portal/access/${encodeURIComponent(rawToken)}`;

  await prisma.customerActivity.create({
    data: {
      customerId,
      userId: user.id,
      action: "Portal share link created",
      details: `Created magic link "${label}" (expires in ${days} days).`
    }
  });

  revalidatePath(`/customers/${customerId}`);
  redirect(`/customers/${customerId}?portalLink=${encodeURIComponent(accessUrl)}`);
}

export async function revokeCustomerPortalLink(formData: FormData) {
  const customerId = requiredString(formData, "customerId");
  const linkId = requiredString(formData, "linkId");
  const { user } = await requireAccessibleCustomer(customerId);

  const link = await prisma.customerPortalLink.findFirst({
    where: { id: linkId, customerId, companyId: user.companyId }
  });
  if (!link) {
    throw new Error("Portal link not found.");
  }

  await prisma.$transaction([
    prisma.customerPortalLink.update({
      where: { id: link.id },
      data: { revokedAt: new Date() }
    }),
    prisma.customerPortalSession.deleteMany({ where: { portalLinkId: link.id } })
  ]);

  revalidatePath(`/customers/${customerId}`);
  redirect(`/customers/${customerId}`);
}

export async function updateCustomerPaymentUrl(formData: FormData) {
  const customerId = requiredString(formData, "customerId");
  await requireAccessibleCustomer(customerId);
  const paymentUrl = optionalString(formData, "paymentUrl") ?? null;

  await prisma.customer.update({
    where: { id: customerId },
    data: { paymentUrl }
  });

  revalidatePath(`/customers/${customerId}`);
  redirect(`/customers/${customerId}?saved=1`);
}

export async function logoutPortal() {
  const { destroyPortalSession } = await import("@/lib/portal-auth");
  await destroyPortalSession();
  redirect("/portal/login");
}
