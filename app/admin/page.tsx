import { AdminUsersTable } from "@/components/admin-users-table";
import { AuditLogTable } from "@/components/audit-log-table";
import { PageHeader } from "@/components/page-header";
import { createBranch, deleteBranch, inviteUser, updateLoadNumberSettings } from "@/lib/admin-actions";
import { InviteLinkBanner } from "@/components/invite-link-banner";
import { refreshSeatSubscriptionFromStripe } from "@/lib/billing-actions";
import { requireAdmin } from "@/lib/auth";
import { userRoles, userStatuses } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { humanize } from "@/lib/format";
import { getSeatSummary } from "@/lib/seats";
import Link from "next/link";

export default async function AdminPage({
  searchParams
}: {
  searchParams: Promise<{ invite?: string; emailSent?: string; error?: string }>;
}) {
  const currentUser = await requireAdmin();
  const { invite, emailSent, error } = await searchParams;
  await refreshSeatSubscriptionFromStripe(currentUser.companyId);
  const [company, memberships, branches, auditLogs, seatSummary] = await Promise.all([
    prisma.company.findUniqueOrThrow({ where: { id: currentUser.companyId } }),
    prisma.companyMembership.findMany({
      where: { companyId: currentUser.companyId },
      include: {
        user: {
          include: {
            _count: {
              select: { notes: true, activities: true }
            }
          }
        },
        branch: true
      },
      orderBy: { user: { name: "asc" } }
    }),
    prisma.branch.findMany({
      where: { companyId: currentUser.companyId },
      include: { memberships: true, customers: true, carriers: true, loads: true }
    }),
    prisma.auditLog.findMany({
      where: { companyId: currentUser.companyId },
      orderBy: { createdAt: "desc" },
      include: { actorUser: true, targetUser: true },
      take: 50
    }),
    getSeatSummary(currentUser.companyId)
  ]);

  const ownerCount = memberships.filter(
    (membership) => membership.role === "OWNER" && membership.status !== "INVITED"
  ).length;

  const userRows = memberships.map((membership) => {
    const user = membership.user;
    const loadUsageCount = user._count.notes + user._count.activities;

    return {
      membershipId: membership.id,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      role: membership.role,
      branchId: membership.branchId,
      branchName: membership.branch?.name ?? null,
      status: membership.status,
      seatAssigned: Boolean(membership.seatAssignedAt),
      seatAssignedAt: membership.seatAssignedAt?.toISOString() ?? null,
      mustChangePassword: user.mustChangePassword,
      lockedAt: membership.lockedAt?.toISOString() ?? null,
      disabledAt: membership.disabledAt?.toISOString() ?? null,
      createdAt: membership.createdAt.toISOString(),
      passwordResetAt: user.passwordResetAt?.toISOString() ?? null,
      notesCount: user._count.notes,
      activitiesCount: user._count.activities,
      canDeleteUser:
        membership.status !== "INVITED" &&
        currentUser.id !== user.id &&
        loadUsageCount === 0 &&
        !(membership.role === "OWNER" && ownerCount <= 1) &&
        (currentUser.role === "OWNER" || membership.role !== "OWNER")
    };
  });

  const auditRows = auditLogs.map((log) => ({
    id: log.id,
    createdAt: log.createdAt.toISOString(),
    actorEmail: log.actorUser?.email ?? "System",
    action: log.action,
    target: log.targetUser?.email ?? log.entityId ?? log.entityType ?? "—",
    details: log.details ?? "No details"
  }));

  const branchOptions = branches.map((branch) => ({ id: branch.id, name: branch.name }));

  return (
    <>
      <PageHeader
        title="Admin Console"
        description="Invite users, manage roles and branches, disable accounts, and review audit history."
      />

      {error ? (
        <div className="card mb-6 border-rose-200 bg-rose-50 text-sm font-semibold text-rose-700">
          {error}
        </div>
      ) : null}

      {invite ? <InviteLinkBanner invitePath={invite} emailSent={emailSent === "1"} /> : null}

      <div className="card mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="section-title">Seat Usage</h2>
            <p className="muted">
              {seatSummary.assigned} of {seatSummary.purchased} seats assigned ({seatSummary.available}{" "}
              available)
            </p>
          </div>
          <Link href="/admin/billing" className="btn-secondary">
            Manage Billing
          </Link>
        </div>
      </div>

      <div className="grid gap-6 2xl:grid-cols-[1.4fr_0.8fr]">
        <section className="card overflow-hidden p-0">
          <div className="border-b border-border p-5">
            <h2 className="section-title">Users, Roles, And Account Status</h2>
            <p className="muted">Admins can update access, force password changes, and lock or disable accounts. Click column headers to sort.</p>
          </div>
          <div className="overflow-x-auto">
            <AdminUsersTable
              rows={userRows}
              branches={branchOptions}
              currentUserId={currentUser.id}
              currentUserRole={currentUser.role}
              seatAvailable={seatSummary.available}
            />
          </div>
        </section>

        <section className="card">
          <h2 className="section-title">Invite User</h2>
          <p className="muted">Send an invite email so the user can set their own password and join your organization.</p>
          <form action={inviteUser} className="mt-4 grid gap-3">
            <input name="name" className="input" placeholder="Full name" required />
            <input name="email" className="input" type="email" placeholder="Email" required />
            <div className="grid gap-3 md:grid-cols-2">
              <select name="role" className="select" defaultValue="BROKER">
                {userRoles
                  .filter((role) => currentUser.role === "OWNER" || role !== "OWNER")
                  .map((role) => (
                  <option key={role} value={role}>
                    {humanize(role)}
                  </option>
                ))}
              </select>
              <select name="branchId" className="select" defaultValue="" required>
                <option value="">Select branch</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn">
              Send Invite
            </button>
          </form>
        </section>
      </div>

      <section className="card mt-6">
        <h2 className="section-title">Load Number Settings</h2>
        <p className="muted">
          Set the prefix and the next auto-generated load number. If the next number is set to
          2500, the next blank load number will be {company.loadNumberPrefix}-2500 and then
          increment from there.
        </p>
        <form action={updateLoadNumberSettings} className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <label className="grid gap-2">
            <span className="label">Prefix</span>
            <input
              name="loadNumberPrefix"
              className="input"
              defaultValue={company.loadNumberPrefix}
              placeholder="GLB"
              required
            />
          </label>
          <label className="grid gap-2">
            <span className="label">Next Load Number</span>
            <input
              name="nextLoadSequence"
              className="input"
              type="number"
              min={1}
              step={1}
              defaultValue={company.nextLoadSequence}
              required
            />
          </label>
          <div className="flex items-end">
            <button className="btn" type="submit">
              Save Settings
            </button>
          </div>
        </form>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.2fr]">
        <section className="card">
          <h2 className="section-title">Branches And Agents</h2>
          <form action={createBranch} className="mt-4 grid gap-3 rounded-2xl bg-muted p-4">
            <input name="name" className="input" placeholder="Branch name" required />
            <div className="grid gap-3 md:grid-cols-2">
              <input name="city" className="input" placeholder="City" />
              <input name="state" className="input" placeholder="State" maxLength={2} />
            </div>
            <button type="submit" className="btn">
              Create Branch
            </button>
          </form>
          <div className="mt-5 grid gap-3">
            {branches.map((branch) => {
              const canDeleteBranch = branch.loads.length === 0 && branch.customers.length === 0;

              return (
              <div key={branch.id} className="rounded-2xl border border-border p-4">
                <p className="font-semibold text-foreground">{branch.name}</p>
                <p className="muted">
                  {branch.city}, {branch.state}
                </p>
                <div className="mt-3 grid grid-cols-4 gap-2 text-center text-sm">
                  <div className="rounded-xl bg-muted p-2">
                    <p className="font-bold">{branch.memberships.length}</p>
                    <p className="text-xs text-muted-foreground">Users</p>
                  </div>
                  <div className="rounded-xl bg-muted p-2">
                    <p className="font-bold">{branch.customers.length}</p>
                    <p className="text-xs text-muted-foreground">Customers</p>
                  </div>
                  <div className="rounded-xl bg-muted p-2">
                    <p className="font-bold">{branch.carriers.length}</p>
                    <p className="text-xs text-muted-foreground">Carriers</p>
                  </div>
                  <div className="rounded-xl bg-muted p-2">
                    <p className="font-bold">{branch.loads.length}</p>
                    <p className="text-xs text-muted-foreground">Loads</p>
                  </div>
                </div>
                {canDeleteBranch ? (
                  <form action={deleteBranch} className="mt-3">
                    <input type="hidden" name="branchId" value={branch.id} />
                    <button className="btn-danger w-full" type="submit">
                      Delete Branch
                    </button>
                  </form>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Cannot delete while assigned to{" "}
                    {[
                      branch.loads.length > 0
                        ? `${branch.loads.length} load${branch.loads.length === 1 ? "" : "s"}`
                        : null,
                      branch.customers.length > 0
                        ? `${branch.customers.length} customer${branch.customers.length === 1 ? "" : "s"}`
                        : null
                    ]
                      .filter(Boolean)
                      .join(" and ")}
                    .
                  </p>
                )}
              </div>
              );
            })}
          </div>
        </section>

        <section className="card overflow-hidden p-0">
          <div className="border-b border-border p-5">
            <h2 className="section-title">Security Audit Log</h2>
            <p className="muted">Recent administrator and login events. Click column headers to sort.</p>
          </div>
          <div className="overflow-x-auto">
            <AuditLogTable logs={auditRows} />
          </div>
        </section>
      </div>
    </>
  );
}
