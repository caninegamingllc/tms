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

  if (portal) {
    return (
      <html lang="en">
        <body className={`${sourceSans.variable} ${fraunces.variable} font-sans antialiased`}>
          {children}
        </body>
      </html>
    );
  }

  const currentUser = await getCurrentUser();
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
