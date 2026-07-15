import "server-only";
import { serializeCustomerBoardRow, type CustomerBoardRow } from "@/lib/customer-board";
import { prisma } from "@/lib/db";
import type { PortalViewer } from "@/lib/portal-auth";

export async function loadCustomerPortalBoardRows(viewer: PortalViewer): Promise<CustomerBoardRow[]> {
  const loads = await prisma.load.findMany({
    where: {
      companyId: viewer.companyId,
      customerId: viewer.customerId,
      status: { not: "CANCELED" }
    },
    include: {
      dispatchAssignment: {
        include: {
          carrier: { select: { name: true } },
          checkCalls: {
            orderBy: { occurredAt: "desc" },
            take: 1,
            select: {
              status: true,
              location: true,
              occurredAt: true
            }
          }
        }
      }
    },
    orderBy: [{ pickupDate: "desc" }, { loadNumber: "desc" }]
  });

  return loads
    .map(serializeCustomerBoardRow)
    .filter((row): row is CustomerBoardRow => row != null);
}
