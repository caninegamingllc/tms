import Link from "next/link";
import { AuthBrandPanel, AuthMobileBrand } from "@/components/auth-brand-panel";
import { RegisterAccountForm } from "@/components/register-account-form";
import { isGoogleOAuthConfigured } from "@/lib/oauth/google";
import { isMicrosoftOAuthConfigured } from "@/lib/oauth/microsoft";

export default async function RegisterPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="grid min-h-screen grid-cols-1 bg-background lg:grid-cols-[1.15fr_1fr]">
      <AuthBrandPanel />
      <section className="flex items-center justify-center px-6 py-10 lg:px-16">
        <div className="w-full max-w-lg">
          <AuthMobileBrand />
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            New workspace
          </p>
          <h1 className="font-display mt-1 text-[2rem] font-semibold tracking-tight text-foreground">
            Create your company
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Start a separate TMS workspace for your brokerage. Your customers, carriers, loads,
            documents, and accounting records stay isolated from other companies.
          </p>

          {error ? (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
              {error}
            </div>
          ) : null}

          <RegisterAccountForm
            googleConfigured={isGoogleOAuthConfigured()}
            microsoftConfigured={isMicrosoftOAuthConfigured()}
          />

          <p className="mt-5 text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-primary">
              Sign in
            </Link>
          </p>
          <p className="mt-4 text-center text-[12px] text-muted-foreground">
            <Link href="/privacy" className="font-semibold text-primary">
              Privacy Policy
            </Link>
            <span className="mx-2 text-border">|</span>
            <Link href="/terms" className="font-semibold text-primary">
              Terms of Service
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
