export default function Loading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center px-6 py-16" aria-busy="true">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-foreground" />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    </div>
  );
}
