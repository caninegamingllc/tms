import Link from "next/link";
import { logoutPortal } from "@/lib/portal-admin-actions";
import type { PortalViewer } from "@/lib/portal-auth";
import { ThemeToggle } from "@/components/theme-toggle";

const navItems = [
  { href: "/portal", label: "Overview" },
  { href: "/portal/board", label: "Board" },
  { href: "/portal/invoices", label: "Invoices" }
] as const;

export function CustomerPortalShell({
  viewer,
  children
}: {
  viewer: PortalViewer;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            {viewer.companyLogoPath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src="/api/portal/company-logo"
                alt={`${viewer.companyName} logo`}
                className="h-9 max-w-[120px] object-contain"
              />
            ) : (
              <div className="brand-gradient flex h-9 w-9 items-center justify-center rounded-md text-white">
                <span className="font-display text-lg font-semibold">
                  {viewer.companyName.slice(0, 1).toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Customer portal
              </p>
              <p className="font-display text-lg font-semibold leading-tight">{viewer.customerName}</p>
              <p className="text-xs text-muted-foreground">{viewer.companyName}</p>
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-2">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="btn-secondary">
                {item.label}
              </Link>
            ))}
            <ThemeToggle compact />
            <form action={logoutPortal}>
              <button type="submit" className="btn-secondary">
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
