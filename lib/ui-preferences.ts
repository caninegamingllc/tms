export type GridItemLayout = {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
};

export type PageLayouts = {
  lg?: GridItemLayout[];
  md?: GridItemLayout[];
  sm?: GridItemLayout[];
};

export type OnboardingPreferences = {
  tourCompletedAt?: string | null;
  dismissedCoachmarks?: string[];
};

export type UiPreferences = {
  layouts?: Record<string, PageLayouts>;
  onboarding?: OnboardingPreferences;
};

export type TileDefinition = {
  id: string;
  title?: string;
  minW?: number;
  minH?: number;
  default: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
};

function parseOnboarding(value: unknown): OnboardingPreferences | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const raw = value as Record<string, unknown>;
  const onboarding: OnboardingPreferences = {};

  if (raw.tourCompletedAt === null) {
    onboarding.tourCompletedAt = null;
  } else if (typeof raw.tourCompletedAt === "string") {
    onboarding.tourCompletedAt = raw.tourCompletedAt;
  }

  if (Array.isArray(raw.dismissedCoachmarks)) {
    onboarding.dismissedCoachmarks = raw.dismissedCoachmarks.filter(
      (id): id is string => typeof id === "string" && id.length > 0
    );
  }

  if (onboarding.tourCompletedAt === undefined && onboarding.dismissedCoachmarks === undefined) {
    return undefined;
  }

  return onboarding;
}

export function parseUiPreferences(value: unknown): UiPreferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { layouts: {} };
  }

  const record = value as Record<string, unknown>;
  const layouts = record.layouts;
  const onboarding = parseOnboarding(record.onboarding);

  const parsed: UiPreferences = {
    layouts:
      layouts && typeof layouts === "object" && !Array.isArray(layouts)
        ? (layouts as Record<string, PageLayouts>)
        : {}
  };

  if (onboarding) {
    parsed.onboarding = onboarding;
  }

  return parsed;
}

export type OnboardingPatch = {
  tourCompletedAt?: string | null;
  dismissCoachmark?: string;
  resetCoachmarks?: boolean;
};

/** Merge onboarding flags while preserving layouts. */
export function mergeOnboarding(
  preferences: UiPreferences | unknown,
  patch: OnboardingPatch
): UiPreferences {
  const parsed = parseUiPreferences(preferences);
  const current = parsed.onboarding ?? {};
  let dismissed = [...(current.dismissedCoachmarks ?? [])];

  if (patch.resetCoachmarks) {
    dismissed = [];
  }

  if (patch.dismissCoachmark && !dismissed.includes(patch.dismissCoachmark)) {
    dismissed = [...dismissed, patch.dismissCoachmark];
  }

  const next: OnboardingPreferences = {
    ...current,
    dismissedCoachmarks: dismissed
  };

  if (patch.tourCompletedAt !== undefined) {
    next.tourCompletedAt = patch.tourCompletedAt;
  }

  return {
    layouts: parsed.layouts ?? {},
    onboarding: next
  };
}

function isGridItemLayout(value: unknown): value is GridItemLayout {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as GridItemLayout;
  return (
    typeof item.i === "string" &&
    typeof item.x === "number" &&
    typeof item.y === "number" &&
    typeof item.w === "number" &&
    typeof item.h === "number"
  );
}

const MAX_LAYOUT_H = 80;

function sanitizeLayoutItems(items: unknown, tileIds: Set<string>): GridItemLayout[] {
  if (!Array.isArray(items)) {
    return [];
  }

  const seen = new Set<string>();
  const result: GridItemLayout[] = [];

  for (const item of items) {
    if (!isGridItemLayout(item) || !tileIds.has(item.i) || seen.has(item.i)) {
      continue;
    }

    // Reject exploded auto-height layouts from older clients.
    if (item.h > MAX_LAYOUT_H || item.y > 500) {
      return [];
    }

    seen.add(item.i);
    result.push({
      i: item.i,
      x: Math.max(0, Math.round(item.x)),
      y: Math.max(0, Math.round(item.y)),
      w: Math.max(1, Math.round(item.w)),
      h: Math.max(1, Math.min(MAX_LAYOUT_H, Math.round(item.h))),
      ...(typeof item.minW === "number" ? { minW: item.minW } : {}),
      ...(typeof item.minH === "number" ? { minH: item.minH } : {})
    });
  }

  return result;
}

function defaultsForBreakpoint(tiles: TileDefinition[], cols: number): GridItemLayout[] {
  return tiles.map((tile) => ({
    i: tile.id,
    x: Math.min(tile.default.x, Math.max(0, cols - tile.default.w)),
    y: tile.default.y,
    w: Math.min(tile.default.w, cols),
    h: tile.default.h,
    minW: tile.minW,
    minH: tile.minH
  }));
}

function mergeBreakpointLayout(
  saved: GridItemLayout[] | undefined,
  tiles: TileDefinition[],
  cols: number
): GridItemLayout[] {
  const tileIds = new Set(tiles.map((tile) => tile.id));
  const cleaned = sanitizeLayoutItems(saved, tileIds);
  const byId = new Map(cleaned.map((item) => [item.i, item]));
  const defaults = defaultsForBreakpoint(tiles, cols);

  // No saved layout — use authored defaults as-is (side-by-side columns, etc.).
  if (cleaned.length === 0) {
    return defaults;
  }

  let maxY = cleaned.reduce((max, item) => Math.max(max, item.y + item.h), 0);

  return defaults.map((fallback) => {
    const existing = byId.get(fallback.i);
    if (existing) {
      return {
        ...existing,
        w: Math.min(Math.max(existing.w, fallback.minW ?? 1), cols),
        minW: fallback.minW,
        minH: fallback.minH
      };
    }

    const placed = {
      ...fallback,
      y: maxY
    };
    maxY += placed.h;
    return placed;
  });
}

export function mergePageLayouts(
  saved: PageLayouts | undefined,
  tiles: TileDefinition[]
): Required<PageLayouts> {
  return {
    lg: mergeBreakpointLayout(saved?.lg, tiles, 12),
    md: mergeBreakpointLayout(saved?.md ?? saved?.lg, tiles, 10),
    sm: mergeBreakpointLayout(saved?.sm ?? saved?.md ?? saved?.lg, tiles, 6)
  };
}

export function getPageLayouts(
  preferences: UiPreferences | unknown,
  pageId: string
): PageLayouts | undefined {
  const parsed = parseUiPreferences(preferences);
  return parsed.layouts?.[pageId];
}

export function setPageLayouts(
  preferences: UiPreferences | unknown,
  pageId: string,
  layouts: PageLayouts | null
): UiPreferences {
  const parsed = parseUiPreferences(preferences);
  const nextLayouts = { ...(parsed.layouts ?? {}) };

  if (layouts == null) {
    delete nextLayouts[pageId];
  } else {
    nextLayouts[pageId] = layouts;
  }

  const next: UiPreferences = { layouts: nextLayouts };
  if (parsed.onboarding) {
    next.onboarding = parsed.onboarding;
  }
  return next;
}
