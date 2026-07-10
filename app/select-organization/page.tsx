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
      <main className="flex min-h-screen items-center justify-center px-5">
        <div className="card max-w-md text-center">
          <h1 className="text-2xl font-bold text-ink">No organizations to select</h1>
          <Link href="/" className="btn mt-4 inline-flex">
            Continue
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5">
      <div className="card w-full max-w-lg">
        <PageHeader
          title="Select Organization"
          description="Choose which organization you want to work in."
        />

        {error ? (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        ) : null}

        <div className="mt-6 grid gap-3">
          {user.organizations.map((org) => (
            <form key={org.membershipId} action={selectOrganization}>
              <input type="hidden" name="membershipId" value={org.membershipId} />
              <button
                className="w-full rounded-2xl border border-border p-4 text-left transition hover:border-brand-300 hover:bg-brand-50"
                type="submit"
              >
                <p className="font-semibold text-ink">{org.companyName}</p>
                <p className="text-sm text-muted">Role: {org.role}</p>
                <p className="text-sm text-muted">
                  {org.hasSeat ? "Seat assigned — full TMS access" : "No seat — admin/billing only"}
                </p>
              </button>
            </form>
          ))}
        </div>
      </div>
    </main>
  );
}
