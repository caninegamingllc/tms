"use client";

import { X } from "lucide-react";
import { clsx } from "clsx";
import { useProductTourOptional } from "./ProductTourProvider";

type CoachmarkVariant = "blue" | "rose" | "amber";

const VARIANT_STYLES: Record<CoachmarkVariant, string> = {
  blue:
    "border-[#b7d6dc] bg-[#e6f1f3] text-[#1f4e5e] dark:border-primary/40 dark:bg-primary/15 dark:text-[#c5e4ea]",
  rose:
    "border-[#edc9c6] bg-[#fbeceb] text-[#7a3b39] dark:border-rose-500/40 dark:bg-rose-950/70 dark:text-rose-100",
  amber:
    "border-[#ecd7a3] bg-[#fbf1dc] text-[#6b4a15] dark:border-amber-500/40 dark:bg-amber-950/70 dark:text-amber-100"
};

const DOT_STYLES: Record<CoachmarkVariant, string> = {
  blue: "bg-primary",
  rose: "bg-[#b6524e] dark:bg-rose-400",
  amber: "bg-[#b8892a] dark:bg-amber-400"
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
        "pointer-events-auto absolute z-40 max-w-[268px] rounded-xl border px-3.5 py-3.5 text-[13px] leading-relaxed shadow-[0_10px_30px_-12px_rgba(27,36,51,0.18),0_2px_6px_-2px_rgba(27,36,51,0.08)]",
        VARIANT_STYLES[variant],
        className
      )}
    >
      <div className={clsx(arrowStyle.wrapper, "pointer-events-none text-current opacity-80")}>
        <svg viewBox="0 0 40 32" className={arrowStyle.svg} fill="none" aria-hidden>
          <path
            d={arrowStyle.path}
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </div>
      <button
        type="button"
        onClick={() => tour.dismissCoachmark(id)}
        className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-md opacity-70 transition-opacity hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
        aria-label="Dismiss tip"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <div className="flex items-start gap-2 pr-5">
        <span className={clsx("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", DOT_STYLES[variant])} />
        <p className="opacity-90">{children}</p>
      </div>
    </div>
  );
}
