#!/usr/bin/env python3
"""One-time production migration for membership model."""
import os
import random
import shutil
import sqlite3
from datetime import datetime, timezone

DB_PATH = os.path.join(os.path.dirname(__file__), "dev.db")
BACKUP_PATH = DB_PATH + ".pre-membership-backup"


def cuid():
    return "cm" + random.randbytes(12).hex()


def main():
    if not os.path.exists(DB_PATH):
        raise SystemExit(f"Database not found: {DB_PATH}")

    if not os.path.exists(BACKUP_PATH):
        shutil.copy2(DB_PATH, BACKUP_PATH)
        print(f"Backup created: {BACKUP_PATH}")

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    columns = {row[1] for row in cur.execute("PRAGMA table_info(User)")}
    if "companyId" not in columns:
        print("User.companyId not found; migration already applied.")
        conn.close()
        return

    cur.executescript(
        """
        PRAGMA foreign_keys = OFF;
        CREATE TABLE IF NOT EXISTS "CompanyMembership" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "userId" TEXT NOT NULL,
          "companyId" TEXT NOT NULL,
          "role" TEXT NOT NULL DEFAULT 'BROKER',
          "status" TEXT NOT NULL DEFAULT 'ACTIVE',
          "branchId" TEXT,
          "seatAssignedAt" DATETIME,
          "inviteTokenHash" TEXT,
          "inviteExpiresAt" DATETIME,
          "lockedAt" DATETIME,
          "disabledAt" DATETIME,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE,
          FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE,
          FOREIGN KEY ("branchId") REFERENCES "Branch" ("id")
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "CompanyMembership_userId_companyId_key"
          ON "CompanyMembership"("userId", "companyId");
        CREATE UNIQUE INDEX IF NOT EXISTS "CompanyMembership_inviteTokenHash_key"
          ON "CompanyMembership"("inviteTokenHash");
        CREATE INDEX IF NOT EXISTS "CompanyMembership_companyId_idx"
          ON "CompanyMembership"("companyId");

        CREATE TABLE IF NOT EXISTS "SeatSubscription" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "companyId" TEXT NOT NULL,
          "stripeCustomerId" TEXT,
          "stripeSubscriptionId" TEXT,
          "stripePriceId" TEXT,
          "seatQuantity" INTEGER NOT NULL DEFAULT 0,
          "status" TEXT NOT NULL DEFAULT 'NONE',
          "currentPeriodEnd" DATETIME,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "SeatSubscription_companyId_key"
          ON "SeatSubscription"("companyId");
        """
    )

    users = cur.execute(
        """
        SELECT id, companyId, role, status, branchId, inviteTokenHash,
               inviteExpiresAt, lockedAt, disabledAt
        FROM User
        WHERE companyId IS NOT NULL
        """
    ).fetchall()

    membership_by_user_company = {}
    seat_assigned_by_company = {}
    now = datetime.now(timezone.utc).isoformat()

    for user in users:
        existing = cur.execute(
            "SELECT id FROM CompanyMembership WHERE userId = ? AND companyId = ?",
            (user["id"], user["companyId"]),
        ).fetchone()

        seat_assigned_at = now if user["status"] == "ACTIVE" else None
        membership_id = existing["id"] if existing else cuid()

        if not existing:
            cur.execute(
                """
                INSERT INTO CompanyMembership (
                  id, userId, companyId, role, status, branchId, seatAssignedAt,
                  inviteTokenHash, inviteExpiresAt, lockedAt, disabledAt
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    membership_id,
                    user["id"],
                    user["companyId"],
                    user["role"],
                    user["status"],
                    user["branchId"],
                    seat_assigned_at,
                    user["inviteTokenHash"],
                    user["inviteExpiresAt"],
                    user["lockedAt"],
                    user["disabledAt"],
                ),
            )

        membership_by_user_company[(user["id"], user["companyId"])] = membership_id
        if seat_assigned_at:
            seat_assigned_by_company[user["companyId"]] = (
                seat_assigned_by_company.get(user["companyId"], 0) + 1
            )

    for company in cur.execute("SELECT id FROM Company"):
        assigned = seat_assigned_by_company.get(company["id"], 0)
        existing = cur.execute(
            "SELECT id FROM SeatSubscription WHERE companyId = ?",
            (company["id"],),
        ).fetchone()
        if not existing:
            cur.execute(
                """
                INSERT INTO SeatSubscription (id, companyId, seatQuantity, status)
                VALUES (?, ?, ?, ?)
                """,
                (cuid(), company["id"], assigned, "ACTIVE" if assigned > 0 else "NONE"),
            )

    session_columns = {row[1] for row in cur.execute("PRAGMA table_info(Session)")}
    if "membershipId" not in session_columns:
        cur.execute('ALTER TABLE "Session" ADD COLUMN "membershipId" TEXT')

    for session in cur.execute("SELECT id, userId FROM Session"):
        user = cur.execute("SELECT companyId FROM User WHERE id = ?", (session["userId"],)).fetchone()
        if not user:
            cur.execute("DELETE FROM Session WHERE id = ?", (session["id"],))
            continue
        membership_id = membership_by_user_company.get((session["userId"], user["companyId"]))
        if not membership_id:
            cur.execute("DELETE FROM Session WHERE id = ?", (session["id"],))
            continue
        cur.execute(
            "UPDATE Session SET membershipId = ? WHERE id = ?",
            (membership_id, session["id"]),
        )

    cur.execute("DELETE FROM Session WHERE membershipId IS NULL")
    conn.commit()
    conn.close()
    print(f"Migrated {len(users)} users to memberships.")


if __name__ == "__main__":
    main()
