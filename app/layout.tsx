import type { Metadata } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth";
import { getBranchSwitcherData } from "@/lib/branch-filter-server";

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source-sans"
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces"
});

export const metadata: Metadata = {
  title: "Simple Source TMS",
  description:
    "Transportation management for freight brokers — loads, dispatch, accounting, and carrier operations."
};

async function isPortalRoute() {
  const headerStore = await headers();
  const pathname = headerStore.get("x-pathname") ?? "";
  return pathname === "/portal" || pathname.startsWith("/portal/");
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const portal = await isPortalRoute();
  // #region agent log
  {
    const headerStore = await headers();
    const pathname = headerStore.get("x-pathname") ?? "";
    fetch("http://127.0.0.1:7764/ingest/14c39c80-17b4-4dcd-8347-dae6ec7f550a", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "9554aa" },
      body: JSON.stringify({
        sessionId: "9554aa",
        runId: "pre-fix",
        hypothesisId: "D",
        location: "app/layout.tsx:RootLayout",
        message: "layout portal branch decision",
        data: { pathname, portal },
        timestamp: Date.now()
      })
    }).catch(() => {});
  }
  // #endregion

  if (portal) {
    return (
      <html lang="en">
        <body className={`${sourceSans.variable} ${fraunces.variable} font-sans antialiased`}>
          {children}
        </body>
      </html>
    );
  }

  // #region agent log
  fetch("http://127.0.0.1:7764/ingest/14c39c80-17b4-4dcd-8347-dae6ec7f550a", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "9554aa" },
    body: JSON.stringify({
      sessionId: "9554aa",
      runId: "pre-fix",
      hypothesisId: "D",
      location: "app/layout.tsx:non-portal",
      message: "entering staff AppShell path",
      data: {},
      timestamp: Date.now()
    })
  }).catch(() => {});
  // #endregion

  let currentUser;
  try {
    currentUser = await getCurrentUser();
  } catch (error) {
    // #region agent log
    fetch("http://127.0.0.1:7764/ingest/14c39c80-17b4-4dcd-8347-dae6ec7f550a", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "9554aa" },
      body: JSON.stringify({
        sessionId: "9554aa",
        runId: "pre-fix",
        hypothesisId: "D",
        location: "app/layout.tsx:getCurrentUser",
        message: "getCurrentUser threw in layout",
        data: {
          errorName: error instanceof Error ? error.name : "unknown",
          errorMessage: error instanceof Error ? error.message : String(error)
        },
        timestamp: Date.now()
      })
    }).catch(() => {});
    // #endregion
    throw error;
  }
  const branchSwitcher = currentUser ? await getBranchSwitcherData(currentUser) : null;

  return (
    <html lang="en">
      <body className={`${sourceSans.variable} ${fraunces.variable} font-sans antialiased`}>
        <AppShell currentUser={currentUser} branchSwitcher={branchSwitcher}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
