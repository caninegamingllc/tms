"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { clsx } from "clsx";
import {
  BarChart3,
  Building2,
  FileText,
  Gauge,
  Landmark,
  LayoutDashboard,
  MapPin,
  Menu,
  Plug,
  Settings,
  ShieldCheck,
  Truck,
  X
} from "lucide-react";
import type { CurrentUser } from "@/lib/auth";
import { canManageUsers } from "@/lib/scope";
import { canAccessAdmin } from "@/lib/seats";
import { OrgSwitcher } from "@/components/org-switcher";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/loads", label: "Loads", icon: Truck },
  { href: "/customers", label: "Customers", icon: Building2 },
  { href: "/locations", label: "Locations", icon: MapPin },
  { href: "/carriers", label: "Carriers", icon: ShieldCheck },
  { href: "/dispatch", label: "Dispatch", icon: Gauge },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/accounting", label: "Accounting", icon: Landmark },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/admin", label: "Admin", icon: Settings, adminOnly: true },
  { href: "/admin/billing", label: "Billing", icon: Landmark, adminOnly: true },
  { href: "/integrations", label: "Integrations", icon: Plug }
] as const;

function SidebarContent({
  pathname,
  visibleNavItems,
  currentUser,
  onNavigate
}: {
  pathname: string;
  visibleNavItems: (typeof navItems)[number][];
  currentUser: CurrentUser;
  onNavigate?: () => void;
}) {
  return (
    <>
      <Link href="/" className="block border-b border-border pb-5" onClick={onNavigate}>
        <p className="text-lg font-bold text-primary">Simple Source</p>
        <p className="mt-0.5 text-sm text-muted-foreground">Transportation Management</p>
      </Link>

      <nav className="mt-5 grid gap-0.5">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/"
              ? pathname === "/"
              : item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={clsx(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                active
                  ? "bg-lightprimary text-primary"
                  : "text-sidebar-foreground hover:bg-muted"
              )}
            >
              <Icon className={clsx("h-4 w-4", active ? "text-primary" : "text-muted-foreground")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <OrgSwitcher
        organizations={currentUser.organizations}
        currentMembershipId={currentUser.membershipId}
      />

      {!currentUser.hasSeat && canAccessAdmin(currentUser.role) ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          No seat assigned.{" "}
          <Link href="/admin/billing" className="font-semibold underline" onClick={onNavigate}>
            Purchase and assign a seat
          </Link>{" "}
          to use the TMS.
        </div>
      ) : null}

      <div className="mt-5 rounded-lg border border-border bg-muted/50 p-4">
        <p className="text-sm font-semibold text-foreground">{currentUser.name}</p>
        <p className="text-xs text-muted-foreground">{currentUser.email}</p>
        <p className="text-xs text-muted-foreground">{currentUser.companyName}</p>
        <p className="text-xs text-muted-foreground">Role: {currentUser.role}</p>
        <form action="/logout" method="post" className="mt-3">
          <button className="btn-secondary w-full" type="submit">
            Sign Out
          </button>
        </form>
      </div>
    </>
  );
}

export function AppShell({
  children,
  currentUser
}: {
  children: React.ReactNode;
  currentUser: CurrentUser | null;
}) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const publicPage =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/change-password" ||
    pathname === "/accept-invite" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/select-organization";
  const visibleNavItems = navItems.filter(
    (item) => !("adminOnly" in item && item.adminOnly) || (currentUser && canManageUsers(currentUser))
  );

  if (publicPage) {
    return <>{children}</>;
  }

  if (!currentUser) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5">
        <div className="card max-w-md text-center">
          <p className="text-lg font-bold text-primary">Simple Source</p>
          <h1 className="mt-3 text-2xl font-bold text-foreground">Session expired</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in again to continue.</p>
          <Link href="/login" className="btn mt-4 inline-flex">
            Go to sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      {mobileNavOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}

      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col overflow-y-auto border-r border-border bg-card px-5 py-6 transition-transform lg:static lg:translate-x-0",
          mobileNavOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <button
          type="button"
          aria-label="Close navigation"
          className="absolute top-4 right-4 rounded-lg p-1 text-muted-foreground hover:bg-muted lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        >
          <X className="h-5 w-5" />
        </button>

        <SidebarContent
          pathname={pathname}
          visibleNavItems={visibleNavItems}
          currentUser={currentUser}
          onNavigate={() => setMobileNavOpen(false)}
        />
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="flex items-center gap-3 border-b border-border bg-card px-5 py-3 lg:hidden">
          <button
            type="button"
            aria-label="Open navigation"
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div>
            <p className="text-sm font-bold text-primary">Simple Source</p>
            <p className="text-xs text-muted-foreground">TMS</p>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-5 py-6 md:px-8 lg:px-10">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
