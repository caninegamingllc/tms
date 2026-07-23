"use client";

import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode
} from "react";
import {
  mergePageLayouts,
  type GridItemLayout,
  type PageLayouts,
  type TileDefinition
} from "@/lib/ui-preferences";
import { Coachmark } from "@/components/onboarding/Coachmark";
import { COACHMARK_IDS } from "@/components/onboarding/tour-steps";

async function persistLayout(pageId: string, layouts: PageLayouts | null, reset = false) {
  await fetch("/api/ui-layout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pageId, layouts, reset })
  });
}

const COLS = 12;
const ROW_HEIGHT = 28;
const MARGIN_X = 16;
const MARGIN_Y = 16;
const MAX_AUTO_H = 80;

type TileBoardProps = {
  pageId: string;
  tiles: TileDefinition[];
  initialLayouts?: PageLayouts | null;
  children: ReactNode;
};

type DragState = {
  id: string;
  originX: number;
  originY: number;
  pointerStartX: number;
  pointerStartY: number;
  grabOffsetX: number;
  grabOffsetY: number;
};

type ResizeState = {
  id: string;
  originW: number;
  originH: number;
  originX: number;
  originY: number;
  pointerStartX: number;
  pointerStartY: number;
  edge: "se";
};

function overlaps(
  a: Pick<GridItemLayout, "x" | "y" | "w" | "h">,
  b: Pick<GridItemLayout, "x" | "y" | "w" | "h">
) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function clampItem(item: GridItemLayout, cols = COLS): GridItemLayout {
  const w = Math.min(cols, Math.max(1, item.w));
  const x = Math.min(Math.max(0, item.x), cols - w);
  const h = Math.max(1, Math.min(MAX_AUTO_H, item.h));
  const y = Math.max(0, item.y);
  return { ...item, x, y, w, h };
}

/** Pack items top-to-bottom, left-to-right without overlaps. */
function compactVertical(items: GridItemLayout[], cols = COLS): GridItemLayout[] {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const placed: GridItemLayout[] = [];

  for (const item of sorted) {
    const next = clampItem(item, cols);
    let y = 0;

    while (placed.some((other) => overlaps({ ...next, y }, other))) {
      y += 1;
    }

    placed.push({ ...next, y });
  }

  return placed;
}

/**
 * Keep the active tile at its current x/y/size, then pack everyone else around it.
 * Used while dragging / resizing so neighbors make room without jumbling the active tile.
 */
function reflowAroundAnchor(items: GridItemLayout[], anchorId: string, cols = COLS): GridItemLayout[] {
  const anchorRaw = items.find((item) => item.i === anchorId);
  if (!anchorRaw) {
    return compactVertical(items, cols);
  }

  const anchor = clampItem(anchorRaw, cols);
  const others = items
    .filter((item) => item.i !== anchorId)
    .sort((a, b) => a.y - b.y || a.x - b.x);

  const placed: GridItemLayout[] = [anchor];

  for (const item of others) {
    const next = clampItem(item, cols);
    let y = 0;

    while (placed.some((other) => overlaps({ ...next, y }, other))) {
      y += 1;
    }

    placed.push({ ...next, y });
  }

  return placed;
}

function heightToUnits(heightPx: number, minH: number) {
  const units = Math.ceil((heightPx + MARGIN_Y) / (ROW_HEIGHT + MARGIN_Y));
  return Math.min(MAX_AUTO_H, Math.max(minH, units));
}

function TileShell({
  id,
  title,
  children,
  onHeight,
  onDragStart,
  onResizeStart,
  interacting,
  userSized
}: {
  id: string;
  title?: string;
  children: ReactNode;
  onHeight: (id: string, heightPx: number) => void;
  onDragStart: (id: string, event: PointerEvent) => void;
  onResizeStart: (id: string, edge: ResizeState["edge"], event: PointerEvent) => void;
  interacting: boolean;
  userSized: boolean;
}) {
  const measureRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = measureRef.current;
    if (!node || interacting || userSized) {
      return;
    }

    const publish = () => {
      const height = Math.ceil(node.scrollHeight);
      if (height > 0 && height < 20000) {
        onHeight(id, height);
      }
    };

    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(node);
    return () => observer.disconnect();
  }, [id, onHeight, children, interacting, userSized]);

  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) {
        return;
      }
      onDragStart(id, event);
    };

    handle.addEventListener("pointerdown", onPointerDown);
    return () => handle.removeEventListener("pointerdown", onPointerDown);
  }, [id, onDragStart]);

  return (
    <section
      className={`card-frost border-border relative flex h-full flex-col overflow-hidden rounded-2xl border ${
        interacting ? "ring-1 ring-primary/25 shadow-[0_28px_60px_-28px_rgba(43,107,128,0.35)]" : ""
      }`}
    >
      {/* Upper-left move handle (invisible hit target) */}
      <div
        ref={handleRef}
        className="tile-drag-handle absolute top-0 left-0 z-20 h-8 w-8 cursor-grab active:cursor-grabbing"
        style={{ touchAction: "none", userSelect: "none" }}
        data-tile-handle={id}
        title="Drag to move"
        aria-label="Drag to move tile"
        role="button"
      />

      <div className="min-h-0 flex-1 overflow-auto">
        <div ref={measureRef} className="space-y-3 p-5 pt-6">
          {title ? <h2 className="mb-0 text-sm font-semibold tracking-tight">{title}</h2> : null}
          {children}
        </div>
      </div>

      {/* Bottom-right resize handle (invisible hit target) */}
      <div
        className="absolute right-0 bottom-0 z-20 h-8 w-8 cursor-se-resize"
        style={{ touchAction: "none" }}
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onResizeStart(id, "se", event.nativeEvent);
        }}
        title="Resize"
        aria-label="Resize tile"
        role="button"
      />
    </section>
  );
}

export function TileBoard({ pageId, tiles, initialLayouts = null, children }: TileBoardProps) {
  const tileById = useMemo(() => new Map(tiles.map((tile) => [tile.id, tile])), [tiles]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1200);

  const childById = useMemo(() => {
    const map = new Map<string, ReactNode>();
    Children.forEach(children, (child) => {
      if (!isValidElement(child)) {
        return;
      }
      const element = child as ReactElement<{ id?: string; children?: ReactNode }>;
      const id = element.props.id;
      if (typeof id === "string" && tileById.has(id)) {
        map.set(id, element.props.children ?? child);
      }
    });
    return map;
  }, [children, tileById]);

  const activeTiles = useMemo(
    () => tiles.filter((tile) => childById.has(tile.id)),
    [tiles, childById]
  );

  const activeKey = activeTiles.map((tile) => tile.id).join("|");

  const [layout, setLayout] = useState<GridItemLayout[]>(() =>
    compactVertical(mergePageLayouts(initialLayouts ?? undefined, activeTiles).lg)
  );
  const [drag, setDrag] = useState<DragState | null>(null);
  const [resize, setResize] = useState<ResizeState | null>(null);
  const [userSizedIds, setUserSizedIds] = useState<Set<string>>(() => new Set());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heightCache = useRef<Record<string, number>>({});
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const userSizedRef = useRef(userSizedIds);
  userSizedRef.current = userSizedIds;

  useEffect(() => {
    const merged = compactVertical(mergePageLayouts(initialLayouts ?? undefined, activeTiles).lg);
    setLayout(merged);
    heightCache.current = {};
    // Saved layouts are user intent — don't let auto-height fight them after reload.
    setUserSizedIds(
      initialLayouts?.lg && initialLayouts.lg.length > 0
        ? new Set(merged.map((item) => item.i))
        : new Set()
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId, activeKey, initialLayouts]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return;
    }

    const update = () => setContainerWidth(node.clientWidth || 1200);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const persist = useCallback(
    (next: GridItemLayout[]) => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }

      saveTimer.current = setTimeout(() => {
        void persistLayout(pageId, { lg: next, md: next, sm: next });
      }, 400);
    },
    [pageId]
  );

  const colWidth = Math.max(40, (containerWidth - MARGIN_X * (COLS - 1)) / COLS);

  const toPixels = useCallback(
    (item: GridItemLayout) => {
      const left = item.x * (colWidth + MARGIN_X);
      const top = item.y * (ROW_HEIGHT + MARGIN_Y);
      const width = item.w * colWidth + Math.max(0, item.w - 1) * MARGIN_X;
      const height = item.h * ROW_HEIGHT + Math.max(0, item.h - 1) * MARGIN_Y;
      return { left, top, width, height };
    },
    [colWidth]
  );

  const handleHeight = useCallback(
    (id: string, heightPx: number) => {
      if (drag || resize || userSizedRef.current.has(id)) {
        return;
      }

      const nextH = heightToUnits(heightPx, tileById.get(id)?.minH ?? 2);
      if (heightCache.current[id] === nextH) {
        return;
      }
      heightCache.current[id] = nextH;

      setLayout((prev) => {
        const updated = prev.map((item) => (item.i === id ? { ...item, h: nextH } : item));
        return compactVertical(updated);
      });
    },
    [drag, resize, tileById]
  );

  const onDragStart = useCallback(
    (id: string, event: PointerEvent) => {
      if (event.button !== 0 || resize) {
        return;
      }

      const item = layoutRef.current.find((entry) => entry.i === id);
      const container = containerRef.current;
      const handleEl = event.currentTarget as HTMLElement | null;
      if (!item || !container || !handleEl) {
        return;
      }

      event.preventDefault();
      if (typeof event.pointerId === "number") {
        try {
          handleEl.setPointerCapture(event.pointerId);
        } catch {
          // ignore
        }
      }

      const px = toPixels(item);
      const bounds = container.getBoundingClientRect();
      const nextDrag: DragState = {
        id,
        originX: item.x,
        originY: item.y,
        pointerStartX: event.clientX,
        pointerStartY: event.clientY,
        grabOffsetX: event.clientX - bounds.left - px.left,
        grabOffsetY: event.clientY - bounds.top - px.top
      };
      setDrag(nextDrag);

      const onMove = (moveEvent: PointerEvent | MouseEvent) => {
        const liveBounds = container.getBoundingClientRect();
        const liveItem = layoutRef.current.find((entry) => entry.i === id);
        if (!liveItem) {
          return;
        }

        const liveColWidth = Math.max(40, (container.clientWidth - MARGIN_X * (COLS - 1)) / COLS);
        const rawLeft = moveEvent.clientX - liveBounds.left - nextDrag.grabOffsetX;
        const rawTop = moveEvent.clientY - liveBounds.top - nextDrag.grabOffsetY;
        const nextX = Math.min(
          COLS - liveItem.w,
          Math.max(0, Math.round(rawLeft / (liveColWidth + MARGIN_X)))
        );
        const nextY = Math.max(0, Math.round(rawTop / (ROW_HEIGHT + MARGIN_Y)));

        setLayout((prev) => {
          const updated = prev.map((entry) =>
            entry.i === id ? { ...entry, x: nextX, y: nextY } : entry
          );
          return reflowAroundAnchor(updated, id);
        });
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        if (typeof event.pointerId === "number") {
          try {
            handleEl.releasePointerCapture(event.pointerId);
          } catch {
            // ignore
          }
        }

        setLayout((prev) => {
          const compacted = compactVertical(prev);
          persist(compacted);
          return compacted;
        });
        setDrag(null);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [persist, resize, toPixels]
  );

  const onResizeStart = useCallback(
    (id: string, edge: ResizeState["edge"], event: PointerEvent) => {
      if (event.button !== 0 || drag) {
        return;
      }

      const item = layoutRef.current.find((entry) => entry.i === id);
      const container = containerRef.current;
      const handleEl = event.currentTarget as HTMLElement | null;
      if (!item || !container || !handleEl) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      if (typeof event.pointerId === "number") {
        try {
          handleEl.setPointerCapture(event.pointerId);
        } catch {
          // ignore
        }
      }

      const nextResize: ResizeState = {
        id,
        originW: item.w,
        originH: item.h,
        originX: item.x,
        originY: item.y,
        pointerStartX: event.clientX,
        pointerStartY: event.clientY,
        edge
      };
      setResize(nextResize);

      const minW = tileById.get(id)?.minW ?? 2;
      const minH = tileById.get(id)?.minH ?? 2;

      const onMove = (moveEvent: PointerEvent | MouseEvent) => {
        const liveColWidth = Math.max(40, (container.clientWidth - MARGIN_X * (COLS - 1)) / COLS);
        const deltaCols = Math.round(
          (moveEvent.clientX - nextResize.pointerStartX) / (liveColWidth + MARGIN_X)
        );
        const deltaRows = Math.round(
          (moveEvent.clientY - nextResize.pointerStartY) / (ROW_HEIGHT + MARGIN_Y)
        );

        let nextW = nextResize.originW;
        let nextH = nextResize.originH;

        nextW = Math.min(COLS - nextResize.originX, Math.max(minW, nextResize.originW + deltaCols));
        nextH = Math.min(MAX_AUTO_H, Math.max(minH, nextResize.originH + deltaRows));

        setLayout((prev) => {
          const updated = prev.map((entry) =>
            entry.i === id
              ? {
                  ...entry,
                  x: nextResize.originX,
                  y: nextResize.originY,
                  w: nextW,
                  h: nextH
                }
              : entry
          );
          return reflowAroundAnchor(updated, id);
        });
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        if (typeof event.pointerId === "number") {
          try {
            handleEl.releasePointerCapture(event.pointerId);
          } catch {
            // ignore
          }
        }

        setUserSizedIds((prev) => {
          const next = new Set(prev);
          next.add(id);
          return next;
        });
        heightCache.current[id] = layoutRef.current.find((entry) => entry.i === id)?.h ?? 0;

        setLayout((prev) => {
          const compacted = compactVertical(prev);
          persist(compacted);
          return compacted;
        });
        setResize(null);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [drag, persist, tileById]
  );

  const handleReset = () => {
    const defaults = compactVertical(mergePageLayouts(undefined, activeTiles).lg);
    heightCache.current = {};
    setUserSizedIds(new Set());
    setLayout(defaults);
    void persistLayout(pageId, null, true);
  };

  const boardHeight = useMemo(() => {
    const maxBottom = layout.reduce((max, item) => Math.max(max, item.y + item.h), 0);
    return Math.max(240, maxBottom * (ROW_HEIGHT + MARGIN_Y));
  }, [layout]);

  if (activeTiles.length === 0) {
    return null;
  }

  return (
    <div className="tile-board relative">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="muted mb-0">Drag tiles to move, edges to resize. Reset restores the default layout.</p>
        <button
          type="button"
          className="btn-secondary"
          onClick={handleReset}
          title="Restore the original tile layout for this page"
        >
          Reset to default
        </button>
      </div>
      {pageId === "dashboard" ? (
        <Coachmark
          id={COACHMARK_IDS.dashboardTiles}
          variant="blue"
          arrow="top-right"
          className="right-0 top-10 sm:right-2"
        >
          Drag tiles to rearrange your command center. Reset restores the default layout.
        </Coachmark>
      ) : null}
      <div ref={containerRef} className="relative w-full" style={{ height: boardHeight }}>
        {layout.map((item) => {
          const tile = tileById.get(item.i);
          if (!tile || !childById.has(item.i)) {
            return null;
          }

          const px = toPixels(item);
          const isDragging = drag?.id === item.i;
          const isResizing = resize?.id === item.i;
          const interacting = isDragging || isResizing;

          return (
            <div
              key={item.i}
              className="absolute"
              style={{
                left: px.left,
                top: px.top,
                width: px.width,
                height: px.height,
                zIndex: interacting ? 30 : 1,
                transition: interacting
                  ? "none"
                  : "left 120ms ease, top 120ms ease, width 120ms ease, height 120ms ease"
              }}
            >
              <TileShell
                id={item.i}
                title={tile.title}
                onHeight={handleHeight}
                onDragStart={onDragStart}
                onResizeStart={onResizeStart}
                interacting={interacting}
                userSized={userSizedIds.has(item.i)}
              >
                {childById.get(item.i)}
              </TileShell>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Marker for TileBoard children — id must match a tile definition. */
export function Tile({ id: _id, children }: { id: string; children: ReactNode }) {
  return <>{children}</>;
}
