import { prisma } from "@/lib/db";
import type { CommissionCalculationMethod, CommissionStatus } from "@/lib/constants";
import { isLateFeeCharge } from "@/lib/late-fees";

export type CommissionResult = {
  grossProfitCents: number;
  branchShareCents: number;
  companyShareCents: number;
  calculationMethod: CommissionCalculationMethod;
  status: CommissionStatus;
};

export type CommissionRuleParams = {
  branchSharePercent: number;
  companySharePercent: number;
  companyMinimumExpensePercent: number;
};

export function sumLoadExpensesCents(expenses: { amountCents: number }[]) {
  return expenses.reduce((sum, expense) => sum + expense.amountCents, 0);
}

/** Commissionable revenue excludes late-fee finance charges. */
export function commissionableRevenueCents(
  revenueCents: number,
  charges: { chargeType: string; amountCents: number }[] = []
) {
  const lateFeeCents = charges.reduce(
    (sum, charge) => (isLateFeeCharge(charge) ? sum + charge.amountCents : sum),
    0
  );
  return Math.max(0, revenueCents - lateFeeCents);
}

export function grossExpenseCents(carrierCostCents: number, expenses: { amountCents: number }[]) {
  return carrierCostCents + sumLoadExpensesCents(expenses);
}

export function calculateCommission(input: {
  revenueCents: number;
  grossExpenseCents: number;
  isCommissionable: boolean;
  branchSharePercent: number;
  companySharePercent: number;
  companyMinimumExpensePercent: number;
}): CommissionResult {
  const grossProfitCents = input.revenueCents - input.grossExpenseCents;

  if (!input.isCommissionable) {
    return {
      grossProfitCents,
      branchShareCents: 0,
      companyShareCents: Math.max(grossProfitCents, 0),
      calculationMethod: "INELIGIBLE",
      status: "INELIGIBLE"
    };
  }

  if (grossProfitCents <= 0) {
    return {
      grossProfitCents,
      branchShareCents: 0,
      companyShareCents: Math.max(grossProfitCents, 0),
      calculationMethod: "NO_PROFIT",
      status: "PENDING"
    };
  }

  const companyMinimumCents = Math.round(
    (input.grossExpenseCents * input.companyMinimumExpensePercent) / 100
  );
  const companyStandardShareCents = Math.round(
    (grossProfitCents * input.companySharePercent) / 100
  );

  if (companyStandardShareCents >= companyMinimumCents) {
    return {
      grossProfitCents,
      branchShareCents: Math.round((grossProfitCents * input.branchSharePercent) / 100),
      companyShareCents: companyStandardShareCents,
      calculationMethod: "STANDARD_SPLIT",
      status: "PENDING"
    };
  }

  if (grossProfitCents <= companyMinimumCents) {
    return {
      grossProfitCents,
      branchShareCents: 0,
      companyShareCents: grossProfitCents,
      calculationMethod: "EXPENSE_FLOOR",
      status: "PENDING"
    };
  }

  return {
    grossProfitCents,
    branchShareCents: grossProfitCents - companyMinimumCents,
    companyShareCents: companyMinimumCents,
    calculationMethod: "EXPENSE_FLOOR",
    status: "PENDING"
  };
}

export function resolveCommissionStatus(input: {
  loadStatus: string;
  isCommissionable: boolean;
  branchShareCents: number;
  currentStatus?: string;
  customerPaid?: boolean;
}): CommissionStatus {
  if (!input.isCommissionable) {
    return "INELIGIBLE";
  }

  if (input.currentStatus === "SETTLED") {
    return "SETTLED";
  }

  const customerPaid = input.customerPaid ?? input.loadStatus === "PAID";

  if (customerPaid && input.branchShareCents > 0) {
    return "PAYABLE";
  }

  return "PENDING";
}

export async function getDefaultCommissionProfile(companyId: string) {
  return prisma.commissionProfile.findFirst({
    where: { companyId, isDefault: true },
    include: { rule: true }
  });
}

type CommissionProfileWithRule = {
  id: string;
  name: string;
  rule: {
    branchSharePercent: number;
    companySharePercent: number;
    companyMinimumExpensePercent: number;
  } | null;
};

function profileHasRule<T extends CommissionProfileWithRule>(
  profile: T | null | undefined
): profile is T & { rule: NonNullable<T["rule"]> } {
  return Boolean(profile?.rule);
}

export async function resolveCommissionProfileForLoad(load: {
  companyId: string;
  commissionProfileId: string | null;
  branchId: string | null;
  branch?: {
    commissionProfileId: string | null;
    commissionProfile?: CommissionProfileWithRule | null;
  } | null;
}) {
  if (load.commissionProfileId) {
    const profile = await prisma.commissionProfile.findUnique({
      where: { id: load.commissionProfileId, companyId: load.companyId },
      include: { rule: true }
    });
    // Skip overrides that point at a profile with no rule; fall through to branch/default.
    if (profileHasRule(profile)) {
      return profile;
    }
  }

  const embeddedBranchProfile = load.branch?.commissionProfile;
  if (profileHasRule(embeddedBranchProfile)) {
    return embeddedBranchProfile;
  }

  if (load.branchId && !profileHasRule(embeddedBranchProfile)) {
    const branch = await prisma.branch.findUnique({
      where: { id: load.branchId },
      include: { commissionProfile: { include: { rule: true } } }
    });
    const branchProfile = branch?.commissionProfile;
    if (profileHasRule(branchProfile)) {
      return branchProfile;
    }
  }

  return getDefaultCommissionProfile(load.companyId);
}

const DEFAULT_COMMISSION_RULE = {
  branchSharePercent: 60,
  companySharePercent: 40,
  companyMinimumExpensePercent: 10
} as const;

export async function ensureDefaultCommissionProfile(companyId: string) {
  const existing = await getDefaultCommissionProfile(companyId);
  if (existing?.rule) {
    return existing;
  }

  if (existing && !existing.rule) {
    // Heal a default profile that lost its rule (e.g. incomplete migration/import).
    return prisma.commissionProfile.update({
      where: { id: existing.id },
      data: {
        rule: {
          create: { ...DEFAULT_COMMISSION_RULE }
        }
      },
      include: { rule: true }
    });
  }

  return prisma.commissionProfile.create({
    data: {
      companyId,
      name: "Standard 60/40",
      isDefault: true,
      rule: {
        create: { ...DEFAULT_COMMISSION_RULE }
      }
    },
    include: { rule: true }
  });
}

export async function recalculateLoadCommission(loadId: string) {
  const load = await prisma.load.findUniqueOrThrow({
    where: { id: loadId },
    include: {
      expenses: true,
      charges: true,
      commission: true,
      invoices: { where: { paidAt: { not: null } }, take: 1 },
      branch: {
        include: {
          commissionProfile: { include: { rule: true } }
        }
      }
    }
  });

  const defaultProfile = await ensureDefaultCommissionProfile(load.companyId);

  let profile = await resolveCommissionProfileForLoad(load);
  if (!profileHasRule(profile)) {
    // Prefer the healed default over failing the caller (assign/unassign already committed).
    profile = defaultProfile;
  }
  if (!profileHasRule(profile)) {
    throw new Error("No commission profile rule found for load.");
  }

  const expenseTotal = grossExpenseCents(load.carrierCostCents, load.expenses);
  const revenueCents = commissionableRevenueCents(load.revenueCents, load.charges);
  const result = calculateCommission({
    revenueCents,
    grossExpenseCents: expenseTotal,
    isCommissionable: load.isCommissionable,
    branchSharePercent: profile.rule.branchSharePercent,
    companySharePercent: profile.rule.companySharePercent,
    companyMinimumExpensePercent: profile.rule.companyMinimumExpensePercent
  });

  const customerPaid = load.status === "PAID" || load.invoices.length > 0;
  const status = resolveCommissionStatus({
    loadStatus: load.status,
    isCommissionable: load.isCommissionable,
    branchShareCents: result.branchShareCents,
    currentStatus: load.commission?.status,
    customerPaid
  });

  const now = new Date();
  const payableAt =
    status === "PAYABLE" || status === "SETTLED"
      ? load.commission?.payableAt ?? now
      : null;

  return prisma.loadCommission.upsert({
    where: { loadId },
    create: {
      loadId,
      branchId: load.branchId,
      profileId: profile.id,
      profileName: profile.name,
      isCommissionable: load.isCommissionable,
      revenueCents,
      grossExpenseCents: expenseTotal,
      grossProfitCents: result.grossProfitCents,
      branchShareCents: result.branchShareCents,
      companyShareCents: result.companyShareCents,
      calculationMethod: result.calculationMethod,
      status,
      payableAt
    },
    update: {
      branchId: load.branchId,
      profileId: profile.id,
      profileName: profile.name,
      isCommissionable: load.isCommissionable,
      revenueCents,
      grossExpenseCents: expenseTotal,
      grossProfitCents: result.grossProfitCents,
      branchShareCents: result.branchShareCents,
      companyShareCents: result.companyShareCents,
      calculationMethod: result.calculationMethod,
      status: load.commission?.status === "SETTLED" ? "SETTLED" : status,
      payableAt: load.commission?.status === "SETTLED" ? load.commission.payableAt : payableAt
    }
  });
}

export async function syncMissingCommissions(companyId: string) {
  const loads = await prisma.load.findMany({
    where: { companyId, commission: null },
    select: { id: true },
    take: 25
  });

  await Promise.all(loads.map((load) => recalculateLoadCommission(load.id)));
}

export async function syncStalePayableCommissions(companyId: string) {
  const stale = await prisma.loadCommission.findMany({
    where: {
      status: "PENDING",
      branchShareCents: { gt: 0 },
      load: {
        companyId,
        OR: [{ status: "PAID" }, { invoices: { some: { paidAt: { not: null } } } }]
      }
    },
    select: { loadId: true },
    take: 25
  });

  await Promise.all(stale.map(({ loadId }) => recalculateLoadCommission(loadId)));
}
