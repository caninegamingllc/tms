"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { clsx } from "clsx";
import { ChevronsUpDown, LogOut, PlayCircle, Settings } from "lucide-react";
import { useProductTourOptional } from "@/components/onboarding/ProductTourProvider";
import { TOUR_ATTR } from "@/components/onboarding/tour-steps";

function userInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function SidebarUserMenu({
  name,
  email,
  companyName,
  onNavigate,
  className
}: {
  name: string;
  email: string;
  companyName?: string;
  /** Called after choosing a navigation action (e.g. close mobile drawer). */
  onNavigate?: () => void;
  className?: string;
}) {
  const tour = useProductTourOptional();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={clsx("relative", className)}>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute bottom-full left-0 z-50 mb-2 w-56 overflow-hidden rounded-lg border border-border bg-card text-foreground shadow-lg"
        >
          <div className="px-3 py-2.5">
            <p className="truncate text-sm font-medium text-foreground">{name}</p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          </div>
          <div className="h-px bg-border" />
          <div className="p-1">
            <Link
              href="/settings"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground transition hover:bg-muted"
              onClick={() => {
                setOpen(false);
                onNavigate?.();
              }}
            >
              <Settings className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
              Settings
            </Link>
            {tour ? (
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground transition hover:bg-muted"
                onClick={() => {
                  setOpen(false);
                  onNavigate?.();
                  tour.replayTour();
                }}
              >
                <PlayCircle className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                Replay product tour
              </button>
            ) : null}
          </div>
          <div className="h-px bg-border" />
          <div className="p-1">
            <form action="/logout" method="post">
              <button
                type="submit"
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground transition hover:bg-muted"
              >
                <LogOut className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                Log out
              </button>
            </form>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        {...{ [TOUR_ATTR]: "nav-settings" }}
        className="flex w-full items-center justify-between gap-2 rounded-md p-1 text-left transition hover:bg-white/5"
        onClick={() => setOpen((value) => !value)}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-[11px] font-semibold text-white">
            {userInitials(name) || "SS"}
          </div>
          <div className="min-w-0">
            <p className="rail-brand-title truncate text-xs font-semibold">{name}</p>
            <p className="rail-brand-sub truncate text-[11px]">{companyName ?? email}</p>
          </div>
        </div>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-white/50" aria-hidden />
      </button>
    </div>
  );
}
