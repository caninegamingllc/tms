"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentType
} from "react";
import { createPortal } from "react-dom";
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
import type { BranchSwitcherData } from "@/lib/branch-filter";

const SESSION_HEARTBEAT_MS = 30_000;
const FLYOUT_CLOSE_DELAY_MS = 200;

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  /** When set, item is hidden unless the org plan includes this feature. */
  feature?: import("@/lib/plans").PlanFeature;
};

type NavGroup = {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
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
      { href: "/settings/email", label: "Email settings", icon: FileText, feature: "email_mailbox" }
    ]
  }
];

function isNavActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/admin") return pathname === "/admin";
  if (href === "/commissions") return pathname === "/commissions";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function NavFlyout({
  group,
  pathname,
  top,
  left,
  labelledBy,
  onPointerEnter,
  onPointerLeave,
  onNavigate
}: {
  group: NavGroup;
  pathname: string;
  top: number;
  left: number;
  labelledBy: string;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onNavigate?: () => void;
}) {
  return (
    <div
      role="menu"
      aria-labelledby={labelledBy}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      // nav-flyout + inline colors: Safari otherwise inherits rail light text into the panel.
      className="nav-flyout fixed z-[80] min-w-[220px] rounded-md border border-slate-200 bg-white shadow-[0_8px_24px_-12px_rgba(15,23,42,0.18)]"
      style={{ top, left, color: "#0f172a", backgroundColor: "#ffffff" }}
    >
      {/* Bridge the rail→panel gap so Safari does not drop hover before enter. */}
      <div aria-hidden className="absolute top-0 bottom-0 -left-2 w-2" />
      <div
        className="border-b border-slate-200 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
        style={{ color: "#64748b" }}
      >
        {group.label}
      </div>
      <div className="p-1">
        {group.items.map((item) => {
          const Icon = item.icon;
          const active = isNavActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              onClick={onNavigate}
              className={clsx(
                "flex items-center gap-2 rounded px-2 py-1.5 text-[13px] transition",
                active ? "bg-slate-100 font-medium" : "hover:bg-slate-50"
              )}
              style={{ color: "#0f172a" }}
            >
              <Icon className="nav-flyout-icon h-4 w-4 shrink-0" />
              <span style={{ color: "#0f172a" }}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function RailNavGroup({
  group,
  pathname,
  active,
  open,
  onOpen,
  onClose,
  onHoverClose
}: {
  group: NavGroup;
  pathname: string;
  active: boolean;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onHoverClose: () => void;
}) {
  const Icon = group.icon;
  const buttonId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateCoords = useCallback(() => {
    const button = buttonRef.current;
    if (!button) {
      return;
    }
    const rect = button.getBoundingClientRect();
    // Flush to the rail edge — a gap makes Safari drop hover before the panel receives it.
    setCoords({
      top: rect.top,
      left: rect.right
    });
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    updateCoords();
    const onScrollOrResize = () => updateCoords();
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [open, updateCoords]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }
      if (buttonRef.current?.contains(target)) {
        return;
      }
      const menu = document.getElementById(`rail-flyout-${group.id}`);
      if (menu?.contains(target)) {
        return;
      }
      onClose();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    // Capture so Safari still sees the dismiss when focus moves oddly.
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, group.id]);

  return (
    <div className="relative" onPointerEnter={onOpen} onFocus={onOpen}>
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        data-active={active ? "true" : "false"}
        className="rail-nav-btn relative flex h-11 w-11 items-center justify-center rounded-md transition"
        aria-label={group.label}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => {
          updateCoords();
          onOpen();
        }}
      >
        <Icon className="h-6 w-6" />
        {active ? (
          <span className="absolute top-2 -left-px h-7 w-[3px] rounded-r bg-rail-accent" />
        ) : null}
      </button>
      {mounted && open && coords
        ? createPortal(
            <div id={`rail-flyout-${group.id}`}>
              <NavFlyout
                group={group}
                pathname={pathname}
                top={coords.top}
                left={coords.left}
                labelledBy={buttonId}
                onPointerEnter={onOpen}
                onPointerLeave={onHoverClose}
                onNavigate={onClose}
              />
            </div>,
            document.body
          )
        : null}
    </div>
  );
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
        <p className="font-display text-lg font-semibold text-white">Simple Source</p>
        <p className="text-xs text-white/60">Transportation Management</p>
      </Link>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {groups.map((group) => (
          <div key={group.id} className="mb-3">
            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
              {group.label}
            </p>
            <div className="grid gap-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isNavActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={clsx(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition",
                      active ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
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

        <div className="mt-3 rounded-md border border-white/10 bg-white/5 p-3">
          <p className="text-sm font-semibold text-white">{currentUser.name}</p>
          <p className="text-xs text-white/55">{currentUser.email}</p>
          <p className="text-xs text-white/55">{currentUser.companyName}</p>
          <p className="text-xs text-white/55">Role: {currentUser.role}</p>
          <form action="/logout" method="post" className="mt-3">
            <button className="btn-secondary w-full !bg-white/10 !text-white" type="submit">
              Sign Out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export function AppShell({
  children,
  currentUser,
  branchSwitcher
}: {
  children: React.ReactNode;
  currentUser: CurrentUser | null;
  branchSwitcher: BranchSwitcherData | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const openRailGroup = useCallback((groupId: string) => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setOpenGroup(groupId);
  }, []);

  const closeRailGroup = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setOpenGroup(null);
  }, []);

  const scheduleCloseRailGroup = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
    }
    closeTimer.current = setTimeout(() => {
      setOpenGroup(null);
      closeTimer.current = null;
    }, FLYOUT_CLOSE_DELAY_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (closeTimer.current) {
        clearTimeout(closeTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    setOpenGroup(null);
  }, [pathname]);

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

      {/* Desktop icon rail — fixed so Safari does not clip popovers under sticky. */}
      <aside className="app-rail rail-gradient fixed inset-y-0 left-0 z-30 hidden w-[68px] flex-col items-center border-r border-black/40 text-rail-foreground lg:flex">
        <Link
          href="/"
          className="brand-gradient mt-4 mb-3 flex h-10 w-10 items-center justify-center rounded-md text-white shadow-[0_4px_16px_-4px_rgba(0,0,0,0.5)]"
          title="Simple Source TMS"
        >
          <span className="font-display text-lg font-semibold">S</span>
        </Link>

        <div
          className="mt-2 flex flex-1 flex-col gap-1 py-2"
          onPointerLeave={scheduleCloseRailGroup}
        >
          {visibleGroups.map((group) => (
            <RailNavGroup
              key={group.id}
              group={group}
              pathname={pathname}
              active={activeGroup?.id === group.id}
              open={openGroup === group.id}
              onOpen={() => openRailGroup(group.id)}
              onClose={closeRailGroup}
              onHoverClose={scheduleCloseRailGroup}
            />
          ))}
        </div>

        <div className="mb-3 flex flex-col items-center gap-2 pb-2">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-[11px] font-semibold text-white"
            title={`${currentUser.name} · ${currentUser.companyName}`}
          >
            {initials(currentUser.name) || "SS"}
          </div>
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

      <div className="flex min-w-0 flex-1 flex-col lg:pl-[68px]">
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

          <div className="ml-auto flex items-center gap-3">
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
            <form action="/logout" method="post" className="hidden sm:block">
              <button className="btn-secondary !px-2.5 !py-1 !text-[12px]" type="submit">
                Sign Out
              </button>
            </form>
          </div>
        </header>

        {!currentUser.hasSeat && canAccessAdmin(currentUser.role) ? (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800 md:px-5">
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
