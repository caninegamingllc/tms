"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import packageJson from "@/package.json";
import {
  LANDING_CTA_PHOTO,
  LANDING_HERO_PHOTO,
  LANDING_MID_PHOTO
} from "@/lib/landing-photos";
import {
  PLAN_ORDER,
  planHighlights,
  planSeatLabel,
  PREMIUM_ONLY_HIGHLIGHTS,
  TRUCKING_ONLY_HIGHLIGHTS
} from "@/lib/plan-marketing";
import { formatPlanPrice, PLANS, type PlanId } from "@/lib/plans";

const COMPANY_URL = "https://simple-source.lovable.app";
const CRM_URL = "https://crm.simple-source.com";

function planCtaLabel(planId: PlanId): string {
  switch (planId) {
    case "FREE":
      return "Start free";
    case "LITE":
      return "Start with Lite";
    case "PREMIUM":
      return "Start with Premium";
    case "PREMIUM_TRUCKING":
      return "Start with Trucking";
  }
}

export function MarketingLanding() {
  const year = new Date().getFullYear();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="landing min-h-screen bg-background text-foreground">
      <header
        className={`landing-nav fixed inset-x-0 top-0 z-20 transition-all duration-300 ${
          scrolled
            ? "landing-nav-scrolled border-b border-border/70 bg-background/85 text-foreground shadow-sm backdrop-blur-md"
            : "bg-transparent text-white"
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 lg:px-10">
          <div className="flex items-center gap-3">
            <div className="brand-gradient flex h-9 w-9 items-center justify-center rounded-md text-white shadow-sm">
              <span className="font-display text-lg font-semibold">S</span>
            </div>
            <div>
              <div className="font-display text-[13px] font-medium leading-none">
                Simple Source TMS
              </div>
              <div
                className={`mt-1 text-[9px] font-medium tracking-wide ${
                  scrolled ? "text-muted-foreground" : "text-white/55"
                }`}
              >
                powered by Talent Transport Logistics Inc
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="#plans"
              className={`hidden rounded-md px-3 py-1.5 text-[13px] font-semibold sm:inline-flex ${
                scrolled
                  ? "text-muted-foreground transition hover:text-foreground"
                  : "text-white/85 transition hover:text-white"
              }`}
            >
              Plans
            </a>
            <Link
              href="/portal/login"
              className={`hidden rounded-md px-3 py-1.5 text-[13px] font-semibold md:inline-flex ${
                scrolled
                  ? "text-muted-foreground transition hover:text-foreground"
                  : "text-white/85 transition hover:text-white"
              }`}
            >
              Customer portal
            </Link>
            <Link
              href="/login"
              className={`rounded-md px-3 py-1.5 text-[13px] font-semibold transition ${
                scrolled
                  ? "border border-border bg-card text-foreground shadow-sm hover:bg-muted"
                  : "border border-white/25 bg-white/10 text-white backdrop-blur hover:bg-white/20"
              }`}
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <section className="landing-hero relative isolate flex min-h-[100svh] flex-col justify-center overflow-hidden bg-[#0f2438] pb-16 pt-28 text-white lg:pb-24 lg:pt-24">
        <div className="absolute inset-0 brand-gradient opacity-[0.72]" aria-hidden />
        <div className="surface-grid absolute inset-0 opacity-[0.12] mix-blend-overlay" aria-hidden />
        <div
          className="landing-glow absolute -bottom-40 -left-40 h-[720px] w-[720px] rounded-full opacity-30 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(61,155,168,0.85) 0%, transparent 70%)" }}
          aria-hidden
        />
        <div
          className="landing-glow landing-glow-delay absolute -top-32 right-[-10%] h-[560px] w-[560px] rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(229,168,75,0.55) 0%, transparent 70%)" }}
          aria-hidden
        />

        <div className="relative z-10 mx-auto w-full max-w-6xl px-6 lg:px-10">
          <div className="landing-hero-copy max-w-3xl">
            <h1 className="font-display text-[clamp(2.4rem,6.5vw,4.25rem)] leading-[1.02] font-semibold tracking-[-0.03em]">
              Move freight like a professional,
              <br />
              <span className="italic text-white/80">not a spreadsheet.</span>
            </h1>
            <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-white/80 sm:text-[16px]">
              Start free with one seat, or pick Lite / Premium / Premium + Trucking when you need
              documents, accounting, seats, fleet tools, and the full brokerage stack.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/register" className="landing-cta-primary">
                Start workspace
              </Link>
              <a href="#plans" className="landing-cta-secondary">
                See plans
              </a>
            </div>
          </div>

          <div className="landing-hero-copy relative mx-auto mt-14 max-w-5xl">
            <div
              className="pointer-events-none absolute -inset-x-4 top-8 -bottom-4 -z-10 rounded-[2rem] bg-white/10 opacity-40 blur-3xl"
              aria-hidden
            />
            <div className="overflow-hidden rounded-2xl border border-white/15 bg-[#0f2438]/60 shadow-lifted backdrop-blur-sm">
              <div className="relative aspect-[16/9] w-full">
                <Image
                  src={LANDING_HERO_PHOTO.src}
                  alt={LANDING_HERO_PHOTO.alt}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 960px"
                  className="landing-photo object-contain object-center"
                />
                <div className="absolute inset-0 brand-gradient opacity-30 mix-blend-multiply" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="plans" className="landing-section scroll-mt-24 border-b border-border bg-background">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:px-10 lg:py-24">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-secondary">
            Pricing
          </p>
          <h2 className="font-display mt-3 max-w-2xl text-[clamp(1.75rem,4vw,2.75rem)] font-semibold tracking-[-0.02em] text-foreground">
            Simple pricing for brokerages and fleets.
          </h2>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            Seat limits and features follow your organization plan. Upgrade anytime from Admin →
            Billing after you create a workspace.
          </p>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {PLAN_ORDER.map((planId) => {
              const plan = PLANS[planId];
              const recommended = planId === "PREMIUM";
              return (
                <div
                  key={planId}
                  className={`landing-plan-panel flex flex-col rounded-lg border p-5 ${
                    recommended
                      ? "border-primary bg-lightprimary/50 shadow-lifted"
                      : "border-border bg-card shadow-card"
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="font-display text-xl font-semibold text-foreground">{plan.name}</h3>
                    {recommended ? (
                      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
                        Most teams
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 flex items-baseline gap-1">
                    <span className="font-display text-[2.25rem] font-semibold tracking-tight text-foreground tabular">
                      {formatPlanPrice(planId)}
                    </span>
                    {planId === "FREE" ? (
                      <span className="text-[13px] text-muted-foreground">forever</span>
                    ) : (
                      <span className="text-[13px] text-muted-foreground">/seat/mo</span>
                    )}
                  </p>
                  <p className="mt-1 text-[13px] font-semibold text-primary">{planSeatLabel(planId)}</p>
                  <ul className="mt-5 flex-1 space-y-2.5 text-[13px] leading-snug text-muted-foreground">
                    {planHighlights(planId).map((line) => (
                      <li key={line} className="flex gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-secondary" aria-hidden />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/register"
                    className={`mt-6 inline-flex items-center justify-center rounded-md px-3 py-2 text-[13px] font-semibold transition ${
                      recommended
                        ? "bg-primary text-primary-foreground hover:opacity-90"
                        : "border border-border bg-card text-foreground hover:bg-muted"
                    }`}
                  >
                    {planCtaLabel(planId)}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="landing-section relative isolate overflow-hidden border-b border-border bg-[#0f2438] text-white">
        <div className="absolute inset-0 brand-gradient opacity-[0.7]" aria-hidden />
        <div className="surface-grid absolute inset-0 opacity-[0.1] mix-blend-overlay" aria-hidden />
        <div
          className="absolute -left-32 top-1/2 h-[420px] w-[420px] -translate-y-1/2 rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(61,155,168,0.55) 0%, transparent 70%)" }}
          aria-hidden
        />
        <div className="relative z-10 mx-auto grid max-w-6xl gap-10 px-6 py-20 lg:grid-cols-2 lg:items-center lg:gap-14 lg:px-10 lg:py-24">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/60">
              Premium
            </p>
            <h2 className="font-display mt-3 max-w-2xl text-[clamp(1.75rem,4vw,2.5rem)] font-semibold tracking-[-0.02em]">
              Beyond Lite — when the desk scales.
            </h2>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/75">
              Premium unlocks the modules most brokerages add after they outgrow a five-seat
              operation.
            </p>
            <ul className="mt-10 grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {PREMIUM_ONLY_HIGHLIGHTS.map((item) => (
                <li
                  key={item}
                  className="landing-capability flex items-baseline gap-3 border-t border-white/15 pt-3 text-[15px]"
                >
                  <span className="font-display font-semibold text-white">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-[#0f2438]/50 shadow-lifted">
            <div className="relative aspect-[4/3] w-full">
              <Image
                src={LANDING_MID_PHOTO.src}
                alt={LANDING_MID_PHOTO.alt}
                fill
                sizes="(max-width: 1024px) 100vw, 480px"
                className="object-contain object-center"
              />
              <div className="absolute inset-0 brand-gradient opacity-35 mix-blend-multiply" />
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section border-b border-border bg-background">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:px-10 lg:py-24">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-secondary">
            Premium + Trucking
          </p>
          <h2 className="font-display mt-3 max-w-2xl text-[clamp(1.75rem,4vw,2.5rem)] font-semibold tracking-[-0.02em]">
            Asset fleets — drivers, equipment, and DOT-ready files.
          </h2>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            When you run your own trucks, Premium + Trucking adds fleet registry, qualification
            files, safety records, and ELD/IFTA scaffolding on top of the full brokerage stack.
          </p>
          <ul className="mt-10 grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {TRUCKING_ONLY_HIGHLIGHTS.map((item) => (
              <li
                key={item}
                className="landing-capability flex items-baseline gap-3 border-t border-border pt-3 text-[15px]"
              >
                <span className="font-display font-semibold text-primary">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="landing-section relative isolate overflow-hidden bg-[#0f2438] text-white">
        <div className="absolute inset-0 brand-gradient opacity-[0.78]" aria-hidden />
        <div className="surface-grid absolute inset-0 opacity-[0.1] mix-blend-overlay" aria-hidden />
        <div className="relative z-10 mx-auto grid max-w-6xl gap-10 px-6 py-20 lg:grid-cols-2 lg:items-center lg:gap-14 lg:px-10 lg:py-24">
          <div>
            <h2 className="font-display max-w-xl text-[clamp(1.75rem,4vw,2.75rem)] font-semibold tracking-[-0.02em]">
              Start free. Upgrade when the freight picks up.
            </h2>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/80">
              New workspaces land on Free with one seat. Choose Lite or Premium in Billing when you
              need the rest of the stack.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register" className="landing-cta-primary landing-cta-on-brand">
                Start workspace
              </Link>
              <Link href="/login" className="landing-cta-secondary">
                Sign in to TMS
              </Link>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-[#0f2438]/50 shadow-lifted">
            <div className="relative aspect-[4/3] w-full">
              <Image
                src={LANDING_CTA_PHOTO.src}
                alt={LANDING_CTA_PHOTO.alt}
                fill
                sizes="(max-width: 1024px) 100vw, 480px"
                className="object-contain object-center"
              />
              <div className="absolute inset-0 brand-gradient opacity-35 mix-blend-multiply" />
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-[#1a2332] text-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 md:grid-cols-[1.4fr_1fr_1fr] lg:px-10">
          <div>
            <div className="flex items-center gap-3">
              <div className="brand-gradient flex h-8 w-8 items-center justify-center rounded-md text-white">
                <span className="font-display text-sm font-semibold">S</span>
              </div>
              <div className="flex flex-col leading-tight">
                <span className="font-display text-lg font-semibold tracking-tight">
                  Simple Source TMS
                </span>
                <span className="text-[11px] font-medium text-white/60">
                  powered by Talent Transport Logistics Inc
                </span>
              </div>
            </div>
            <p className="mt-5 max-w-sm text-sm text-white/60">
              Transportation management for brokers and carriers.
            </p>
            <p className="mt-4 text-[11px] uppercase tracking-[0.18em] text-white/40">
              © {year} Simple Source Logistics · v{packageJson.version}
            </p>
          </div>

          <div>
            <h4 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-white/50">
              Products
            </h4>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <a
                  href={COMPANY_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-white/85 transition-colors hover:text-white"
                >
                  Simple Source
                </a>
              </li>
              <li>
                <a
                  href={CRM_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-white/85 transition-colors hover:text-white"
                >
                  Simple Source CRM
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-white/50">
              Links
            </h4>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <a href="#plans" className="text-white/85 transition-colors hover:text-white">
                  Plans
                </a>
              </li>
              <li>
                <Link href="/portal/login" className="text-white/85 transition-colors hover:text-white">
                  Customer portal
                </Link>
              </li>
              <li>
                <a
                  href="mailto:hello@simple-source.com"
                  className="text-white/85 transition-colors hover:text-white"
                >
                  hello@simple-source.com
                </a>
              </li>
              <li>
                <Link href="/privacy" className="text-white/85 transition-colors hover:text-white">
                  Privacy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-white/85 transition-colors hover:text-white">
                  Terms
                </Link>
              </li>
              <li>
                <Link href="/login" className="text-white/85 transition-colors hover:text-white">
                  Sign in
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
