import Link from "next/link";
import { CommissionProfilesTable } from "@/components/commission-profiles-table";
import { PageHeader } from "@/components/page-header";
import { TileBoard, Tile } from "@/components/tile-board";
import { assignBranchCommissionProfile, createCommissionProfile, updateCommissionProfile } from "@/lib/commission-actions";
import { requireAdmin } from "@/lib/auth";
import { requirePlanFeature } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { COMMISSION_PROFILES_TILES } from "@/lib/tile-defaults";
import { loadPageLayouts } from "@/lib/ui-preferences-load";

export default async function CommissionProfilesPage() {
  await requirePlanFeature("commissions");
  const user = await requireAdmin();

  const [profiles, branches, layouts] = await Promise.all([
    prisma.commissionProfile.findMany({
      where: { companyId: user.companyId },
      include: { rule: true, branches: true },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }]
    }),
    prisma.branch.findMany({
      where: { companyId: user.companyId },
      include: { commissionProfile: true },
      orderBy: { name: "asc" }
    }),
    loadPageLayouts("commission-profiles")
  ]);

  const profileRows = profiles.map((profile) => ({
    id: profile.id,
    name: profile.name,
    branchSharePercent: String(profile.rule?.branchSharePercent ?? "—"),
    companySharePercent: String(profile.rule?.companySharePercent ?? "—"),
    expenseFloorPercent: String(profile.rule?.companyMinimumExpensePercent ?? "—"),
    isDefault: profile.isDefault,
    branchNames: profile.branches.map((branch) => branch.name).join(", ")
  }));

  const tiles =
    profiles.length > 0
      ? COMMISSION_PROFILES_TILES
      : COMMISSION_PROFILES_TILES.filter((tile) => tile.id !== "edit");

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

      <TileBoard pageId="commission-profiles" tiles={tiles} initialLayouts={layouts}>
        <Tile id="profiles">
          <p className="muted mb-3">
            Default rule: branch earns 60% of gross profit when company 40% meets the 10% expense floor.
            Click column headers to sort.
          </p>
          <div className="overflow-x-auto">
            <CommissionProfilesTable profiles={profileRows} />
          </div>
        </Tile>

        <Tile id="create">
          <form action={createCommissionProfile} className="grid gap-3">
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
        </Tile>

        {profiles.length > 0 ? (
          <Tile id="edit">
            <div className="grid gap-6">
              {profiles.map((profile) => (
                <div key={profile.id} className="rounded-lg border border-border p-4">
                  <p className="mb-3 text-[15px] font-semibold text-foreground">Edit {profile.name}</p>
                  <form action={updateCommissionProfile} className="grid gap-3">
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
                </div>
              ))}
            </div>
          </Tile>
        ) : null}

        <Tile id="assignment">
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
        </Tile>
      </TileBoard>
    </>
  );
}
