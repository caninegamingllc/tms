"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { clsx } from "clsx";
import {
  applyTheme,
  getStoredTheme,
  setTheme,
  THEME_STORAGE_KEY,
  type ThemeMode
} from "@/lib/theme";

function subscribe(onStoreChange: () => void) {
  function onStorage(event: StorageEvent) {
    if (event.key === THEME_STORAGE_KEY || event.key === null) {
      onStoreChange();
    }
  }

  window.addEventListener("storage", onStorage);
  window.addEventListener("tms-theme-change", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("tms-theme-change", onStoreChange);
  };
}

function getSnapshot(): ThemeMode {
  return getStoredTheme();
}

function getServerSnapshot(): ThemeMode {
  return "light";
}

function chooseTheme(theme: ThemeMode) {
  setTheme(theme);
  window.dispatchEvent(new Event("tms-theme-change"));
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <div
      className={clsx(
        "inline-flex items-center rounded-md border border-border bg-muted/70 p-0.5",
        compact ? "gap-0" : "gap-0.5"
      )}
      role="group"
      aria-label="Color theme"
    >
      <button
        type="button"
        className={clsx(
          "inline-flex items-center gap-1.5 rounded px-2 py-1 text-[12px] font-semibold transition",
          theme === "light"
            ? "bg-card text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
        aria-pressed={theme === "light"}
        title="Light mode"
        onClick={() => chooseTheme("light")}
      >
        <Sun className="h-3.5 w-3.5" aria-hidden="true" />
        {!compact ? <span className="hidden sm:inline">Light</span> : null}
        <span className="sr-only">Light mode</span>
      </button>
      <button
        type="button"
        className={clsx(
          "inline-flex items-center gap-1.5 rounded px-2 py-1 text-[12px] font-semibold transition",
          theme === "dark"
            ? "bg-card text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
        aria-pressed={theme === "dark"}
        title="Dark mode"
        onClick={() => chooseTheme("dark")}
      >
        <Moon className="h-3.5 w-3.5" aria-hidden="true" />
        {!compact ? <span className="hidden sm:inline">Dark</span> : null}
        <span className="sr-only">Dark mode</span>
      </button>
    </div>
  );
}
