export type OrganizationSummary = {
  membershipId: string;
  companyId: string;
  companyName: string;
  role: string;
  hasSeat: boolean;
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
  hasSeat: boolean;
  organizations: OrganizationSummary[];
};
