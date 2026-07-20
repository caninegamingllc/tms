"use client";

import Link from "next/link";
import { portalLogin } from "@/lib/portal-auth-actions";

export function PortalLoginForm({ error, message }: { error?: string; message?: string }) {
  return (
    <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        Customer portal
      </p>
      <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        View your loads, tracking updates, and invoices.
      </p>

      {message ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <form action={portalLogin} className="mt-6 grid gap-3">
        <label className="grid gap-2">
          <span className="label">Email</span>
          <input name="email" type="email" className="input" required autoComplete="email" />
        </label>
        <label className="grid gap-2">
          <span className="label">Password</span>
          <input
            name="password"
            type="password"
            className="input"
            required
            autoComplete="current-password"
          />
        </label>
        <button type="submit" className="btn mt-2">
          Sign in
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Broker staff?{" "}
        <Link href="/login" className="font-semibold text-primary">
          TMS login
        </Link>
      </p>
    </div>
  );
}
