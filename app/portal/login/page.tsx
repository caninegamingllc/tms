import { redirect } from "next/navigation";
import { PortalLoginForm } from "@/components/portal-login-form";
import { getPortalViewer } from "@/lib/portal-auth";

export default async function PortalLoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const viewer = await getPortalViewer();
  if (viewer) {
    redirect("/portal");
  }

  const { error, message } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <PortalLoginForm error={error} message={message} />
    </main>
  );
}
