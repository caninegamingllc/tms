import Link from "next/link";
import { DispatchBoard } from "@/components/dispatch-board";
import { PageHeader } from "@/components/page-header";
import { parseDispatchBoardParams, serializeDispatchBoardRow } from "@/lib/dispatch-board";
import { getBranchScope } from "@/lib/branch-filter-server";
import { requirePlanFeature } from "@/lib/permissions";
import { prisma } from "@/lib/db";

export default async function DispatchPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePlanFeature("dispatch");
  const loadScope = await getBranchScope(user);
  const params = await searchParams;
  const { stages } = parseDispatchBoardParams(params);

  const loads = await prisma.load.findMany({
    where: {
      ...loadScope,
      status: { not: "CANCELED" }
    },
    orderBy: [{ pickupDate: "asc" }, { loadNumber: "asc" }],
    include: {
      customer: true,
      dispatchAssignments: {
        orderBy: { sequence: "asc" },
        include: {
          carrier: true,
          checkCalls: { orderBy: { occurredAt: "desc" }, take: 1 }
        }
      }
    }
  });

  const rows = loads
    .map((load) => serializeDispatchBoardRow(load))
    .filter((row): row is NonNullable<typeof row> => row !== null);

  return (
    <>
      <PageHeader
        title="Dispatch"
        description="Track freight through pending coverage, active dispatch, en route movement, delivery, invoicing, and payment."
        action={
          <Link href="/loads/new" className="btn">
            Create Load
          </Link>
        }
      />

      <DispatchBoard rows={rows} activeStages={stages} />
    </>
  );
}
