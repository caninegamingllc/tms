import packageJson from "@/package.json";

export function AuthBrandPanel() {
  return (
    <section className="relative isolate hidden overflow-hidden lg:block">
      <div className="absolute inset-0 brand-gradient" />
      <div className="surface-grid absolute inset-0 opacity-[0.18] mix-blend-overlay" aria-hidden />
      <div
        className="absolute -bottom-40 -left-40 h-[720px] w-[720px] rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(61,155,168,0.85) 0%, transparent 70%)" }}
      />
      <div className="relative z-10 flex h-full flex-col justify-between p-12 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white/15 backdrop-blur">
            <span className="font-display text-xl font-semibold">S</span>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">
              Simple Source
            </div>
            <div className="font-display text-[15px] font-medium">TMS · v{packageJson.version}</div>
          </div>
        </div>
        <div className="max-w-xl">
          <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/70">
            Freight brokerage · command center
          </div>
          <h2 className="font-display mt-4 text-[48px] leading-[1.02] font-semibold tracking-[-0.03em]">
            One workspace for loads, carriers, and settlements.
          </h2>
          <p className="mt-5 max-w-md text-[14px] leading-relaxed text-white/80">
            Dense ops tools with a clear freight brand — built for brokers who live on margin points.
          </p>
        </div>
        <div className="border-t border-white/15 pt-6 text-[11px] uppercase tracking-[0.2em] text-white/60">
          © {new Date().getFullYear()} Simple Source Logistics
        </div>
      </div>
    </section>
  );
}

export function AuthMobileBrand() {
  return (
    <div className="mb-8 flex items-center gap-3 lg:hidden">
      <div className="brand-gradient flex h-9 w-9 items-center justify-center rounded-md text-white">
        <span className="font-display text-lg font-semibold">S</span>
      </div>
      <div className="font-display text-lg font-semibold">Simple Source</div>
    </div>
  );
}
