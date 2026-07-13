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
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-10">
      <section className="card w-full max-w-md overflow-hidden p-0">
        <div className="h-1 bg-primary" />
        <div className="p-6">
          <p className="text-lg font-bold text-primary">Simple Source</p>
          <h1 className="mt-1 text-2xl font-bold text-foreground">Sign in to TMS</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Access loads, dispatch, accounting, reports, and admin tools.
          </p>

          {error ? (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
              {error}
            </div>
          ) : null}

          {message ? (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
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

          <form action={login} className="mt-6 grid gap-4">
            <label className="grid gap-2">
              <span className="label">Email</span>
              <input name="email" className="input" type="email" autoComplete="email" required />
            </label>
            <label className="grid gap-2">
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
              <Link href="/forgot-password" className="text-sm font-semibold text-primary">
                Forgot password?
              </Link>
            </div>
            <button className="btn" type="submit">
              Sign In
            </button>
          </form>

          <div className="mt-5 rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">Development login</p>
            <p>Email: owner@example.com</p>
            <p>Password: ChangeMe123!</p>
          </div>

          <p className="mt-5 text-sm text-muted-foreground">
            New brokerage?{" "}
            <Link href="/register" className="font-semibold text-primary">
              Create a company workspace
            </Link>
          </p>
          <p className="mt-5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Version {appVersion}
          </p>
        </div>
      </section>
    </main>
  );
}
