"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, GitBranch } from "lucide-react";
import { clsx } from "clsx";
import { setBranchFilter } from "@/lib/branch-filter-actions";
import type { BranchOption } from "@/lib/branch-filter";

export function BranchSwitcher({
  branches,
  selectedBranchIds,
  allSelected,
  primaryBranchId
}: {
  branches: BranchOption[];
  selectedBranchIds: string[];
  allSelected: boolean;
  primaryBranchId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  const effectiveSelection = allSelected ? branches.map((branch) => branch.id) : selectedBranchIds;
  const resolvedPrimaryId =
    primaryBranchId && branches.some((branch) => branch.id === primaryBranchId)
      ? primaryBranchId
      : branches[0]?.id ?? null;

  const label = allSelected
    ? "All Branches"
    : effectiveSelection.length === 1
      ? branches.find((branch) => branch.id === effectiveSelection[0])?.name ?? "1 Branch"
      : `${effectiveSelection.length} Branches`;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  function applySelection(nextAllSelected: boolean, nextBranchIds: string[]) {
    const formData = new FormData();
    formData.set("allBranches", nextAllSelected ? "true" : "false");
    for (const branchId of nextBranchIds) {
      formData.append("branchIds", branchId);
    }

    startTransition(() => {
      setBranchFilter(formData);
      setOpen(false);
    });
  }

  function toggleAllBranches() {
    if (allSelected) {
      // Leave only the user's primary branch selected.
      if (resolvedPrimaryId) {
        applySelection(false, [resolvedPrimaryId]);
        return;
      }
    }

    applySelection(true, []);
  }

  function toggleBranch(branchId: string) {
    const current = allSelected ? branches.map((branch) => branch.id) : [...selectedBranchIds];
    const next = current.includes(branchId)
      ? current.filter((id) => id !== branchId)
      : [...current, branchId];

    if (next.length === 0) {
      // Never clear everything — fall back to primary, or All if no primary.
      if (resolvedPrimaryId) {
        applySelection(false, [resolvedPrimaryId]);
        return;
      }

      applySelection(true, []);
      return;
    }

    if (next.length === branches.length) {
      applySelection(true, []);
      return;
    }

    applySelection(false, next);
  }

  function isBranchChecked(branchId: string) {
    return allSelected || selectedBranchIds.includes(branchId);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={isPending}
        onClick={() => setOpen((current) => !current)}
        className={clsx(
          "inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted",
          isPending && "opacity-60"
        )}
      >
        <GitBranch className="h-4 w-4 text-muted-foreground" />
        <span className="max-w-[180px] truncate">{label}</span>
      </button>

      {open ? (
        <div className="absolute top-full right-0 z-50 mt-1 min-w-[240px] rounded-lg border border-border bg-card py-1 shadow-lg">
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
            onClick={toggleAllBranches}
          >
            <span
              className={clsx(
                "flex h-4 w-4 items-center justify-center rounded border",
                allSelected ? "border-primary bg-primary text-primary-foreground" : "border-border"
              )}
            >
              {allSelected ? <Check className="h-3 w-3" /> : null}
            </span>
            All Branches
          </button>

          {branches.map((branch) => {
            const checked = isBranchChecked(branch.id);
            const isPrimary = resolvedPrimaryId === branch.id;

            return (
              <button
                key={branch.id}
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
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
                <span className="truncate">{branch.name}</span>
                {isPrimary ? (
                  <span className="ml-auto shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Primary
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
