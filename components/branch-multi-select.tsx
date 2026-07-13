"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { clsx } from "clsx";

type BranchOption = { id: string; name: string };

export function BranchMultiSelect({
  branches,
  selectedBranchIds,
  primaryBranchId,
  name = "branchIds",
  primaryName = "primaryBranchId",
  required = false
}: {
  branches: BranchOption[];
  selectedBranchIds: string[];
  primaryBranchId?: string | null;
  name?: string;
  primaryName?: string;
  required?: boolean;
}) {
  const [selected, setSelected] = useState<string[]>(selectedBranchIds);
  const [primary, setPrimary] = useState<string | null>(
    primaryBranchId && selectedBranchIds.includes(primaryBranchId)
      ? primaryBranchId
      : selectedBranchIds[0] ?? null
  );

  function toggleBranch(branchId: string) {
    setSelected((current) => {
      if (current.includes(branchId)) {
        const next = current.filter((id) => id !== branchId);
        if (primary === branchId) {
          setPrimary(next[0] ?? null);
        }
        return next;
      }

      const next = [...current, branchId];
      if (!primary) {
        setPrimary(branchId);
      }
      return next;
    });
  }

  function setAsPrimary(branchId: string) {
    if (!selected.includes(branchId)) {
      setSelected((current) => [...current, branchId]);
    }
    setPrimary(branchId);
  }

  return (
    <div className="grid gap-2">
      <p className="label">Branches</p>
      <div className="rounded-xl border border-border">
        {branches.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">No branches available. Create a branch first.</p>
        ) : (
          branches.map((branch) => {
            const checked = selected.includes(branch.id);
            const isPrimary = primary === branch.id;

            return (
              <div
                key={branch.id}
                className="flex items-center justify-between gap-3 border-b border-border px-3 py-2 last:border-b-0"
              >
                <button
                  type="button"
                  className="flex flex-1 items-center gap-2 text-left text-sm"
                  onClick={() => toggleBranch(branch.id)}
                >
                  <span
                    className={clsx(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                      checked ? "border-primary bg-primary text-primary-foreground" : "border-border"
                    )}
                  >
                    {checked ? <Check className="h-3 w-3" /> : null}
                  </span>
                  <span>{branch.name}</span>
                  {isPrimary ? (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                      Primary
                    </span>
                  ) : null}
                </button>

                {checked && !isPrimary ? (
                  <button
                    type="button"
                    className="text-xs font-semibold text-primary hover:underline"
                    onClick={() => setAsPrimary(branch.id)}
                  >
                    Set primary
                  </button>
                ) : null}

                {checked ? <input type="hidden" name={name} value={branch.id} /> : null}
              </div>
            );
          })
        )}
      </div>

      {primary ? <input type="hidden" name={primaryName} value={primary} /> : null}

      {required && selected.length === 0 ? (
        <p className="text-xs text-amber-700">Select at least one branch.</p>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Users can filter their view by any assigned branch, or select All Branches to see everything they belong to.
      </p>
    </div>
  );
}
