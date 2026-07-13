import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth";
import { getBranchSwitcherData } from "@/lib/branch-filter-server";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans"
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
      <body className={`${dmSans.variable} font-sans antialiased`}>
        <AppShell currentUser={currentUser} branchSwitcher={branchSwitcher}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
