import type { TileDefinition } from "@/lib/ui-preferences";

function stack(
  ids: Array<{ id: string; title?: string; w?: number; h?: number; minW?: number; minH?: number; x?: number }>,
  startY = 0
): TileDefinition[] {
  let y = startY;
  return ids.map((item) => {
    const h = item.h ?? 8;
    const tile: TileDefinition = {
      id: item.id,
      title: item.title,
      minW: item.minW ?? 3,
      minH: item.minH ?? 3,
      default: {
        x: item.x ?? 0,
        y,
        w: item.w ?? 12,
        h
      }
    };
    y += h;
    return tile;
  });
}

export const DASHBOARD_TILES: TileDefinition[] = [
  { id: "metrics", title: "Metrics", minW: 4, minH: 4, default: { x: 0, y: 0, w: 12, h: 5 } },
  { id: "fuel-index", title: "Current Fuel Index", minW: 4, minH: 4, default: { x: 0, y: 5, w: 12, h: 8 } },
  { id: "load-board", title: "Load board snapshot", minW: 4, minH: 6, default: { x: 0, y: 13, w: 8, h: 12 } },
  { id: "check-calls", title: "Recent check calls", minW: 3, minH: 6, default: { x: 8, y: 13, w: 4, h: 12 } }
];

export const LOAD_DETAIL_TILES: TileDefinition[] = [
  { id: "summary", title: "Load summary", minW: 4, minH: 6, default: { x: 0, y: 0, w: 7, h: 14 } },
  { id: "workflow", title: "Workflow", minW: 3, minH: 4, default: { x: 7, y: 0, w: 5, h: 8 } },
  { id: "stops", title: "Stops", minW: 4, minH: 4, default: { x: 0, y: 14, w: 7, h: 10 } },
  { id: "route-map", title: "Route Map", minW: 3, minH: 6, default: { x: 7, y: 8, w: 5, h: 16 } },
  { id: "rate-terms", title: "Rate Confirmation Terms", minW: 4, minH: 4, default: { x: 0, y: 24, w: 7, h: 10 } },
  { id: "carrier", title: "Carrier Assignment", minW: 3, minH: 6, default: { x: 7, y: 24, w: 5, h: 16 } },
  { id: "notes", title: "Notes", minW: 4, minH: 6, default: { x: 0, y: 34, w: 7, h: 14 } },
  { id: "check-calls", title: "Check Calls", minW: 3, minH: 5, default: { x: 7, y: 40, w: 5, h: 12 } },
  { id: "documents", title: "Documents", minW: 4, minH: 6, default: { x: 0, y: 48, w: 7, h: 14 } },
  { id: "commission", title: "Commission", minW: 3, minH: 6, default: { x: 7, y: 52, w: 5, h: 16 } },
  { id: "email", title: "Email", minW: 4, minH: 5, default: { x: 0, y: 62, w: 7, h: 12 } },
  { id: "accounting", title: "Accounting", minW: 3, minH: 5, default: { x: 7, y: 68, w: 5, h: 10 } },
  { id: "activity", title: "Activity Log", minW: 4, minH: 5, default: { x: 0, y: 74, w: 12, h: 12 } }
];

export const CARRIER_DETAIL_TILES: TileDefinition[] = [
  { id: "profile", title: "Carrier Profile", minW: 4, minH: 6, default: { x: 0, y: 0, w: 7, h: 16 } },
  { id: "activity", title: "Activity Log", minW: 3, minH: 5, default: { x: 7, y: 0, w: 5, h: 12 } },
  { id: "insurance", title: "Insurance Coverages", minW: 4, minH: 5, default: { x: 0, y: 16, w: 7, h: 12 } },
  { id: "documents", title: "Carrier Documents", minW: 3, minH: 5, default: { x: 7, y: 12, w: 5, h: 12 } }
];

export const CUSTOMER_DETAIL_TILES: TileDefinition[] = [
  { id: "profile", title: "Customer Profile", minW: 4, minH: 6, default: { x: 0, y: 0, w: 7, h: 16 } },
  { id: "rate-terms", title: "Rate Confirmation Terms", minW: 3, minH: 5, default: { x: 7, y: 0, w: 5, h: 12 } },
  { id: "activity", title: "Activity Log", minW: 4, minH: 5, default: { x: 0, y: 16, w: 7, h: 12 } },
  { id: "documents", title: "Customer Documents", minW: 3, minH: 5, default: { x: 7, y: 12, w: 5, h: 12 } }
];

export const LIST_SEARCH_ADD_TILES: TileDefinition[] = [
  { id: "search", title: "Search", minW: 4, minH: 4, default: { x: 0, y: 0, w: 7, h: 8 } },
  { id: "add", title: "Add", minW: 3, minH: 4, default: { x: 7, y: 0, w: 5, h: 14 } },
  { id: "results", title: "Search Results", minW: 4, minH: 6, default: { x: 0, y: 8, w: 7, h: 14 } }
];

export const SEARCH_PAGE_TILES: TileDefinition[] = [
  { id: "filters", title: "Search Filters", minW: 4, minH: 5, default: { x: 0, y: 0, w: 12, h: 10 } },
  { id: "load-results", title: "Load Results", minW: 4, minH: 6, default: { x: 0, y: 10, w: 12, h: 14 } },
  { id: "load-profitability", title: "Load Profitability", minW: 3, minH: 5, default: { x: 0, y: 10, w: 4, h: 10 } },
  { id: "lane-summary", title: "Lane Summary", minW: 3, minH: 5, default: { x: 4, y: 10, w: 4, h: 10 } },
  { id: "customer-volume", title: "Customer Volume", minW: 3, minH: 5, default: { x: 8, y: 10, w: 4, h: 10 } }
];

export const ACCOUNTING_TILES: TileDefinition[] = [
  { id: "quickbooks", title: "QuickBooks", minW: 4, minH: 4, default: { x: 0, y: 0, w: 12, h: 6 } },
  { id: "metrics", title: "Metrics", minW: 4, minH: 4, default: { x: 0, y: 6, w: 12, h: 5 } },
  { id: "main", title: "Accounting", minW: 4, minH: 8, default: { x: 0, y: 11, w: 12, h: 18 } }
];

export const COMMISSIONS_TILES: TileDefinition[] = [
  { id: "metrics", title: "Metrics", minW: 4, minH: 4, default: { x: 0, y: 0, w: 12, h: 5 } },
  { id: "profiles-cta", title: "Commission Profiles", minW: 3, minH: 3, default: { x: 0, y: 5, w: 4, h: 5 } },
  { id: "filters", title: "Filters", minW: 3, minH: 4, default: { x: 4, y: 5, w: 8, h: 6 } },
  { id: "settlement", title: "Commission & Settlement", minW: 4, minH: 8, default: { x: 0, y: 11, w: 12, h: 16 } }
];

export const COMMISSION_PROFILES_TILES: TileDefinition[] = [
  { id: "profiles", title: "Profiles", minW: 4, minH: 5, default: { x: 0, y: 0, w: 7, h: 12 } },
  { id: "create", title: "Create Profile", minW: 3, minH: 5, default: { x: 7, y: 0, w: 5, h: 12 } },
  { id: "edit", title: "Edit Profile", minW: 4, minH: 5, default: { x: 0, y: 12, w: 7, h: 12 } },
  { id: "assignment", title: "Branch Profile Assignment", minW: 3, minH: 5, default: { x: 7, y: 12, w: 5, h: 12 } }
];

export const SETTINGS_EMAIL_TILES: TileDefinition[] = [
  { id: "gmail", title: "Gmail", minW: 3, minH: 4, default: { x: 0, y: 0, w: 4, h: 8 } },
  { id: "microsoft", title: "Microsoft 365", minW: 3, minH: 4, default: { x: 4, y: 0, w: 4, h: 8 } },
  { id: "mailboxes", title: "Connected mailboxes", minW: 3, minH: 4, default: { x: 8, y: 0, w: 4, h: 8 } }
];

export const ADMIN_TILES: TileDefinition[] = [
  { id: "seat-usage", title: "Seat Usage", minW: 4, minH: 4, default: { x: 0, y: 0, w: 12, h: 6 } },
  { id: "tab-content", title: "Admin", minW: 4, minH: 8, default: { x: 0, y: 6, w: 12, h: 20 } }
];

export const ADMIN_BILLING_TILES: TileDefinition[] = [
  { id: "seat-summary", title: "Seat Summary", minW: 3, minH: 4, default: { x: 0, y: 0, w: 4, h: 8 } },
  { id: "purchase", title: "Purchase Seats", minW: 3, minH: 4, default: { x: 4, y: 0, w: 4, h: 10 } },
  { id: "assign", title: "Assign Seats", minW: 3, minH: 4, default: { x: 8, y: 0, w: 4, h: 10 } }
];

export const ADMIN_ACCOUNTING_TILES: TileDefinition[] = [
  { id: "export-method", title: "Export Method", minW: 3, minH: 4, default: { x: 0, y: 0, w: 6, h: 8 } },
  { id: "account-mapping", title: "Account Mapping", minW: 3, minH: 4, default: { x: 6, y: 0, w: 6, h: 10 } },
  { id: "qb-connection", title: "QuickBooks Online Connection", minW: 3, minH: 4, default: { x: 0, y: 8, w: 6, h: 8 } },
  { id: "factoring", title: "Factoring Companies", minW: 3, minH: 4, default: { x: 6, y: 10, w: 6, h: 10 } }
];

export function integrationsTiles(providerIds: string[]): TileDefinition[] {
  const qb: TileDefinition = {
    id: "quickbooks",
    title: "QuickBooks",
    minW: 3,
    minH: 4,
    default: { x: 0, y: 0, w: 4, h: 8 }
  };

  const providers = providerIds.map((id, index) => {
    const col = (index + 1) % 3;
    const row = Math.floor((index + 1) / 3);
    return {
      id: `provider-${id}`,
      title: id,
      minW: 3,
      minH: 4,
      default: { x: col * 4, y: row * 8, w: 4, h: 8 }
    } satisfies TileDefinition;
  });

  return [qb, ...providers];
}

export { stack };
