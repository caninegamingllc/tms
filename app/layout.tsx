import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Freight Broker TMS",
  description: "A beginner-friendly freight broker transportation management system."
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const currentUser = await getCurrentUser();

  return (
    <html lang="en">
      <body>
        <AppShell currentUser={currentUser}>{children}</AppShell>
      </body>
    </html>
  );
}
