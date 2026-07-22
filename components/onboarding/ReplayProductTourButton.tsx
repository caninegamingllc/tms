"use client";

import { useProductTourOptional } from "./ProductTourProvider";

export function ReplayProductTourButton({
  className,
  variant = "default"
}: {
  className?: string;
  variant?: "default" | "rail";
}) {
  const tour = useProductTourOptional();
  if (!tour) return null;

  const base =
    variant === "rail"
      ? "btn-secondary flex w-full items-center justify-center gap-2 !bg-white/10 !text-white !text-[12px]"
      : "btn-secondary";

  return (
    <button type="button" className={className ?? base} onClick={() => tour.replayTour()}>
      Replay product tour
    </button>
  );
}
