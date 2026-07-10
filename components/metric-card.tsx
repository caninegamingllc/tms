import type { ReactNode } from "react";

type MetricCardProps = {
  label: string;
  value: string | number;
  detail?: string;
  icon?: ReactNode;
};

export function MetricCard({ label, value, detail, icon }: MetricCardProps) {
  return (
    <div className="card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="label">{label}</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{value}</p>
          {detail ? <p className="mt-2 text-sm text-muted-foreground">{detail}</p> : null}
        </div>
        {icon ? <div className="rounded-lg bg-lightprimary p-3 text-primary">{icon}</div> : null}
      </div>
    </div>
  );
}
