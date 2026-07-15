import Link from "next/link";
import packageJson from "@/package.json";

const capabilities = [
  { label: "Dispatch", detail: "Assign, cover, and track every load" },
  { label: "Quoting", detail: "Price lanes with margin clarity" },
  { label: "Cover", detail: "Match carriers without the spreadsheet chase" },
  { label: "Settlements", detail: "Invoices, bills, and AR in one place" },
  { label: "Customer portal", detail: "Give shippers live visibility" }
];

export function MarketingLanding() {
  const year = new Date().getFullYear();

  return (
    <div className="landing min-h-screen bg-background text-foreground">
      <header className="landing-nav absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5 lg:px-10">
          <div className="flex items-center gap-3 text-white">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-white/15 backdrop-blur">
              <span className="font-display text-lg font-semibold">S</span>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/70">
                Simple Source
              </div>
              <div className="font-display text-[13px] font-medium leading-none">TMS</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/portal/login"
              className="hidden rounded-md px-3 py-1.5 text-[13px] font-semibold text-white/80 transition hover:text-white sm:inline-flex"
            >
              Customer portal
            </Link>
            <Link
              href="/login"
              className="rounded-md border border-white/25 bg-white/10 px-3 py-1.5 text-[13px] font-semibold text-white backdrop-blur transition hover:bg-white/20"
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <section className="landing-hero relative isolate flex min-h-[100svh] flex-col justify-end overflow-hidden pb-16 pt-28 text-white lg:justify-center lg:pb-24 lg:pt-24">
        <div className="absolute inset-0 brand-gradient" />
        <div className="surface-grid absolute inset-0 opacity-[0.18] mix-blend-overlay" aria-hidden />
        <div
          className="landing-glow absolute -bottom-40 -left-40 h-[720px] w-[720px] rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(61,155,168,0.85) 0%, transparent 70%)" }}
          aria-hidden
        />
        <div
          className="landing-glow landing-glow-delay absolute -top-32 right-[-10%] h-[560px] w-[560px] rounded-full opacity-30 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(229,168,75,0.55) 0%, transparent 70%)" }}
          aria-hidden
        />

        <div className="relative z-10 mx-auto w-full max-w-6xl px-6 lg:px-10">
          <div className="landing-hero-copy max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/70">
              Freight brokerage · command center
            </p>
            <h1 className="font-display mt-5 text-[clamp(2.75rem,8vw,5.5rem)] leading-[0.98] font-semibold tracking-[-0.03em]">
              Move freight
              <br />
              like a broker,
              <br />
              <span className="italic text-white/80">not a spreadsheet.</span>
            </h1>
            <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-white/80 sm:text-[16px]">
              Dispatch, quote, cover, and settle every load in one dense workspace built for brokers
              who count every mile and every margin point.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/register" className="landing-cta-primary">
                Start workspace
              </Link>
              <Link href="/login" className="landing-cta-secondary">
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:px-10 lg:py-24">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            One workspace
          </p>
          <h2 className="font-display mt-3 max-w-2xl text-[clamp(1.75rem,4vw,2.75rem)] font-semibold tracking-[-0.02em] text-foreground">
            Loads, carriers, and settlements — together.
          </h2>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            Simple Source TMS gives brokerage teams a clear freight brand and the ops density they
            need — without bouncing between tabs, sheets, and inboxes.
          </p>
        </div>
      </section>

      <section className="landing-section">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:px-10 lg:py-24">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Capabilities
          </p>
          <h2 className="font-display mt-3 text-[clamp(1.75rem,4vw,2.5rem)] font-semibold tracking-[-0.02em]">
            Built for the brokerage day.
          </h2>
          <ul className="mt-10 divide-y divide-border border-y border-border">
            {capabilities.map((item) => (
              <li
                key={item.label}
                className="landing-capability grid gap-1 py-5 sm:grid-cols-[10rem_1fr] sm:items-baseline sm:gap-8"
              >
                <span className="font-display text-[17px] font-semibold text-primary">{item.label}</span>
                <span className="text-[15px] text-muted-foreground">{item.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="landing-section relative isolate overflow-hidden">
        <div className="absolute inset-0 brand-gradient opacity-95" />
        <div className="surface-grid absolute inset-0 opacity-[0.14] mix-blend-overlay" aria-hidden />
        <div className="relative z-10 mx-auto max-w-6xl px-6 py-20 text-white lg:px-10 lg:py-24">
          <h2 className="font-display max-w-xl text-[clamp(1.75rem,4vw,2.75rem)] font-semibold tracking-[-0.02em]">
            Ready when your next load posts.
          </h2>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/80">
            Open a company workspace or sign in to the command center you already know.
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
      </section>

      <footer className="border-t border-border bg-background">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-end sm:justify-between lg:px-10">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="brand-gradient flex h-8 w-8 items-center justify-center rounded-md text-white">
                <span className="font-display text-sm font-semibold">S</span>
              </div>
              <div className="font-display text-[15px] font-semibold">Simple Source TMS</div>
            </div>
            <p className="mt-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              © {year} Simple Source Logistics · v{packageJson.version}
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] font-semibold text-muted-foreground">
            <Link href="/portal/login" className="transition hover:text-foreground">
              Customer portal
            </Link>
            <Link href="/privacy" className="transition hover:text-foreground">
              Privacy
            </Link>
            <Link href="/terms" className="transition hover:text-foreground">
              Terms
            </Link>
            <Link href="/login" className="transition hover:text-foreground">
              Sign in
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
