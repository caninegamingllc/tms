import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import {
  cancelInvite,
  createBranch,
  deleteBranch,
  deleteUser,
  forcePasswordChange,
  inviteUser,
  resendInvite,
  resetUserPassword,
  setUserDisabled,
  setUserLock,
  updateAdminUser,
  updateLoadNumberSettings
} from "@/lib/admin-actions";
import { InviteLinkBanner } from "@/components/invite-link-banner";
import { requireAdmin } from "@/lib/auth";
import { userRoles, userStatuses } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { formatDate, formatDateTime, humanize } from "@/lib/format";

export default async function AdminPage({
  searchParams
}: {
  searchParams: Promise<{ invite?: string; emailSent?: string; error?: string }>;
}) {
  const currentUser = await requireAdmin();
  const { invite, emailSent, error } = await searchParams;
  const [company, users, branches, auditLogs] = await Promise.all([
    prisma.company.findUniqueOrThrow({ where: { id: currentUser.companyId } }),
    prisma.user.findMany({
      where: { companyId: currentUser.companyId },
      include: {
        branch: true,
        _count: {
          select: { notes: true, activities: true }
        }
      },
      orderBy: { name: "asc" }
    }),
    prisma.branch.findMany({
      where: { companyId: currentUser.companyId },
      include: { users: true, customers: true, carriers: true, loads: true }
    }),
    prisma.auditLog.findMany({
      where: { companyId: currentUser.companyId },
      orderBy: { createdAt: "desc" },
      include: { actorUser: true, targetUser: true },
      take: 50
    })
  ]);

  const ownerCount = users.filter((user) => user.role === "OWNER" && user.status !== "INVITED").length;

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

      <div className="grid gap-6 2xl:grid-cols-[1.4fr_0.8fr]">
        <section className="card overflow-hidden p-0">
          <div className="border-b border-border p-5">
            <h2 className="section-title">Users, Roles, And Account Status</h2>
            <p className="muted">Admins can update access, force password changes, and lock or disable accounts.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Access</th>
                  <th>Status</th>
                  <th>Security</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const loadUsageCount = user._count.notes + user._count.activities;
                  const canDeleteUser =
                    user.status !== "INVITED" &&
                    currentUser.id !== user.id &&
                    loadUsageCount === 0 &&
                    !(user.role === "OWNER" && ownerCount <= 1) &&
                    (currentUser.role === "OWNER" || user.role !== "OWNER");

                  return (
                  <tr key={user.id}>
                    <td>
                      <p className="font-semibold text-ink">{user.name}</p>
                      <p className="muted">{user.email}</p>
                      <p className="text-xs text-muted">Last login: {formatDateTime(user.lastLoginAt)}</p>
                    </td>
                    <td>
                      <form action={updateAdminUser} className="grid min-w-64 gap-2">
                        <input type="hidden" name="userId" value={user.id} />
                        <input name="name" className="input" defaultValue={user.name} />
                        <select name="role" className="select" defaultValue={user.role}>
                          {userRoles
                            .filter((role) => currentUser.role === "OWNER" || role !== "OWNER")
                            .map((role) => (
                            <option key={role} value={role}>
                              {humanize(role)}
                            </option>
                          ))}
                        </select>
                        <select name="branchId" className="select" defaultValue={user.branchId ?? ""}>
                          <option value="">No branch</option>
                          {branches.map((branch) => (
                            <option key={branch.id} value={branch.id}>
                              {branch.name}
                            </option>
                          ))}
                        </select>
                        <select name="status" className="select" defaultValue={user.status}>
                          {userStatuses.map((status) => (
                            <option key={status} value={status}>
                              {humanize(status)}
                            </option>
                          ))}
                        </select>
                        <button className="btn-secondary" type="submit">
                          Save Access
                        </button>
                      </form>
                    </td>
                    <td>
                      <StatusBadge value={user.status} />
                      <p className="mt-2 muted">{user.branch?.name ?? "No branch"}</p>
                      {user.mustChangePassword ? (
                        <p className="mt-2 text-sm font-semibold text-amber-700">Password change required</p>
                      ) : null}
                    </td>
                    <td>
                      <form action={resetUserPassword} className="grid min-w-52 gap-2">
                        <input type="hidden" name="userId" value={user.id} />
                        <input name="newPassword" className="input" placeholder="New password" minLength={8} required />
                        <button className="btn-secondary" type="submit">
                          Reset Password
                        </button>
                      </form>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <form action={forcePasswordChange}>
                          <input type="hidden" name="userId" value={user.id} />
                          <input type="hidden" name="mode" value={user.mustChangePassword ? "clear" : "force"} />
                          <button className="btn-secondary w-full" type="submit">
                            {user.mustChangePassword ? "Clear Force" : "Force Change"}
                          </button>
                        </form>
                        <form action={setUserLock}>
                          <input type="hidden" name="userId" value={user.id} />
                          <input type="hidden" name="mode" value={user.lockedAt ? "unlock" : "lock"} />
                          <button className="btn-secondary w-full" type="submit" disabled={currentUser.id === user.id && !user.lockedAt}>
                            {user.lockedAt ? "Unlock" : "Lock"}
                          </button>
                        </form>
                      </div>
                    </td>
                    <td>
                      {user.status === "INVITED" ? (
                        <div className="grid gap-2">
                          <form action={resendInvite}>
                            <input type="hidden" name="userId" value={user.id} />
                            <button className="btn-secondary w-full" type="submit">
                              Resend Invite
                            </button>
                          </form>
                          <form action={cancelInvite}>
                            <input type="hidden" name="userId" value={user.id} />
                            <button className="btn-secondary w-full" type="submit">
                              Cancel Invite
                            </button>
                          </form>
                        </div>
                      ) : (
                        <div className="grid gap-2">
                          <form action={setUserDisabled}>
                            <input type="hidden" name="userId" value={user.id} />
                            <input type="hidden" name="mode" value={user.disabledAt ? "enable" : "disable"} />
                            <button className="btn-secondary w-full" type="submit" disabled={currentUser.id === user.id && !user.disabledAt}>
                              {user.disabledAt ? "Enable Account" : "Disable Account"}
                            </button>
                          </form>
                          {canDeleteUser ? (
                            <form action={deleteUser}>
                              <input type="hidden" name="userId" value={user.id} />
                              <button className="btn-danger w-full" type="submit">
                                Delete User
                              </button>
                            </form>
                          ) : user.status !== "INVITED" && loadUsageCount > 0 ? (
                            <p className="text-xs text-muted">
                              In use on {user._count.notes} note{user._count.notes === 1 ? "" : "s"} and{" "}
                              {user._count.activities} activit{user._count.activities === 1 ? "y" : "ies"}.
                            </p>
                          ) : null}
                        </div>
                      )}
                      <p className="mt-2 text-xs text-muted">
                        Created {formatDate(user.createdAt)}
                      </p>
                      {user.passwordResetAt ? (
                        <p className="text-xs text-muted">Password reset {formatDate(user.passwordResetAt)}</p>
                      ) : null}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
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
          <form action={createBranch} className="mt-4 grid gap-3 rounded-2xl bg-soft p-4">
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
                <p className="font-semibold text-ink">{branch.name}</p>
                <p className="muted">
                  {branch.city}, {branch.state}
                </p>
                <div className="mt-3 grid grid-cols-4 gap-2 text-center text-sm">
                  <div className="rounded-xl bg-soft p-2">
                    <p className="font-bold">{branch.users.length}</p>
                    <p className="text-xs text-muted">Users</p>
                  </div>
                  <div className="rounded-xl bg-soft p-2">
                    <p className="font-bold">{branch.customers.length}</p>
                    <p className="text-xs text-muted">Customers</p>
                  </div>
                  <div className="rounded-xl bg-soft p-2">
                    <p className="font-bold">{branch.carriers.length}</p>
                    <p className="text-xs text-muted">Carriers</p>
                  </div>
                  <div className="rounded-xl bg-soft p-2">
                    <p className="font-bold">{branch.loads.length}</p>
                    <p className="text-xs text-muted">Loads</p>
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
                  <p className="mt-3 text-xs text-muted">
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
            <p className="muted">Recent administrator and login events.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td>{formatDateTime(log.createdAt)}</td>
                    <td>{log.actorUser?.email ?? "System"}</td>
                    <td className="font-semibold">{humanize(log.action)}</td>
                    <td>{log.targetUser?.email ?? log.entityId ?? log.entityType}</td>
                    <td>{log.details ?? "No details"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
