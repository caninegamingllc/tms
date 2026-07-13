export function SearchPrompt({ entity }: { entity: string }) {
  return (
    <section className="card p-8 text-center">
      <p className="text-sm text-muted-foreground">Enter search criteria above to find {entity}.</p>
    </section>
  );
}
