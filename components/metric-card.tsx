import type { ReactNode } from "react";

type MetricCardProps = {
  label: string;
  value: string | number;
  detail?: string;
  icon?: ReactNode;
};

export function MetricCard({ label, value, detail, icon }: MetricCardProps) {
  return (
    <div className="border-b border-r border-border bg-card px-4 py-3 md:px-5 md:py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="label">{label}</p>
          <p className="font-display mt-1 text-[1.65rem] font-semibold leading-none tabular text-foreground">
            {value}
          </p>
          {detail ? <p className="mt-1.5 text-[12px] text-muted-foreground">{detail}</p> : null}
        </div>
        {icon ? (
          <div className="rounded-md bg-lightprimary p-2 text-primary">{icon}</div>
        ) : null}
      </div>
    </div>
  );
}
