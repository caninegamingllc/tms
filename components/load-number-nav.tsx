import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type LoadNumberNavProps = {
  loadNumber: string;
  previousId?: string | null;
  nextId?: string | null;
};

export function LoadNumberNav({ loadNumber, previousId, nextId }: LoadNumberNavProps) {
  return (
    <span className="inline-flex items-center gap-1">
      {previousId ? (
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-foreground" asChild>
          <Link href={`/loads/${previousId}`} aria-label="Previous load" title="Previous load">
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </Button>
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
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-foreground" asChild>
          <Link href={`/loads/${nextId}`} aria-label="Next load" title="Next load">
            <ChevronRight className="h-5 w-5" />
          </Link>
        </Button>
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
