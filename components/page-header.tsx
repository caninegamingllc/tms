import type { ReactNode } from "react";
import { TOUR_ATTR } from "@/components/onboarding/tour-steps";

type PageHeaderProps = {
  title: ReactNode;
  description?: string;
  action?: ReactNode;
  eyebrow?: string;
  /** Stable product-tour anchor id (sets data-tour). */
  tourId?: string;
};

export function PageHeader({
  title,
  description,
  action,
  eyebrow = "Simple Source TMS",
  tourId
}: PageHeaderProps) {
  return (
    <div
      className="mb-4 flex flex-col gap-3 border-b border-border pb-4 md:flex-row md:items-end md:justify-between"
      {...(tourId ? { [TOUR_ATTR]: tourId } : {})}
    >
      <div className="min-w-0">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {eyebrow}
        </p>
        <h1 className="font-display mt-0.5 text-[1.75rem] font-semibold leading-tight tracking-tight text-foreground md:text-[2rem]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-[13px] text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}
