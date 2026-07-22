"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Suspense,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type CSSProperties
} from "react";
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
  Percent,
  Plug,
  Radio,
  Search,
  Settings,
  ShieldCheck,
  Truck,
  X
} from "lucide-react";
import type { CurrentUser } from "@/lib/auth";
import { NAV_FEATURE_REQUIREMENTS, planHasFeature } from "@/lib/plans";
import { canManageUsers } from "@/lib/scope";
import { canAccessAdmin } from "@/lib/seats";
import { OrgSwitcher } from "@/components/org-switcher";
import { BranchSwitcher } from "@/components/branch-switcher";
import { CarrierQuickSearch } from "@/components/carrier-quick-search";
import { ThemeToggle } from "@/components/theme-toggle";
import { ProductTourProvider } from "@/components/onboarding/ProductTourProvider";
import { TOUR_ATTR, tourIdForNavUrl } from "@/components/onboarding/tour-steps";
import { SidebarUserMenu } from "@/components/sidebar-user-menu";
import type { OnboardingPreferences } from "@/lib/ui-preferences";
import type { BranchSwitcherData } from "@/lib/branch-filter";

const SESSION_HEARTBEAT_MS = 30_000;

type NavIcon = ComponentType<{ className?: string; style?: CSSProperties; "aria-hidden"?: boolean }>;

type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  adminOnly?: boolean;
  /** When set, item is hidden unless the org plan includes this feature. */
  feature?: import("@/lib/plans").PlanFeature;
};

type NavGroup = {
  id: string;
  label: string;
  icon: NavIcon;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    id: "ops",
    label: "Operations",
    icon: Radio,
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/loads", label: "Loads", icon: Truck },
      { href: "/search", label: "Search", icon: Search, feature: "search" },
      { href: "/dispatch", label: "Dispatch", icon: Gauge, feature: "dispatch" }
    ]
  },
  {
    id: "fleet",
    label: "Fleet",
    icon: Truck,
    items: [
      { href: "/fleet/drivers", label: "Drivers", icon: ShieldCheck, feature: "fleet_assets" },
      { href: "/fleet/trucks", label: "Trucks", icon: Truck, feature: "fleet_assets" },
      { href: "/fleet/trailers", label: "Trailers", icon: Truck, feature: "fleet_assets" },
      { href: "/fleet/compliance", label: "Compliance", icon: FileText, feature: "fleet_assets" },
      { href: "/fleet/dvir", label: "DVIR", icon: FileText, feature: "fleet_assets" },
      { href: "/fleet/safety", label: "Safety", icon: ShieldCheck, feature: "safety_records" },
      { href: "/fleet/settlements", label: "Settlements", icon: Landmark, feature: "fleet_dispatch" },
      { href: "/fleet/fuel-tax", label: "Fuel tax", icon: Landmark, feature: "fuel_tax_ifta" }
    ]
  },
  {
    id: "network",
    label: "Network",
    icon: Building2,
    items: [
      { href: "/customers", label: "Customers", icon: Building2 },
      { href: "/carriers", label: "Carriers", icon: ShieldCheck },
      { href: "/locations", label: "Locations", icon: MapPin, feature: "locations" }
    ]
  },
  {
    id: "records",
    label: "Records",
    icon: FileText,
    items: [
      { href: "/documents", label: "Documents", icon: FileText, feature: "documents_upload" },
      { href: "/accounting", label: "Accounting", icon: Landmark, feature: "accounting_ar_ap" },
      { href: "/commissions", label: "Commissions", icon: Percent, feature: "commissions" },
      {
        href: "/commissions/profiles",
        label: "Commission Profiles",
        icon: Percent,
        adminOnly: true,
        feature: "commissions"
      },
      { href: "/reports", label: "Reports", icon: BarChart3, feature: "reports_summary" }
    ]
  },
  {
    id: "admin",
    label: "Admin",
    icon: Settings,
    items: [
      { href: "/admin", label: "Admin", icon: Settings, adminOnly: true },
      {
        href: "/admin/accounting",
        label: "Accounting Settings",
        icon: Landmark,
        adminOnly: true,
        feature: "factoring_admin"
      },
      { href: "/admin/billing", label: "Billing", icon: Landmark, adminOnly: true },
      {
        href: "/integrations",
        label: "Integrations",
        icon: Plug,
        feature: "marketplace_integrations"
      },
      { href: "/settings", label: "Settings", icon: Settings },
      { href: "/settings/email", label: "Email settings", icon: FileText, feature: "email_mailbox" }
    ]
  }
];

function isNavActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/admin") return pathname === "/admin";
  if (href === "/commissions") return pathname === "/commissions";
  // Keep Settings highlighted for its hub + account page, but not Email settings (separate item).
  if (href === "/settings") {
    return (
      pathname === "/settings" ||
      pathname === "/settings/account" ||
      pathname.startsWith("/settings/account/")
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function MobileNavList({
  groups,
  pathname,
  currentUser,
  onNavigate
}: {
  groups: NavGroup[];
  pathname: string;
  currentUser: CurrentUser;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <Link href="/" className="border-b border-white/10 px-4 py-4" onClick={onNavigate}>
        <p className="rail-brand-title font-display text-lg font-semibold">Simple Source</p>
        <p className="rail-brand-sub text-xs">Transportation Management</p>
      </Link>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {groups.map((group) => (
          <div key={group.id} className="mb-3">
              <p className="rail-nav-heading px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]">
                {group.label}
              </p>
            <div className="grid gap-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isNavActive(pathname, item.href);
                const tourId = tourIdForNavUrl(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    data-active={active ? "true" : "false"}
                    {...(tourId ? { [TOUR_ATTR]: tourId } : {})}
                    className="rail-nav-link flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition"
                    style={{
                      color: "#f8fafc",
                      WebkitTextFillColor: "#f8fafc",
                      backgroundColor: active ? "rgba(255,255,255,0.16)" : "transparent"
                    }}
                  >
                    <Icon
                      className="h-4 w-4 shrink-0"
                      aria-hidden
                      style={{ color: "#f8fafc", stroke: "#f8fafc" }}
                    />
                    <span style={{ color: "#f8fafc", WebkitTextFillColor: "#f8fafc" }}>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-3">
        <OrgSwitcher
          organizations={currentUser.organizations}
          currentMembershipId={currentUser.membershipId}
        />

        {!currentUser.hasSeat && canAccessAdmin(currentUser.role) ? (
          <div className="mt-3 rounded-md border border-amber-300/40 bg-amber-400/15 p-3 text-xs text-amber-100">
            No seat assigned.{" "}
            <Link href="/admin/billing" className="font-semibold underline" onClick={onNavigate}>
              Purchase and assign a seat
            </Link>{" "}
            to use the TMS.
          </div>
        ) : null}

        <div className="mt-3">
          <SidebarUserMenu
            name={currentUser.name}
            email={currentUser.email}
            companyName={currentUser.companyName}
            onNavigate={onNavigate}
          />
        </div>
      </div>
    </div>
  );
}

export function AppShell({
  children,
  currentUser,
  branchSwitcher,
  onboarding
}: {
  children: React.ReactNode;
  currentUser: CurrentUser | null;
  branchSwitcher: BranchSwitcherData | null;
  onboarding?: OnboardingPreferences | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const publicPage =
    pathname.startsWith("/portal") ||
    (pathname === "/" && !currentUser) ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/change-password" ||
    pathname === "/accept-invite" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/privacy" ||
    pathname === "/terms" ||
    pathname === "/select-organization";

  const visibleGroups = useMemo(() => {
    const canAdmin = Boolean(currentUser && canManageUsers(currentUser));
    const plan = currentUser?.plan ?? "FREE";
    return navGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          if (item.adminOnly && !canAdmin) return false;
          const required =
            item.feature ?? NAV_FEATURE_REQUIREMENTS[item.href];
          if (required && !planHasFeature(plan, required)) return false;
          return true;
        })
      }))
      .filter((group) => group.items.length > 0);
  }, [currentUser]);

  const activeGroup = useMemo(
    () =>
      visibleGroups.find((group) => group.items.some((item) => isNavActive(pathname, item.href))) ??
      null,
    [pathname, visibleGroups]
  );

  useEffect(() => {
    if (publicPage || !currentUser) {
      return;
    }

    let cancelled = false;

    async function checkSession() {
      try {
        const response = await fetch("/api/auth/session", {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store"
        });
        const payload = (await response.json().catch(() => null)) as {
          authenticated?: boolean;
        } | null;

        if (!cancelled && payload?.authenticated === false) {
          router.refresh();
        }
      } catch {
        // Ignore transient network errors; next tick or focus will retry.
      }
    }

    void checkSession();
    const intervalId = window.setInterval(() => {
      void checkSession();
    }, SESSION_HEARTBEAT_MS);

    function onVisibilityOrFocus() {
      if (document.visibilityState === "visible") {
        void checkSession();
      }
    }

    document.addEventListener("visibilitychange", onVisibilityOrFocus);
    window.addEventListener("focus", onVisibilityOrFocus);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityOrFocus);
      window.removeEventListener("focus", onVisibilityOrFocus);
    };
  }, [currentUser, publicPage, router]);

  if (publicPage) {
    return <>{children}</>;
  }

  if (!currentUser) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5">
        <div className="card max-w-md text-center">
          <p className="font-display text-lg font-semibold text-primary">Simple Source</p>
          <h1 className="mt-3 font-display text-2xl font-semibold text-foreground">Session expired</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in again to continue.</p>
          <Link href="/login" className="btn mt-4 inline-flex">
            Go to sign in
          </Link>
        </div>
      </main>
    );
  }

  const autoStart = currentUser.hasSeat && !currentUser.mustChangePassword;

  return (
    <Suspense
      fallback={
        <AppShellFrame
          currentUser={currentUser}
          branchSwitcher={branchSwitcher}
          visibleGroups={visibleGroups}
          activeGroup={activeGroup}
          pathname={pathname}
          mobileNavOpen={mobileNavOpen}
          setMobileNavOpen={setMobileNavOpen}
        >
          {children}
        </AppShellFrame>
      }
    >
      <ProductTourProvider initialOnboarding={onboarding} autoStart={autoStart}>
        <AppShellFrame
          currentUser={currentUser}
          branchSwitcher={branchSwitcher}
          visibleGroups={visibleGroups}
          activeGroup={activeGroup}
          pathname={pathname}
          mobileNavOpen={mobileNavOpen}
          setMobileNavOpen={setMobileNavOpen}
        >
          {children}
        </AppShellFrame>
      </ProductTourProvider>
    </Suspense>
  );
}

function AppShellFrame({
  children,
  currentUser,
  branchSwitcher,
  visibleGroups,
  activeGroup,
  pathname,
  mobileNavOpen,
  setMobileNavOpen
}: {
  children: React.ReactNode;
  currentUser: CurrentUser;
  branchSwitcher: BranchSwitcherData | null;
  visibleGroups: NavGroup[];
  activeGroup: NavGroup | null;
  pathname: string;
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
}) {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {mobileNavOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}

      {/* Desktop navigation */}
      <aside className="app-rail rail-gradient fixed inset-y-0 left-0 z-30 hidden w-[240px] flex-col border-r border-black/40 text-rail-foreground lg:flex">
        <Link
          href="/"
          className="flex items-center gap-3 border-b border-white/10 px-4 py-4"
        >
          <span className="brand-gradient flex h-10 w-10 shrink-0 items-center justify-center rounded-md font-display text-lg font-semibold text-white shadow-[0_4px_16px_-4px_rgba(0,0,0,0.5)]">
            S
          </span>
          <span className="min-w-0">
            <span className="rail-brand-title block font-display text-sm font-semibold">Simple Source</span>
            <span className="rail-brand-sub block truncate text-[11px]">Transportation Management</span>
          </span>
        </Link>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {visibleGroups.map((group) => (
            <div key={group.id} className="mb-4">
              <p className="rail-nav-heading px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]">
                {group.label}
              </p>
              <div className="grid gap-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isNavActive(pathname, item.href);
                  const tourId = tourIdForNavUrl(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      data-active={active ? "true" : "false"}
                      {...(tourId ? { [TOUR_ATTR]: tourId } : {})}
                      className="rail-nav-link flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium transition"
                      style={{
                        color: "#f8fafc",
                        WebkitTextFillColor: "#f8fafc",
                        backgroundColor: active ? "rgba(255,255,255,0.16)" : "transparent"
                      }}
                    >
                      <Icon
                        className="h-4 w-4 shrink-0"
                        aria-hidden
                        style={{ color: "#f8fafc", stroke: "#f8fafc" }}
                      />
                      <span style={{ color: "#f8fafc", WebkitTextFillColor: "#f8fafc" }}>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-3">
          <SidebarUserMenu
            name={currentUser.name}
            email={currentUser.email}
            companyName={currentUser.companyName}
          />
        </div>
      </aside>

      {/* Mobile drawer */}
      <aside
        className={clsx(
          "rail-gradient fixed inset-y-0 left-0 z-50 w-[280px] overflow-y-auto transition-transform lg:hidden",
          mobileNavOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <button
          type="button"
          aria-label="Close navigation"
          className="absolute top-3 right-3 rounded-md p-1 text-white/70 hover:bg-white/10"
          onClick={() => setMobileNavOpen(false)}
        >
          <X className="h-5 w-5" />
        </button>
        <MobileNavList
          groups={visibleGroups}
          pathname={pathname}
          currentUser={currentUser}
          onNavigate={() => setMobileNavOpen(false)}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:pl-[240px]">
        <header className="app-topbar sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card/90 px-4 backdrop-blur md:px-5">
          <button
            type="button"
            aria-label="Open navigation"
            className="rounded-md p-2 text-muted-foreground hover:bg-muted lg:hidden"
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex min-w-0 items-center gap-2">
            <span className="font-display text-[15px] font-semibold text-foreground">Simple Source</span>
            <span className="hidden text-muted-foreground sm:inline">/</span>
            <span className="hidden truncate text-[12px] uppercase tracking-[0.14em] text-muted-foreground sm:inline">
              {activeGroup?.label ?? "Operations"}
            </span>
          </div>

          {planHasFeature(currentUser.plan, "fmcsa_lookup") ? (
            <div className="ml-4 hidden md:block">
              <CarrierQuickSearch />
            </div>
          ) : null}

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <div className="hidden items-center gap-2 text-[12px] text-muted-foreground xl:flex">
              <span className="truncate">{currentUser.companyName}</span>
              <span className="h-4 w-px bg-border" />
              <span>{currentUser.role}</span>
            </div>
            {branchSwitcher ? (
              <BranchSwitcher
                branches={branchSwitcher.branches}
                selectedBranchIds={branchSwitcher.selectedBranchIds}
                allSelected={branchSwitcher.allSelected}
                primaryBranchId={branchSwitcher.primaryBranchId}
              />
            ) : null}
            <div className="hidden lg:block">
              <OrgSwitcher
                organizations={currentUser.organizations}
                currentMembershipId={currentUser.membershipId}
                compact
              />
            </div>
          </div>
        </header>

        {!currentUser.hasSeat && canAccessAdmin(currentUser.role) ? (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200 md:px-5">
            No seat assigned.{" "}
            <Link href="/admin/billing" className="font-semibold underline">
              Purchase and assign a seat
            </Link>{" "}
            to use the TMS.
          </div>
        ) : null}

        <main className="min-w-0 flex-1 px-4 py-4 md:px-6 md:py-5">{children}</main>
      </div>
    </div>
  );
}
