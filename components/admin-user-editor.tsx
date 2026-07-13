"use client";

import { BranchMultiSelect } from "@/components/branch-multi-select";
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
  branchIds: string[];
  branchNames: string[];
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

export function AdminUserEditor({
  user,
  branches,
  currentUserId,
  currentUserRole,
  seatAvailable
}: {
  user: AdminUserRow | null;
  branches: BranchOption[];
  currentUserId: string;
  currentUserRole: string;
  seatAvailable: number;
}) {
  if (!user) {
    return (
      <div className="flex h-full min-h-72 items-center justify-center rounded-2xl border border-dashed border-border p-8 text-center">
        <div>
          <p className="font-semibold text-foreground">Select a user to edit</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a user from the table to manage their role, branches, seat, and account settings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-foreground">{user.userName}</h3>
          <p className="muted">{user.userEmail}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge value={user.status} />
            {user.mustChangePassword ? (
              <span className="text-xs font-semibold text-amber-700">Password change required</span>
            ) : null}
          </div>
        </div>

        <div className="text-right text-xs text-muted-foreground">
          <p>Joined {formatDate(user.createdAt)}</p>
          <p>Last login: {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "Never"}</p>
        </div>
      </div>

      <section className="rounded-2xl border border-border p-4">
        <h4 className="section-title">Seat</h4>
        {user.seatAssigned ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-emerald-700">Seat assigned</p>
            <form action={unassignSeatFromMember}>
              <input type="hidden" name="membershipId" value={user.membershipId} />
              <button className="btn-secondary" type="submit">
                Remove Seat
              </button>
            </form>
          </div>
        ) : user.status === "INVITED" ? (
          <p className="mt-2 text-sm text-muted-foreground">Pending invite — seat can be assigned after acceptance.</p>
        ) : (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-amber-700">No seat assigned</p>
            <form action={assignSeatToMember}>
              <input type="hidden" name="membershipId" value={user.membershipId} />
              <button className="btn-secondary" type="submit" disabled={seatAvailable <= 0}>
                Assign Seat
              </button>
            </form>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border p-4">
        <h4 className="section-title">Access & Branches</h4>
        <form
          key={user.membershipId}
          action={updateAdminUser}
          className="mt-4 grid gap-4"
        >
          <input type="hidden" name="membershipId" value={user.membershipId} />

          <label className="grid gap-2">
            <span className="label">Full Name</span>
            <input name="name" className="input" defaultValue={user.userName} required />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="label">Role</span>
              <select name="role" className="select" defaultValue={user.role}>
                {userRoles
                  .filter((role) => currentUserRole === "OWNER" || role !== "OWNER")
                  .map((role) => (
                    <option key={role} value={role}>
                      {humanize(role)}
                    </option>
                  ))}
              </select>
            </label>

            <label className="grid gap-2">
              <span className="label">Status</span>
              <select name="status" className="select" defaultValue={user.status}>
                {userStatuses.map((status) => (
                  <option key={status} value={status}>
                    {humanize(status)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <BranchMultiSelect
            key={user.membershipId}
            branches={branches}
            selectedBranchIds={user.branchIds}
            primaryBranchId={user.branchId ?? user.branchIds[0] ?? null}
            required={user.role !== "OWNER" && user.role !== "ADMIN"}
          />

          <button className="btn" type="submit">
            Save Changes
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-border p-4">
        <h4 className="section-title">Security</h4>
        <form action={resetUserPassword} className="mt-4 grid gap-3">
          <input type="hidden" name="userId" value={user.userId} />
          <input name="newPassword" className="input" placeholder="New password" minLength={8} required />
          <button className="btn-secondary" type="submit">
            Reset Password
          </button>
        </form>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <form action={forcePasswordChange}>
            <input type="hidden" name="userId" value={user.userId} />
            <input type="hidden" name="mode" value={user.mustChangePassword ? "clear" : "force"} />
            <button className="btn-secondary w-full" type="submit">
              {user.mustChangePassword ? "Clear Force" : "Force Change"}
            </button>
          </form>
          <form action={setUserLock}>
            <input type="hidden" name="membershipId" value={user.membershipId} />
            <input type="hidden" name="mode" value={user.lockedAt ? "unlock" : "lock"} />
            <button
              className="btn-secondary w-full"
              type="submit"
              disabled={currentUserId === user.userId && !user.lockedAt}
            >
              {user.lockedAt ? "Unlock" : "Lock"}
            </button>
          </form>
        </div>
      </section>

      <section className="rounded-2xl border border-border p-4">
        <h4 className="section-title">Account Actions</h4>
        <div className="mt-4 grid gap-2">
          {user.status === "INVITED" ? (
            <>
              <form action={resendInvite}>
                <input type="hidden" name="membershipId" value={user.membershipId} />
                <button className="btn-secondary w-full" type="submit">
                  Resend Invite
                </button>
              </form>
              <form action={cancelInvite}>
                <input type="hidden" name="membershipId" value={user.membershipId} />
                <button className="btn-secondary w-full" type="submit">
                  Cancel Invite
                </button>
              </form>
            </>
          ) : (
            <>
              <form action={setUserDisabled}>
                <input type="hidden" name="membershipId" value={user.membershipId} />
                <input type="hidden" name="mode" value={user.disabledAt ? "enable" : "disable"} />
                <button
                  className="btn-secondary w-full"
                  type="submit"
                  disabled={currentUserId === user.userId && !user.disabledAt}
                >
                  {user.disabledAt ? "Enable Account" : "Disable Account"}
                </button>
              </form>
              {user.canDeleteUser ? (
                <form action={deleteUser}>
                  <input type="hidden" name="membershipId" value={user.membershipId} />
                  <button className="btn-danger w-full" type="submit">
                    Remove Member
                  </button>
                </form>
              ) : user.notesCount + user.activitiesCount > 0 ? (
                <p className="text-xs text-muted-foreground">
                  In use on {user.notesCount} note{user.notesCount === 1 ? "" : "s"} and {user.activitiesCount}{" "}
                  activit{user.activitiesCount === 1 ? "y" : "ies"}.
                </p>
              ) : null}
            </>
          )}

          {user.passwordResetAt ? (
            <p className="text-xs text-muted-foreground">Password reset {formatDate(user.passwordResetAt)}</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
