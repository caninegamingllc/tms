export type BranchOption = {
  id: string;
  name: string;
};

export type BranchSwitcherData = {
  branches: BranchOption[];
  selectedBranchIds: string[];
  allSelected: boolean;
};
