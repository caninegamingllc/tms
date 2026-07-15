import { CustomerPortalShell } from "@/components/customer-portal-shell";
import { CustomerDispatchBoard } from "@/components/customer-dispatch-board";
import { parseCustomerBoardParams } from "@/lib/customer-board";
import { requirePortalViewer } from "@/lib/portal-auth";
import { loadCustomerPortalBoardRows } from "@/lib/portal-queries";

export default async function PortalBoardPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const viewer = await requirePortalViewer();
  const params = await searchParams;
  const { stage } = parseCustomerBoardParams(params);
  const rows = await loadCustomerPortalBoardRows(viewer);

  return (
    <CustomerPortalShell viewer={viewer}>
      <div className="grid gap-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Dispatch
          </p>
          <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight">Your load board</h1>
        </div>
        <CustomerDispatchBoard rows={rows} stage={stage} />
      </div>
    </CustomerPortalShell>
  );
}
