import "server-only";
import { redirect } from "next/navigation";
import { getClientIp } from "@/lib/client-ip";
import { isRateLimited } from "@/lib/rate-limit";

const AUTH_WINDOW_MS = 60_000;

const LIMITS = {
  loginIp: 20,
  loginEmail: 10,
  registerIp: 5,
  inviteIp: 10,
  resetIp: 10,
  resetEmail: 3
} as const;

async function redirectIfLimited(key: string, max: number, errorPath: string) {
  if (await isRateLimited(key, max, AUTH_WINDOW_MS)) {
    redirect(`${errorPath}?error=${encodeURIComponent("Too many attempts. Try again shortly.")}`);
  }
}

export async function assertLoginNotRateLimited(email: string) {
  const ip = await getClientIp();
  await redirectIfLimited(`auth:login:ip:${ip}`, LIMITS.loginIp, "/login");
  if (email) {
    await redirectIfLimited(`auth:login:email:${email}`, LIMITS.loginEmail, "/login");
  }
}

export async function assertRegisterNotRateLimited() {
  const ip = await getClientIp();
  await redirectIfLimited(`auth:register:ip:${ip}`, LIMITS.registerIp, "/register");
}

export async function assertInviteAcceptNotRateLimited(inviteToken?: string) {
  const ip = await getClientIp();
  if (await isRateLimited(`auth:invite:ip:${ip}`, LIMITS.inviteIp, AUTH_WINDOW_MS)) {
    const params = new URLSearchParams({
      error: "Too many attempts. Try again shortly."
    });
    if (inviteToken) {
      params.set("token", inviteToken);
    }
    redirect(`/accept-invite?${params.toString()}`);
  }
}

export async function assertPasswordResetRequestNotRateLimited(email: string) {
  const ip = await getClientIp();
  await redirectIfLimited(`auth:reset:ip:${ip}`, LIMITS.resetIp, "/forgot-password");
  if (email) {
    await redirectIfLimited(`auth:reset:email:${email}`, LIMITS.resetEmail, "/forgot-password");
  }
}

export async function assertPortalLoginNotRateLimited(email: string) {
  const ip = await getClientIp();
  await redirectIfLimited(`auth:portal-login:ip:${ip}`, LIMITS.loginIp, "/portal/login");
  if (email) {
    await redirectIfLimited(`auth:portal-login:email:${email}`, LIMITS.loginEmail, "/portal/login");
  }
}

export async function assertPortalInviteAcceptNotRateLimited(inviteToken?: string) {
  const ip = await getClientIp();
  if (await isRateLimited(`auth:portal-invite:ip:${ip}`, LIMITS.inviteIp, AUTH_WINDOW_MS)) {
    const params = new URLSearchParams({
      error: "Too many attempts. Try again shortly."
    });
    if (inviteToken) {
      params.set("token", inviteToken);
    }
    redirect(`/portal/accept-invite?${params.toString()}`);
  }
}
