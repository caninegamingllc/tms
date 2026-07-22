import type { DriveStep } from "driver.js";

export const TOUR_ATTR = "data-tour";

export function tourSelector(id: string): string {
  return `[${TOUR_ATTR}="${id}"]`;
}

export type TourStepDef = {
  elementId: string;
  title: string;
  description: string;
  side?: NonNullable<NonNullable<DriveStep["popover"]>["side"]>;
  align?: "start" | "center" | "end";
};

/** Map sidebar nav URLs to stable tour anchor ids. */
export function tourIdForNavUrl(url: string): string | undefined {
  const map: Record<string, string> = {
    "/": "nav-dashboard",
    "/loads": "nav-loads",
    "/search": "nav-search",
    "/dispatch": "nav-dispatch",
    "/customers": "nav-customers",
    "/carriers": "nav-carriers"
  };
  return map[url];
}

/** Sequential product tour — sidebar + dashboard overview. Missing anchors are skipped at runtime. */
export const PRODUCT_TOUR_STEPS: TourStepDef[] = [
  {
    elementId: "dashboard-welcome",
    title: "Welcome to Simple Source TMS",
    description:
      "This is your command center — active loads, margin, receivables, and the pulse of daily operations.",
    side: "bottom",
    align: "start"
  },
  {
    elementId: "nav-loads",
    title: "Loads",
    description:
      "Create and manage customer loads through the full brokerage lifecycle — book, cover, dispatch, and track.",
    side: "right",
    align: "start"
  },
  {
    elementId: "nav-search",
    title: "Search",
    description: "Run advanced load searches with filters across status, lanes, customers, and carriers.",
    side: "right",
    align: "start"
  },
  {
    elementId: "nav-dispatch",
    title: "Dispatch",
    description: "See the dispatch board to assign carriers and keep freight moving.",
    side: "right",
    align: "start"
  },
  {
    elementId: "nav-customers",
    title: "Customers",
    description: "Manage shipper accounts, contacts, credit, payment terms, and open receivables.",
    side: "right",
    align: "start"
  },
  {
    elementId: "nav-carriers",
    title: "Carriers",
    description: "Track carrier profiles, authority, insurance, compliance, and performance.",
    side: "right",
    align: "start"
  },
  {
    elementId: "nav-settings",
    title: "Settings",
    description:
      "Open your profile menu for Settings, and replay this tour anytime from there.",
    side: "top",
    align: "start"
  }
];

export const COACHMARK_IDS = {
  dashboardTiles: "dashboard-tiles",
  loadsToolbar: "loads-toolbar",
  customersToolbar: "customers-toolbar",
  carriersToolbar: "carriers-toolbar"
} as const;

export type CoachmarkId = (typeof COACHMARK_IDS)[keyof typeof COACHMARK_IDS];
