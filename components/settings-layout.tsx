"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PropsWithChildren, ReactNode } from "react";
import { clsx } from "clsx";
import { PageHeader } from "@/components/page-header";
import {
  isSettingsNavActive,
  isSettingsWidePath,
  type SettingsNavItem
} from "@/lib/settings-nav";

export function SettingsLayout({
  children,
  items
}: PropsWithChildren<{ items: SettingsNavItem[] }>) {
  const pathname = usePathname() ?? "";
  const wide = isSettingsWidePath(pathname);

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Manage your profile and organization settings"
      />

      <div className="flex flex-col gap-6 lg:flex-row lg:gap-12">
        <aside className="w-full shrink-0 lg:w-48">
          <nav className="flex flex-col gap-1" aria-label="Settings">
            {items.map((item) => {
              const active = isSettingsNavActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "rounded-md px-3 py-2 text-sm font-medium transition",
                    active
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}
                >
                  {item.title}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className={clsx("min-w-0 flex-1", !wide && "max-w-2xl")}>
          <section className="space-y-6">{children}</section>
        </div>
      </div>
    </div>
  );
}

/** Section title inside Settings content (CRM small Heading equivalent). */
export function SettingsSectionHeading({
  title,
  description,
  action
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h2 className="font-display text-base font-semibold text-foreground">{title}</h2>
        {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}
