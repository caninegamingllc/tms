import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";
import { updateOwnProfile } from "@/lib/profile-actions";
import { DISPLAY_NAME_MAX_LENGTH } from "@/lib/profile";

export default async function ProfilePage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; updated?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  return (
    <>
      <PageHeader
        title="Profile"
        description="Your name and organization details for this TMS account."
        action={
          <Link href="/settings" className="btn-secondary">
            Settings
          </Link>
        }
      />

      {params.error ? (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
          {params.error}
        </div>
      ) : null}

      {params.updated ? (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
          Profile updated.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="font-display text-lg font-semibold text-foreground">Display name</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            This name appears in the navigation and on activity you create.
          </p>
          <form action={updateOwnProfile} className="mt-4 grid gap-4">
            <label className="grid gap-2">
              <span className="label">Name</span>
              <input
                name="name"
                className="input"
                type="text"
                defaultValue={user.name}
                maxLength={DISPLAY_NAME_MAX_LENGTH}
                required
                autoComplete="name"
              />
            </label>
            <button className="btn w-fit" type="submit">
              Save name
            </button>
          </form>
        </div>

        <div className="card p-6">
          <h2 className="font-display text-lg font-semibold text-foreground">Account details</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Login email and organization context are managed by your administrator.
          </p>
          <dl className="mt-4 grid gap-3 text-sm">
            <div>
              <dt className="label">Email</dt>
              <dd className="mt-1 font-medium text-foreground">{user.email}</dd>
            </div>
            <div>
              <dt className="label">Current organization</dt>
              <dd className="mt-1 font-medium text-foreground">{user.companyName}</dd>
            </div>
            <div>
              <dt className="label">Role</dt>
              <dd className="mt-1 font-medium text-foreground">{user.role}</dd>
            </div>
          </dl>

          {user.organizations.length > 1 ? (
            <div className="mt-6">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Organizations
              </h3>
              <ul className="mt-3 grid gap-2">
                {user.organizations.map((org) => (
                  <li
                    key={org.membershipId}
                    className="rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <p className="font-semibold text-foreground">{org.companyName}</p>
                    <p className="text-muted-foreground">
                      {org.role}
                      {org.membershipId === user.membershipId ? " · Current" : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
