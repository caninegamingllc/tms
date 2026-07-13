"use client";

import { useState } from "react";
import { AdminUserEditor, type AdminUserRow } from "@/components/admin-user-editor";
import { AdminUsersTable } from "@/components/admin-users-table";
import { BranchMultiSelect } from "@/components/branch-multi-select";
import { inviteUser } from "@/lib/admin-actions";
import { userRoles } from "@/lib/constants";
import { humanize } from "@/lib/format";

type BranchOption = { id: string; name: string };

export function AdminConsole({
  users,
  branches,
  currentUserId,
  currentUserRole,
  seatAvailable
}: {
  users: AdminUserRow[];
  branches: BranchOption[];
  currentUserId: string;
  currentUserRole: string;
  seatAvailable: number;
}) {
  const [selectedMembershipId, setSelectedMembershipId] = useState<string | null>(
    users[0]?.membershipId ?? null
  );
  const [showInvite, setShowInvite] = useState(false);

  const selectedUser = users.find((user) => user.membershipId === selectedMembershipId) ?? null;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="section-title">Users</h2>
          <p className="muted">
            {users.length} team member{users.length === 1 ? "" : "s"}. Select a user to edit their access and branches.
          </p>
        </div>
        <button type="button" className="btn" onClick={() => setShowInvite((current) => !current)}>
          {showInvite ? "Close Invite Form" : "Invite User"}
        </button>
      </div>

      {showInvite ? (
        <section className="card">
          <h3 className="section-title">Invite User</h3>
          <p className="muted">Send an invite email so the user can set their password and join your organization.</p>
          <form action={inviteUser} className="mt-4 grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <input name="name" className="input" placeholder="Full name" required />
              <input name="email" className="input" type="email" placeholder="Email" required />
            </div>

            <label className="grid gap-2 md:max-w-xs">
              <span className="label">Role</span>
              <select name="role" className="select" defaultValue="BROKER">
                {userRoles
                  .filter((role) => currentUserRole === "OWNER" || role !== "OWNER")
                  .map((role) => (
                    <option key={role} value={role}>
                      {humanize(role)}
                    </option>
                  ))}
              </select>
            </label>

            <BranchMultiSelect branches={branches} selectedBranchIds={[]} required />

            <button type="submit" className="btn md:w-fit">
              Send Invite
            </button>
          </form>
        </section>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="card overflow-hidden p-0">
          <AdminUsersTable
            rows={users}
            selectedMembershipId={selectedMembershipId}
            onSelect={setSelectedMembershipId}
          />
        </section>

        <section className="card">
          <AdminUserEditor
            user={selectedUser}
            branches={branches}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
            seatAvailable={seatAvailable}
          />
        </section>
      </div>
    </div>
  );
}
