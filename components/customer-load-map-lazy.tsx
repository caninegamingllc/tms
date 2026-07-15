"use client";

import dynamic from "next/dynamic";
import type { CustomerLoadMapMarker } from "@/lib/customer-load-map";

const CustomerLoadMapInner = dynamic(
  () => import("@/components/customer-load-map").then((module) => module.CustomerLoadMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[360px] items-center justify-center rounded-2xl border border-border bg-muted text-sm text-muted-foreground">
        Loading map…
      </div>
    )
  }
);

export function CustomerLoadMapLazy({ markers }: { markers: CustomerLoadMapMarker[] }) {
  return <CustomerLoadMapInner markers={markers} />;
}
