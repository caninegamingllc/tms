"use client";

import { useEffect, useState, type ReactNode } from "react";
import { TOUR_ATTR } from "@/components/onboarding/tour-steps";

type DashboardWelcomeProps = {
  firstName: string;
  organizationName: string;
  action?: ReactNode;
  tourId?: string;
};

function timeOfDayGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatDateLabel(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric"
  }).format(date);
}

export function DashboardWelcome({
  firstName,
  organizationName,
  action,
  tourId
}: DashboardWelcomeProps) {
  const [greeting, setGreeting] = useState(() => timeOfDayGreeting());
  const [dateLabel, setDateLabel] = useState(() => formatDateLabel());

  useEffect(() => {
    const sync = () => {
      const now = new Date();
      setGreeting(timeOfDayGreeting(now));
      setDateLabel(formatDateLabel(now));
    };
    sync();
    const id = window.setInterval(sync, 60_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      className="mb-6 flex flex-col gap-4 border-b border-border pb-5 md:flex-row md:items-end md:justify-between"
      {...(tourId ? { [TOUR_ATTR]: tourId } : {})}
    >
      <div className="min-w-0">
        <p className="mb-2 text-[11px] font-medium tracking-[0.18em] text-primary/70 uppercase">
          <span suppressHydrationWarning>
            {dateLabel} · {organizationName}
          </span>
        </p>
        <h1 className="font-display text-4xl leading-[1.05] font-semibold tracking-tight text-foreground sm:text-5xl">
          <span suppressHydrationWarning>{greeting}</span>,{" "}
          <span className="text-gradient-brand">{firstName}</span>
        </h1>
        <p className="mt-3 max-w-xl text-[15px] text-muted-foreground">
          Here&apos;s your day at a glance — live loads, margin, AR, and where your attention will move the
          needle.
        </p>
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}
