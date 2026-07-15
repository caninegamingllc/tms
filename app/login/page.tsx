import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, login } from "@/lib/auth";
import { OAuthButtons } from "@/components/oauth-buttons";
import { isGoogleOAuthConfigured } from "@/lib/oauth/google";
import { isMicrosoftOAuthConfigured } from "@/lib/oauth/microsoft";
import { prisma } from "@/lib/db";
import packageJson from "@/package.json";

const appVersion = packageJson.version;

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) {
    if (user.mustChangePassword) {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { passwordHash: true }
      });
      if (dbUser?.passwordHash) {
        redirect("/change-password");
      }
    }
    redirect("/");
  }

  const { error, message } = await searchParams;

  return (
    <main className="grid min-h-screen grid-cols-1 bg-background lg:grid-cols-[1.15fr_1fr]">
      <section className="relative isolate hidden overflow-hidden lg:block">
        <div className="absolute inset-0 brand-gradient" />
        <div className="surface-grid absolute inset-0 opacity-[0.18] mix-blend-overlay" aria-hidden />
        <div
          className="absolute -bottom-40 -left-40 h-[720px] w-[720px] rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(61,155,168,0.85) 0%, transparent 70%)" }}
        />
        <div
          className="absolute -top-32 right-[-10%] h-[560px] w-[560px] rounded-full opacity-30 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(229,168,75,0.55) 0%, transparent 70%)" }}
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
              <div className="font-display text-[15px] font-medium">TMS · v{appVersion}</div>
            </div>
          </div>

          <div className="max-w-xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/70">
              Freight brokerage · command center
            </div>
            <h1 className="font-display mt-4 text-[56px] leading-[0.98] font-semibold tracking-[-0.03em]">
              Move freight
              <br />
              like a broker,
              <br />
              <span className="italic text-white/80">not a spreadsheet.</span>
            </h1>
            <p className="mt-6 max-w-md text-[14px] leading-relaxed text-white/80">
              Dispatch, quote, cover, and settle every load in one dense workspace built for brokers who
              count every mile and every margin point.
            </p>
          </div>

          <div className="border-t border-white/15 pt-6 text-[11px] uppercase tracking-[0.2em] text-white/60">
            © {new Date().getFullYear()} Simple Source Logistics
          </div>
        </div>
      </section>

      <section className="flex items-center justify-center px-6 py-10 lg:px-16">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="brand-gradient flex h-9 w-9 items-center justify-center rounded-md text-white">
              <span className="font-display text-lg font-semibold">S</span>
            </div>
            <div className="font-display text-lg font-semibold">Simple Source</div>
          </div>

          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Welcome back
          </p>
          <h1 className="font-display mt-1 text-[2rem] font-semibold tracking-tight text-foreground">
            Sign in to TMS
          </h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            Access loads, dispatch, accounting, reports, and admin tools.
          </p>

          {error ? (
            <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
              {error}
            </div>
          ) : null}

          {message ? (
            <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
              {message}
            </div>
          ) : null}

          <div className="mt-6">
            <OAuthButtons
              mode="login"
              googleConfigured={isGoogleOAuthConfigured()}
              microsoftConfigured={isMicrosoftOAuthConfigured()}
            />
          </div>

          <form action={login} className="mt-6 grid gap-3">
            <label className="grid gap-1.5">
              <span className="label">Email</span>
              <input name="email" className="input" type="email" autoComplete="email" required />
            </label>
            <label className="grid gap-1.5">
              <span className="label">Password</span>
              <input
                name="password"
                className="input"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <div className="flex justify-end">
              <Link href="/forgot-password" className="text-[13px] font-semibold text-primary">
                Forgot password?
              </Link>
            </div>
            <button className="btn" type="submit">
              Sign In
            </button>
          </form>

          <p className="mt-5 text-[13px] text-muted-foreground">
            New brokerage?{" "}
            <Link href="/register" className="font-semibold text-primary">
              Create a company workspace
            </Link>
          </p>
          <p className="mt-5 text-center text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Version {appVersion}
          </p>
        </div>
      </section>
    </main>
  );
}
