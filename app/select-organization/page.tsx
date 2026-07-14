import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { selectOrganization } from "@/lib/membership-actions";
import { requireUser } from "@/lib/auth";

export default async function SelectOrganizationPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const { error } = await searchParams;

  if (user.organizations.length <= 1) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-5">
        <div className="card max-w-md text-center">
          <p className="font-display text-lg font-semibold text-primary">Simple Source</p>
          <h1 className="mt-3 font-display text-2xl font-semibold text-foreground">No organizations to select</h1>
          <Link href="/" className="btn mt-4 inline-flex">
            Continue
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-10">
      <div className="card w-full max-w-lg overflow-hidden p-0">
        <div className="h-1 bg-primary" />
        <div className="p-6">
          <PageHeader
            title="Select organization"
            description="Choose which organization you want to work in."
          />

          {error ? (
            <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
          ) : null}

          <div className="mt-6 grid gap-3">
            {user.organizations.map((org) => (
              <form key={org.membershipId} action={selectOrganization}>
                <input type="hidden" name="membershipId" value={org.membershipId} />
                <button
                  className="w-full rounded-lg border border-border p-4 text-left transition hover:border-primary/30 hover:bg-lightprimary"
                  type="submit"
                >
                  <p className="font-semibold text-foreground">{org.companyName}</p>
                  <p className="text-sm text-muted-foreground">Role: {org.role}</p>
                  <p className="text-sm text-muted-foreground">
                    {org.hasSeat ? "Seat assigned — full TMS access" : "No seat — admin/billing only"}
                  </p>
                </button>
              </form>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
