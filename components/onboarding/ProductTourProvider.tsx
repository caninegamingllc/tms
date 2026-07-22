"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { driver, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import type { OnboardingPreferences } from "@/lib/ui-preferences";
import { PRODUCT_TOUR_STEPS, tourSelector } from "./tour-steps";

type ProductTourContextValue = {
  tourCompleted: boolean;
  tourActive: boolean;
  dismissedCoachmarks: ReadonlySet<string>;
  isCoachmarkVisible: (id: string) => boolean;
  dismissCoachmark: (id: string) => void;
  startTour: () => void;
  replayTour: () => void;
};

const ProductTourContext = createContext<ProductTourContextValue | null>(null);

const DASHBOARD_PATH = "/";

async function persistOnboarding(body: Record<string, unknown>) {
  const response = await fetch("/api/onboarding", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    keepalive: true,
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error("Unable to save onboarding preference");
  }
  return (await response.json()) as { onboarding?: OnboardingPreferences };
}

function isElementVisible(el: Element): boolean {
  let node: HTMLElement | null = el as HTMLElement;
  while (node) {
    if (node.hidden) return false;
    const style = window.getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") return false;
    node = node.parentElement;
  }
  return true;
}

function findVisibleTourElement(id: string): Element | null {
  const nodes = document.querySelectorAll(tourSelector(id));
  for (const node of nodes) {
    if (isElementVisible(node)) return node;
  }
  return null;
}

function buildDriverSteps() {
  return PRODUCT_TOUR_STEPS.flatMap((step) => {
    const element = findVisibleTourElement(step.elementId);
    if (!element) return [];
    return [
      {
        element,
        popover: {
          title: step.title,
          description: step.description,
          side: step.side,
          align: step.align,
          showButtons: ["next", "previous", "close"] as Array<"next" | "previous" | "close">
        }
      }
    ];
  });
}

function ProductTourAutoStart({
  autoStart,
  tourCompletedAt,
  startTour
}: {
  autoStart: boolean;
  tourCompletedAt: string | null | undefined;
  startTour: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const autoStartedRef = useRef(false);

  useEffect(() => {
    if (!autoStart) return;
    if (autoStartedRef.current) return;
    if (tourCompletedAt) return;

    const welcome = searchParams.get("welcome") === "1";
    let cancelled = false;

    if (welcome) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("welcome");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    }

    const launch = () => {
      if (cancelled || autoStartedRef.current) return;
      autoStartedRef.current = true;
      startTour();
    };

    // Prefer dashboard so welcome + sidebar anchors exist together.
    if (pathname !== DASHBOARD_PATH) {
      router.push(DASHBOARD_PATH);
      const timer = window.setTimeout(launch, 450);
      return () => {
        cancelled = true;
        window.clearTimeout(timer);
      };
    }

    const timer = window.setTimeout(launch, welcome ? 200 : 600);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [autoStart, tourCompletedAt, pathname, router, searchParams, startTour]);

  return null;
}

export function ProductTourProvider({
  initialOnboarding,
  autoStart = true,
  children
}: {
  initialOnboarding?: OnboardingPreferences | null;
  /** When false, skip first-visit auto-start (e.g. unseated / blocked users). */
  autoStart?: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const driverRef = useRef<Driver | null>(null);
  const completingRef = useRef(false);
  const skipCompleteRef = useRef(false);

  const [tourCompletedAt, setTourCompletedAt] = useState<string | null | undefined>(
    initialOnboarding?.tourCompletedAt
  );
  const [dismissed, setDismissed] = useState<string[]>(
    () => initialOnboarding?.dismissedCoachmarks ?? []
  );
  const [tourActive, setTourActive] = useState(false);

  // Server login payload wins over stale client state (e.g. after soft remount).
  useEffect(() => {
    if (initialOnboarding?.tourCompletedAt) {
      setTourCompletedAt(initialOnboarding.tourCompletedAt);
    }
    if (initialOnboarding?.dismissedCoachmarks) {
      setDismissed(initialOnboarding.dismissedCoachmarks);
    }
  }, [initialOnboarding?.tourCompletedAt, initialOnboarding?.dismissedCoachmarks]);

  const tourCompleted = Boolean(tourCompletedAt);
  const dismissedCoachmarks = useMemo(() => new Set(dismissed), [dismissed]);

  const markTourFinished = useCallback(async () => {
    if (completingRef.current) return;
    completingRef.current = true;
    const completedAt = new Date().toISOString();
    setTourCompletedAt(completedAt);
    setTourActive(false);
    try {
      await persistOnboarding({ tourCompletedAt: completedAt });
    } catch {
      // Keep local completion so the tour does not loop on a transient network error.
    } finally {
      completingRef.current = false;
    }
  }, []);

  const destroyDriver = useCallback((options?: { skipComplete?: boolean }) => {
    if (options?.skipComplete) {
      skipCompleteRef.current = true;
    }
    driverRef.current?.destroy();
    driverRef.current = null;
    setTourActive(false);
  }, []);

  const startTour = useCallback(() => {
    destroyDriver({ skipComplete: true });

    const run = () => {
      const steps = buildDriverSteps();
      if (steps.length === 0) {
        // Don't persist completion — anchors may appear after navigation (e.g. desktop sidebar).
        setTourActive(false);
        return;
      }

      const instance = driver({
        showProgress: true,
        animate: true,
        allowClose: true,
        overlayOpacity: 0.45,
        stagePadding: 8,
        stageRadius: 8,
        popoverClass: "tms-product-tour",
        nextBtnText: "Next",
        prevBtnText: "Back",
        doneBtnText: "Done",
        steps,
        onDestroyStarted: () => {
          if (!instance.isActive()) return;
          instance.destroy();
        },
        onDestroyed: () => {
          driverRef.current = null;
          setTourActive(false);
          if (skipCompleteRef.current) {
            skipCompleteRef.current = false;
            return;
          }
          void markTourFinished();
        }
      });

      driverRef.current = instance;
      setTourActive(true);
      instance.drive();
    };

    // Wait a frame so sidebar / page anchors are mounted.
    window.requestAnimationFrame(() => {
      window.setTimeout(run, 50);
    });
  }, [destroyDriver, markTourFinished]);

  const replayTour = useCallback(() => {
    setTourCompletedAt(null);
    setDismissed([]);
    void persistOnboarding({ replay: true }).catch(() => {
      // Local state already cleared for immediate UX.
    });

    const go = () => startTour();
    if (pathname !== DASHBOARD_PATH) {
      router.push(DASHBOARD_PATH);
      window.setTimeout(go, 400);
      return;
    }
    go();
  }, [pathname, router, startTour]);

  const dismissCoachmark = useCallback((id: string) => {
    setDismissed((current) => (current.includes(id) ? current : [...current, id]));
    void persistOnboarding({ dismissCoachmark: id }).catch(() => {
      // Optimistic dismiss already applied.
    });
  }, []);

  const isCoachmarkVisible = useCallback(
    (id: string) => tourCompleted && !tourActive && !dismissedCoachmarks.has(id),
    [tourCompleted, tourActive, dismissedCoachmarks]
  );

  useEffect(() => () => destroyDriver({ skipComplete: true }), [destroyDriver]);

  const value = useMemo<ProductTourContextValue>(
    () => ({
      tourCompleted,
      tourActive,
      dismissedCoachmarks,
      isCoachmarkVisible,
      dismissCoachmark,
      startTour,
      replayTour
    }),
    [
      tourCompleted,
      tourActive,
      dismissedCoachmarks,
      isCoachmarkVisible,
      dismissCoachmark,
      startTour,
      replayTour
    ]
  );

  return (
    <ProductTourContext.Provider value={value}>
      <ProductTourAutoStart
        autoStart={autoStart}
        tourCompletedAt={tourCompletedAt}
        startTour={startTour}
      />
      {children}
    </ProductTourContext.Provider>
  );
}

export function useProductTour() {
  const ctx = useContext(ProductTourContext);
  if (!ctx) {
    throw new Error("useProductTour must be used within ProductTourProvider");
  }
  return ctx;
}

/** Safe for optional placement outside the provider (returns null). */
export function useProductTourOptional() {
  return useContext(ProductTourContext);
}
