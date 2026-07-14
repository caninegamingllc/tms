import { prisma } from "@/lib/db";

export type ResolvedApPayee = {
  displayName: string;
  nameOnCheck: string;
  factoringCompanyId: string | null;
  carrierId: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  /** QBO vendor id owned by factor or carrier */
  externalQboId?: string | null;
  qboOwner: "FACTOR" | "CARRIER";
  qboOwnerId: string;
};

export async function resolveCarrierApPayee(carrierId: string, companyId: string): Promise<ResolvedApPayee> {
  const carrier = await prisma.carrier.findUniqueOrThrow({
    where: { id: carrierId, companyId },
    include: { factoringCompany: true }
  });

  if (carrier.factoringCompany) {
    const factor = carrier.factoringCompany;
    return {
      displayName: factor.name,
      nameOnCheck: factor.nameOnCheck || factor.name,
      factoringCompanyId: factor.id,
      carrierId: carrier.id,
      email: factor.email,
      phone: factor.phone,
      address: factor.address,
      city: factor.city,
      state: factor.state,
      postalCode: factor.postalCode,
      externalQboId: factor.externalQboId,
      qboOwner: "FACTOR",
      qboOwnerId: factor.id
    };
  }

  return {
    displayName: carrier.name,
    nameOnCheck: carrier.name,
    factoringCompanyId: null,
    carrierId: carrier.id,
    email: carrier.email,
    phone: carrier.phone,
    address: carrier.address,
    city: carrier.city,
    state: carrier.state,
    postalCode: carrier.postalCode,
    externalQboId: carrier.externalQboId,
    qboOwner: "CARRIER",
    qboOwnerId: carrier.id
  };
}

export async function resolveBillApPayee(billId: string, companyId: string): Promise<ResolvedApPayee> {
  const bill = await prisma.carrierBill.findUniqueOrThrow({
    where: { id: billId, companyId },
    include: {
      carrier: { include: { factoringCompany: true } },
      factoringCompany: true
    }
  });

  if (bill.factoringCompanyId && bill.factoringCompany) {
    const factor = bill.factoringCompany;
    return {
      displayName: bill.payeeName || factor.name,
      nameOnCheck: bill.nameOnCheck || factor.nameOnCheck || factor.name,
      factoringCompanyId: factor.id,
      carrierId: bill.carrierId,
      email: factor.email,
      phone: factor.phone,
      address: factor.address,
      city: factor.city,
      state: factor.state,
      postalCode: factor.postalCode,
      externalQboId: factor.externalQboId,
      qboOwner: "FACTOR",
      qboOwnerId: factor.id
    };
  }

  if (bill.payeeName) {
    const carrier = bill.carrier;
    return {
      displayName: bill.payeeName,
      nameOnCheck: bill.nameOnCheck || bill.payeeName,
      factoringCompanyId: null,
      carrierId: bill.carrierId,
      email: carrier.email,
      phone: carrier.phone,
      address: carrier.address,
      city: carrier.city,
      state: carrier.state,
      postalCode: carrier.postalCode,
      externalQboId: carrier.externalQboId,
      qboOwner: "CARRIER",
      qboOwnerId: carrier.id
    };
  }

  return resolveCarrierApPayee(bill.carrierId, companyId);
}

export async function storePayeeQboId(payee: ResolvedApPayee, qboId: string) {
  if (payee.qboOwner === "FACTOR") {
    await prisma.factoringCompany.update({
      where: { id: payee.qboOwnerId },
      data: { externalQboId: qboId }
    });
    return;
  }

  await prisma.carrier.update({
    where: { id: payee.qboOwnerId },
    data: { externalQboId: qboId }
  });
}
