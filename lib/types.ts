export type SessionUser = {
  id: string;
  companyId: string;
  companyName: string;
  name: string;
  email: string;
  role: string;
  status: string;
  mustChangePassword: boolean;
  branchId: string | null;
};
