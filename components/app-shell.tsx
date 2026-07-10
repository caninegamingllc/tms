"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import {
  BarChart3,
  Building2,
  MapPin,
  FileText,
  Gauge,
  Landmark,
  LayoutDashboard,
  Plug,
  Settings,
  ShieldCheck,
  Truck
} from "lucide-react";
import type { CurrentUser } from "@/lib/auth";
import { canManageUsers } from "@/lib/scope";

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
  { href: "/integrations", label: "Integrations", icon: Plug }
] as const;

export function AppShell({
  children,
  currentUser
}: {
  children: React.ReactNode;
  currentUser: CurrentUser | null;
}) {
  const pathname = usePathname();
  const publicPage =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/change-password" ||
    pathname === "/accept-invite";
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
          <h1 className="text-2xl font-bold text-ink">Session expired</h1>
          <p className="mt-2 text-sm text-muted">Sign in again to continue.</p>
          <Link href="/login" className="btn mt-4 inline-flex">
            Go to sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[280px_1fr]">
      <aside className="border-r border-border bg-white/90 px-5 py-6 backdrop-blur">
        <Link href="/" className="block rounded-2xl bg-ink p-4 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-100">
            Broker OS
          </p>
          <p className="mt-2 text-xl font-bold">Freight TMS</p>
          <p className="mt-1 text-xs text-slate-300">Loads, carriers, dispatch, AR/AP</p>
        </Link>

        <nav className="mt-6 grid gap-1">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
                  active
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-600 hover:bg-soft hover:text-ink"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-6 rounded-2xl border border-border bg-soft p-4">
          <p className="text-sm font-semibold text-ink">{currentUser?.name ?? "Not signed in"}</p>
          <p className="text-xs text-muted">{currentUser?.email ?? "Please sign in"}</p>
          {currentUser ? <p className="text-xs text-muted">{currentUser.companyName}</p> : null}
          {currentUser ? <p className="text-xs text-muted">Role: {currentUser.role}</p> : null}
          {currentUser ? (
            <form action="/logout" method="post" className="mt-3">
              <button className="btn-secondary w-full" type="submit">
                Sign Out
              </button>
            </form>
          ) : null}
        </div>
      </aside>

      <main className="min-w-0 px-5 py-6 md:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
