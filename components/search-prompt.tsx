export function SearchPrompt({ entity }: { entity: string }) {
  return (
    <p className="py-4 text-center text-sm text-muted-foreground">
      Enter search criteria above to find {entity}.
    </p>
  );
}
