"use client";

import { useState } from "react";
import { settleBranchCommission } from "@/lib/commission-actions";

type CommissionRow = {
  id: string;
  loadId: string;
  loadNumber: string;
  branchName: string;
  customerName: string;
  lane: string;
  pickupDate: string;
  revenue: string;
  grossExpenses: string;
  grossProfit: string;
  commissionable: boolean;
  profileName: string;
  branchCommission: string;
  companyShare: string;
  calculationMethod: string;
  status: string;
  customerPaidAt: string;
  canSettle: boolean;
};

export function CommissionSettleTable({
  rows,
  canSettle
}: {
  rows: CommissionRow[];
  canSettle: boolean;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  const payableIds = rows.filter((row) => row.canSettle).map((row) => row.id);
  const allSelected = payableIds.length > 0 && payableIds.every((id) => selected.includes(id));

  function toggleAll() {
    setSelected(allSelected ? [] : payableIds);
  }

  function toggleOne(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  }

  return (
    <section className="card overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border p-5">
        <div>
          <h2 className="section-title">Commission & Settlement</h2>
          <p className="muted">Branch commission becomes payable once the customer has paid the load.</p>
        </div>
        {canSettle ? (
          <form action={settleBranchCommission}>
            {selected.map((id) => (
              <input key={id} type="hidden" name="commissionIds" value={id} />
            ))}
            <button type="submit" className="btn" disabled={selected.length === 0}>
              Mark {selected.length || ""} selected as settled
            </button>
          </form>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              {canSettle ? (
                <th>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Select all payable commissions"
                  />
                </th>
              ) : null}
              <th>Load</th>
              <th>Branch</th>
              <th>Customer</th>
              <th>Lane</th>
              <th>Pickup</th>
              <th>Revenue</th>
              <th>Gross Expenses</th>
              <th>Gross Profit</th>
              <th>Commissionable</th>
              <th>Profile</th>
              <th>Branch Commission</th>
              <th>Company Share</th>
              <th>Calc Method</th>
              <th>Settlement</th>
              <th>Customer Paid</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={canSettle ? 16 : 15} className="muted">
                  No commission records match the current filters.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  {canSettle ? (
                    <td>
                      {row.canSettle ? (
                        <input
                          type="checkbox"
                          checked={selected.includes(row.id)}
                          onChange={() => toggleOne(row.id)}
                          aria-label={`Select ${row.loadNumber}`}
                        />
                      ) : null}
                    </td>
                  ) : null}
                  <td>
                    <a href={`/loads/${row.loadId}`} className="font-semibold text-primary">
                      {row.loadNumber}
                    </a>
                  </td>
                  <td>{row.branchName}</td>
                  <td>{row.customerName}</td>
                  <td>{row.lane}</td>
                  <td>{row.pickupDate}</td>
                  <td>{row.revenue}</td>
                  <td>{row.grossExpenses}</td>
                  <td>{row.grossProfit}</td>
                  <td>{row.commissionable ? "Yes" : "No"}</td>
                  <td>{row.profileName}</td>
                  <td className="font-semibold">{row.branchCommission}</td>
                  <td>{row.companyShare}</td>
                  <td>{row.calculationMethod}</td>
                  <td>{row.status}</td>
                  <td>{row.customerPaidAt}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
