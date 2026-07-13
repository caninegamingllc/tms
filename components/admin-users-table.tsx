"use client";

import { SortableTable } from "@/components/sortable-table";
import { StatusBadge } from "@/components/status-badge";
import {
  assignSeatToMember,
  cancelInvite,
  deleteUser,
  forcePasswordChange,
  resendInvite,
  resetUserPassword,
  setUserDisabled,
  setUserLock,
  unassignSeatFromMember,
  updateAdminUser
} from "@/lib/admin-actions";
import { userRoles, userStatuses } from "@/lib/constants";
import { formatDate, formatDateTime, humanize } from "@/lib/format";

export type AdminUserRow = {
  membershipId: string;
  userId: string;
  userName: string;
  userEmail: string;
  lastLoginAt: string | null;
  role: string;
  branchId: string | null;
  branchName: string | null;
  status: string;
  seatAssigned: boolean;
  seatAssignedAt: string | null;
  mustChangePassword: boolean;
  lockedAt: string | null;
  disabledAt: string | null;
  createdAt: string;
  passwordResetAt: string | null;
  notesCount: number;
  activitiesCount: number;
  canDeleteUser: boolean;
};

type BranchOption = { id: string; name: string };

export function AdminUsersTable({
  rows,
  branches,
  currentUserId,
  currentUserRole,
  seatAvailable
}: {
  rows: AdminUserRow[];
  branches: BranchOption[];
  currentUserId: string;
  currentUserRole: string;
  seatAvailable: number;
}) {
  return (
    <SortableTable
      data={rows}
      keyExtractor={(row) => row.membershipId}
      defaultSort={{ columnId: "user", direction: "asc" }}
      columns={[
        {
          id: "seat",
          label: "Seat",
          sortValue: (row) => row.seatAssigned,
          render: (row) =>
            row.seatAssigned ? (
              <div className="grid gap-2">
                <span className="text-sm font-semibold text-emerald-700">Assigned</span>
                <form action={unassignSeatFromMember}>
                  <input type="hidden" name="membershipId" value={row.membershipId} />
                  <button className="btn-secondary w-full" type="submit">
                    Remove Seat
                  </button>
                </form>
              </div>
            ) : row.status === "INVITED" ? (
              <span className="text-sm text-muted-foreground">Pending invite</span>
            ) : (
              <div className="grid gap-2">
                <span className="text-sm font-semibold text-amber-700">Unassigned</span>
                <form action={assignSeatToMember}>
                  <input type="hidden" name="membershipId" value={row.membershipId} />
                  <button className="btn-secondary w-full" type="submit" disabled={seatAvailable <= 0}>
                    Assign Seat
                  </button>
                </form>
              </div>
            )
        },
        {
          id: "user",
          label: "User",
          sortValue: (row) => row.userName,
          render: (row) => (
            <>
              <p className="font-semibold text-foreground">{row.userName}</p>
              <p className="muted">{row.userEmail}</p>
              <p className="text-xs text-muted-foreground">
                Last login: {row.lastLoginAt ? formatDateTime(row.lastLoginAt) : "Never"}
              </p>
            </>
          )
        },
        {
          id: "access",
          label: "Access",
          sortValue: (row) => row.role,
          render: (row) => (
            <form action={updateAdminUser} className="grid min-w-64 gap-2">
              <input type="hidden" name="membershipId" value={row.membershipId} />
              <input name="name" className="input" defaultValue={row.userName} />
              <select name="role" className="select" defaultValue={row.role}>
                {userRoles
                  .filter((role) => currentUserRole === "OWNER" || role !== "OWNER")
                  .map((role) => (
                    <option key={role} value={role}>
                      {humanize(role)}
                    </option>
                  ))}
              </select>
              <select name="branchId" className="select" defaultValue={row.branchId ?? ""}>
                <option value="">No branch</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
              <select name="status" className="select" defaultValue={row.status}>
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
          )
        },
        {
          id: "status",
          label: "Status",
          sortValue: (row) => row.status,
          render: (row) => (
            <>
              <StatusBadge value={row.status} />
              <p className="mt-2 muted">{row.branchName ?? "No branch"}</p>
              {row.mustChangePassword ? (
                <p className="mt-2 text-sm font-semibold text-amber-700">Password change required</p>
              ) : null}
            </>
          )
        },
        {
          id: "security",
          label: "Security",
          sortable: false,
          render: (row) => (
            <>
              <form action={resetUserPassword} className="grid min-w-52 gap-2">
                <input type="hidden" name="userId" value={row.userId} />
                <input name="newPassword" className="input" placeholder="New password" minLength={8} required />
                <button className="btn-secondary" type="submit">
                  Reset Password
                </button>
              </form>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <form action={forcePasswordChange}>
                  <input type="hidden" name="userId" value={row.userId} />
                  <input type="hidden" name="mode" value={row.mustChangePassword ? "clear" : "force"} />
                  <button className="btn-secondary w-full" type="submit">
                    {row.mustChangePassword ? "Clear Force" : "Force Change"}
                  </button>
                </form>
                <form action={setUserLock}>
                  <input type="hidden" name="membershipId" value={row.membershipId} />
                  <input type="hidden" name="mode" value={row.lockedAt ? "unlock" : "lock"} />
                  <button
                    className="btn-secondary w-full"
                    type="submit"
                    disabled={currentUserId === row.userId && !row.lockedAt}
                  >
                    {row.lockedAt ? "Unlock" : "Lock"}
                  </button>
                </form>
              </div>
            </>
          )
        },
        {
          id: "actions",
          label: "Actions",
          sortable: false,
          render: (row) => (
            <>
              {row.status === "INVITED" ? (
                <div className="grid gap-2">
                  <form action={resendInvite}>
                    <input type="hidden" name="membershipId" value={row.membershipId} />
                    <button className="btn-secondary w-full" type="submit">
                      Resend Invite
                    </button>
                  </form>
                  <form action={cancelInvite}>
                    <input type="hidden" name="membershipId" value={row.membershipId} />
                    <button className="btn-secondary w-full" type="submit">
                      Cancel Invite
                    </button>
                  </form>
                </div>
              ) : (
                <div className="grid gap-2">
                  <form action={setUserDisabled}>
                    <input type="hidden" name="membershipId" value={row.membershipId} />
                    <input type="hidden" name="mode" value={row.disabledAt ? "enable" : "disable"} />
                    <button
                      className="btn-secondary w-full"
                      type="submit"
                      disabled={currentUserId === row.userId && !row.disabledAt}
                    >
                      {row.disabledAt ? "Enable Account" : "Disable Account"}
                    </button>
                  </form>
                  {row.canDeleteUser ? (
                    <form action={deleteUser}>
                      <input type="hidden" name="membershipId" value={row.membershipId} />
                      <button className="btn-danger w-full" type="submit">
                        Remove Member
                      </button>
                    </form>
                  ) : row.status !== "INVITED" && row.notesCount + row.activitiesCount > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      In use on {row.notesCount} note{row.notesCount === 1 ? "" : "s"} and {row.activitiesCount}{" "}
                      activit{row.activitiesCount === 1 ? "y" : "ies"}.
                    </p>
                  ) : null}
                </div>
              )}
              <p className="mt-2 text-xs text-muted-foreground">Joined {formatDate(row.createdAt)}</p>
              {row.passwordResetAt ? (
                <p className="text-xs text-muted-foreground">Password reset {formatDate(row.passwordResetAt)}</p>
              ) : null}
            </>
          )
        }
      ]}
    />
  );
}
