import type { PlanId } from "@/lib/plans";

export type OrganizationSummary = {
  membershipId: string;
  companyId: string;
  companyName: string;
  role: string;
  hasSeat: boolean;
  plan: PlanId;
};

export type SessionUser = {
  id: string;
  membershipId: string;
  companyId: string;
  companyName: string;
  name: string;
  email: string;
  role: string;
  status: string;
  mustChangePassword: boolean;
  branchId: string | null;
  branchIds: string[];
  hasSeat: boolean;
  plan: PlanId;
  organizations: OrganizationSummary[];
};
