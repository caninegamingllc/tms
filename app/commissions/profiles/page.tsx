import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { assignBranchCommissionProfile, createCommissionProfile, updateCommissionProfile } from "@/lib/commission-actions";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function CommissionProfilesPage() {
  const user = await requireAdmin();

  const [profiles, branches] = await Promise.all([
    prisma.commissionProfile.findMany({
      where: { companyId: user.companyId },
      include: { rule: true, branches: true },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }]
    }),
    prisma.branch.findMany({
      where: { companyId: user.companyId },
      include: { commissionProfile: true },
      orderBy: { name: "asc" }
    })
  ]);

  return (
    <>
      <PageHeader
        title="Commission Profiles"
        description="Create commission rules and assign default profiles to branches."
        action={
          <Link href="/commissions" className="btn-secondary">
            Back to Commissions
          </Link>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="card overflow-hidden p-0">
          <div className="border-b border-border p-5">
            <h2 className="section-title">Profiles</h2>
            <p className="muted">Default rule: branch earns 60% of gross profit when company 40% meets the 10% expense floor.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Branch %</th>
                  <th>Company %</th>
                  <th>Expense Floor %</th>
                  <th>Default</th>
                  <th>Branches</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((profile) => (
                  <tr key={profile.id}>
                    <td className="font-semibold">{profile.name}</td>
                    <td>{profile.rule?.branchSharePercent ?? "—"}%</td>
                    <td>{profile.rule?.companySharePercent ?? "—"}%</td>
                    <td>{profile.rule?.companyMinimumExpensePercent ?? "—"}%</td>
                    <td>{profile.isDefault ? "Yes" : "No"}</td>
                    <td>{profile.branches.map((branch) => branch.name).join(", ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <h2 className="section-title">Create Profile</h2>
          <form action={createCommissionProfile} className="mt-4 grid gap-3">
            <input name="name" className="input" placeholder="Profile name" required />
            <div className="grid gap-3 md:grid-cols-3">
              <label className="grid gap-2">
                <span className="label">Branch %</span>
                <input name="branchSharePercent" className="input" type="number" min={0} max={100} defaultValue={60} required />
              </label>
              <label className="grid gap-2">
                <span className="label">Company %</span>
                <input name="companySharePercent" className="input" type="number" min={0} max={100} defaultValue={40} required />
              </label>
              <label className="grid gap-2">
                <span className="label">Expense Floor %</span>
                <input name="companyMinimumExpensePercent" className="input" type="number" min={0} max={100} defaultValue={10} required />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isDefault" />
              Set as company default profile
            </label>
            <button type="submit" className="btn">
              Create Profile
            </button>
          </form>
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        {profiles.map((profile) => (
          <section key={profile.id} className="card">
            <h2 className="section-title">Edit {profile.name}</h2>
            <form action={updateCommissionProfile} className="mt-4 grid gap-3">
              <input type="hidden" name="profileId" value={profile.id} />
              <input name="name" className="input" defaultValue={profile.name} required />
              <div className="grid gap-3 md:grid-cols-3">
                <label className="grid gap-2">
                  <span className="label">Branch %</span>
                  <input
                    name="branchSharePercent"
                    className="input"
                    type="number"
                    min={0}
                    max={100}
                    defaultValue={profile.rule?.branchSharePercent ?? 60}
                    required
                  />
                </label>
                <label className="grid gap-2">
                  <span className="label">Company %</span>
                  <input
                    name="companySharePercent"
                    className="input"
                    type="number"
                    min={0}
                    max={100}
                    defaultValue={profile.rule?.companySharePercent ?? 40}
                    required
                  />
                </label>
                <label className="grid gap-2">
                  <span className="label">Expense Floor %</span>
                  <input
                    name="companyMinimumExpensePercent"
                    className="input"
                    type="number"
                    min={0}
                    max={100}
                    defaultValue={profile.rule?.companyMinimumExpensePercent ?? 10}
                    required
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="isDefault" defaultChecked={profile.isDefault} />
                Set as company default profile
              </label>
              <button type="submit" className="btn">
                Save Profile
              </button>
            </form>
          </section>
        ))}

        <section className="card">
          <h2 className="section-title">Branch Profile Assignment</h2>
          <p className="muted">Loads inherit the branch profile unless overridden on the load.</p>
          <div className="mt-4 grid gap-4">
            {branches.map((branch) => (
              <form key={branch.id} action={assignBranchCommissionProfile} className="grid gap-3 rounded-2xl border border-border p-4">
                <input type="hidden" name="branchId" value={branch.id} />
                <p className="font-semibold">{branch.name}</p>
                <select name="profileId" className="select" defaultValue={branch.commissionProfileId ?? ""}>
                  <option value="">Use company default</option>
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
                <button type="submit" className="btn-secondary">
                  Save Branch Profile
                </button>
              </form>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
