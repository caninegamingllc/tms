import type { Metadata } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
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
