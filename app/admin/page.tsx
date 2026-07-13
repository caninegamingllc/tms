import { AdminBranchesTable } from "@/components/admin-branches-table";
import { AdminConsole } from "@/components/admin-console";
import { AuditLogTable } from "@/components/audit-log-table";
import { PageHeader } from "@/components/page-header";
import { createBranch, updateLoadNumberSettings } from "@/lib/admin-actions";
import { InviteLinkBanner } from "@/components/invite-link-banner";
import { refreshSeatSubscriptionFromStripe } from "@/lib/billing-actions";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSeatSummary } from "@/lib/seats";
import Link from "next/link";

export default async function AdminPage({
  searchParams
}: {
  searchParams: Promise<{ invite?: string; emailSent?: string; error?: string; tab?: string }>;
}) {
  const currentUser = await requireAdmin();
  const { invite, emailSent, error, tab } = await searchParams;
  const activeTab = tab === "branches" || tab === "settings" || tab === "audit" ? tab : "users";

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
        branch: true,
        assignedBranches: { include: { branch: true } }
      },
      orderBy: { user: { name: "asc" } }
    }),
    prisma.branch.findMany({
      where: { companyId: currentUser.companyId },
      include: {
        memberships: true,
        membershipBranches: true,
        customers: true,
        carriers: true,
        loads: true
      }
    }),
    prisma.auditLog.findMany({
      where: { companyId: currentUser.companyId },
      orderBy: { createdAt: "desc" },
      include: { actorUser: true, targetUser: true },
      take: 50
    }),
    getSeatSummary(currentUser.companyId)
  ]);

  const branchNameById = new Map(branches.map((branch) => [branch.id, branch.name]));
  const ownerCount = memberships.filter(
    (membership) => membership.role === "OWNER" && membership.status !== "INVITED"
  ).length;

  const userRows = memberships.map((membership) => {
    const user = membership.user;
    const loadUsageCount = user._count.notes + user._count.activities;
    const branchIds =
      membership.assignedBranches.length > 0
        ? membership.assignedBranches.map((row) => row.branchId)
        : membership.branchId
          ? [membership.branchId]
          : [];

    return {
      membershipId: membership.id,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      role: membership.role,
      branchId: membership.branchId,
      branchIds,
      branchNames: branchIds.map((id) => branchNameById.get(id) ?? "Unknown"),
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

  const branchRows = branches.map((branch) => ({
    id: branch.id,
    name: branch.name,
    city: branch.city,
    state: branch.state,
    userCount: new Set([
      ...branch.memberships.map((membership) => membership.id),
      ...branch.membershipBranches.map((row) => row.membershipId)
    ]).size,
    customerCount: branch.customers.length,
    carrierCount: branch.carriers.length,
    loadCount: branch.loads.length,
    canDelete: branch.loads.length === 0 && branch.customers.length === 0
  }));

  const tabs = [
    { id: "users", label: "Users" },
    { id: "branches", label: "Branches" },
    { id: "settings", label: "Settings" },
    { id: "audit", label: "Audit Log" }
  ] as const;

  return (
    <>
      <PageHeader
        title="Admin Console"
        description="Manage users, branch assignments, billing seats, and organization settings."
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

      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map((item) => (
          <Link
            key={item.id}
            href={`/admin?tab=${item.id}`}
            className={activeTab === item.id ? "btn" : "btn-secondary"}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {activeTab === "users" ? (
        <AdminConsole
          users={userRows}
          branches={branchOptions}
          currentUserId={currentUser.id}
          currentUserRole={currentUser.role}
          seatAvailable={seatSummary.available}
        />
      ) : null}

      {activeTab === "branches" ? (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <section className="card">
            <h2 className="section-title">Create Branch</h2>
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
          </section>

          <section className="card overflow-hidden p-0">
            <div className="border-b border-border p-5">
              <h2 className="section-title">Branches</h2>
              <p className="muted">All branches in your organization. Assign users to branches from the Users tab.</p>
            </div>
            <div className="overflow-x-auto">
              <AdminBranchesTable rows={branchRows} />
            </div>
          </section>
        </div>
      ) : null}

      {activeTab === "settings" ? (
        <section className="card">
          <h2 className="section-title">Load Number Settings</h2>
          <p className="muted">
            Set the prefix and the next auto-generated load number. If the next number is set to 2500, the next blank
            load number will be {company.loadNumberPrefix}-2500 and then increment from there.
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
      ) : null}

      {activeTab === "audit" ? (
        <section className="card overflow-hidden p-0">
          <div className="border-b border-border p-5">
            <h2 className="section-title">Security Audit Log</h2>
            <p className="muted">Recent administrator and login events. Click column headers to sort.</p>
          </div>
          <div className="overflow-x-auto">
            <AuditLogTable logs={auditRows} />
          </div>
        </section>
      ) : null}
    </>
  );
}
