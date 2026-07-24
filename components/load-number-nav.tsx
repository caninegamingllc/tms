import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

type LoadNumberNavProps = {
  loadNumber: string;
  previousId?: string | null;
  nextId?: string | null;
};

const navIconClass =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-foreground hover:bg-accent hover:text-accent-foreground";

export function LoadNumberNav({ loadNumber, previousId, nextId }: LoadNumberNavProps) {
  return (
    <span className="inline-flex items-center gap-1">
      {previousId ? (
        <Link
          href={`/loads/${previousId}`}
          className={navIconClass}
          aria-label="Previous load"
          title="Previous load"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
      ) : (
        <span
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center opacity-30"
          aria-hidden="true"
        >
          <ChevronLeft className="h-5 w-5" />
        </span>
      )}
      <span>{loadNumber}</span>
      {nextId ? (
        <Link
          href={`/loads/${nextId}`}
          className={navIconClass}
          aria-label="Next load"
          title="Next load"
        >
          <ChevronRight className="h-5 w-5" />
        </Link>
      ) : (
        <span
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center opacity-30"
          aria-hidden="true"
        >
          <ChevronRight className="h-5 w-5" />
        </span>
      )}
    </span>
  );
}
