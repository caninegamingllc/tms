"use client";

import { X } from "lucide-react";
import { clsx } from "clsx";
import { useProductTourOptional } from "./ProductTourProvider";

type CoachmarkVariant = "blue" | "rose" | "amber";

const VARIANT_STYLES: Record<CoachmarkVariant, string> = {
  blue: "border-sky-400/70 bg-sky-50 text-sky-950 dark:border-sky-500/50 dark:bg-sky-950/80 dark:text-sky-50",
  rose: "border-rose-400/70 bg-rose-50 text-rose-950 dark:border-rose-500/50 dark:bg-rose-950/80 dark:text-rose-50",
  amber:
    "border-amber-400/70 bg-amber-50 text-amber-950 dark:border-amber-500/50 dark:bg-amber-950/80 dark:text-amber-50"
};

const ARROW_STYLES: Record<
  NonNullable<CoachmarkProps["arrow"]>,
  { wrapper: string; svg: string; path: string }
> = {
  "top-left": {
    wrapper: "absolute -top-8 left-6",
    svg: "h-8 w-10",
    path: "M2 30 C 8 8, 18 4, 36 2"
  },
  "top-right": {
    wrapper: "absolute -top-8 right-6",
    svg: "h-8 w-10 scale-x-[-1]",
    path: "M2 30 C 8 8, 18 4, 36 2"
  },
  "bottom-left": {
    wrapper: "absolute -bottom-8 left-6",
    svg: "h-8 w-10 scale-y-[-1]",
    path: "M2 30 C 8 8, 18 4, 36 2"
  },
  left: {
    wrapper: "absolute top-1/2 -left-10 -translate-y-1/2",
    svg: "h-6 w-10 rotate-[-90deg]",
    path: "M2 30 C 8 8, 18 4, 36 2"
  }
};

type CoachmarkProps = {
  id: string;
  children: React.ReactNode;
  variant?: CoachmarkVariant;
  /** Where the curved arrow sits relative to the callout box. */
  arrow?: "top-left" | "top-right" | "bottom-left" | "left";
  className?: string;
};

/**
 * Soft Asana-style callout. Parent should be `relative` near the highlighted control.
 * Only renders after the sequential tour is complete and this id has not been dismissed.
 */
export function Coachmark({
  id,
  children,
  variant = "blue",
  arrow = "top-left",
  className
}: CoachmarkProps) {
  const tour = useProductTourOptional();
  if (!tour?.isCoachmarkVisible(id)) {
    return null;
  }

  const arrowStyle = ARROW_STYLES[arrow];

  return (
    <div
      role="note"
      className={clsx(
        "pointer-events-auto absolute z-40 max-w-[260px] rounded-lg border px-3.5 py-3 text-[13px] leading-snug shadow-sm",
        VARIANT_STYLES[variant],
        className
      )}
    >
      <div className={clsx(arrowStyle.wrapper, "pointer-events-none text-current opacity-80")}>
        <svg viewBox="0 0 40 32" className={arrowStyle.svg} fill="none" aria-hidden>
          <path
            d={arrowStyle.path}
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </div>
      <button
        type="button"
        onClick={() => tour.dismissCoachmark(id)}
        className="absolute top-1.5 right-1.5 rounded p-0.5 opacity-60 transition-opacity hover:opacity-100"
        aria-label="Dismiss tip"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <p className="pr-4">{children}</p>
    </div>
  );
}
