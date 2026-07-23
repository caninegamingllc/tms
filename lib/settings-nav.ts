import type { CurrentUser } from "@/lib/auth";
import { planHasFeature } from "@/lib/plans";
import { canManageUsers } from "@/lib/scope";

export type SettingsNavItem = {
  title: string;
  href: string;
};

/** Left-rail sections inside Settings — mirrors CRM SettingsLayout. */
export function getSettingsNavItems(user: CurrentUser): SettingsNavItem[] {
  const items: SettingsNavItem[] = [
    { title: "General", href: "/settings" },
    { title: "Account", href: "/settings/account" }
  ];

  if (planHasFeature(user.plan, "email_mailbox")) {
    items.push({ title: "Email", href: "/settings/email" });
  }

  if (canManageUsers(user)) {
    items.push({ title: "Admin", href: "/admin" });
    if (planHasFeature(user.plan, "factoring_admin")) {
      items.push({ title: "Accounting", href: "/admin/accounting" });
    }
    items.push({ title: "Billing", href: "/admin/billing" });
  }

  if (planHasFeature(user.plan, "marketplace_integrations")) {
    items.push({ title: "Integrations", href: "/integrations" });
  }

  return items;
}

export function isSettingsNavActive(pathname: string, href: string) {
  if (href === "/settings") return pathname === "/settings";
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isSettingsWidePath(pathname: string) {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/integrations" ||
    pathname.startsWith("/integrations/") ||
    pathname === "/settings/email"
  );
}
