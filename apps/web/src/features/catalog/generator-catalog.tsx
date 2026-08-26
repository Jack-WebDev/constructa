import { Input } from "@constructa/ui/components/input";
import { Label } from "@constructa/ui/components/label";
import { useState } from "react";

import { GENERATOR_CATEGORIES, searchGeneratorCatalog } from "./catalog";

export function GeneratorCatalog() {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string>();
  const entries = searchGeneratorCatalog(query, categoryId);

  return (
    <main className="container mx-auto max-w-5xl space-y-8 px-6 py-12">
      <div className="space-y-2">
        <p className="font-medium text-muted-foreground uppercase tracking-wider">
          Generator catalog
        </p>
        <h1 className="font-semibold text-4xl tracking-tight">
          Find a generator.
        </h1>
        <p className="text-muted-foreground">
          Search the built-in catalog or browse it by category.
        </p>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="generator-search">Search generators</Label>
        <Input
          id="generator-search"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Name, description, or tag"
          type="search"
          value={query}
        />
      </div>

      <nav aria-label="Generator categories" className="flex flex-wrap gap-2">
        <CategoryButton
          active={categoryId === undefined}
          onClick={() => setCategoryId(undefined)}
        >
          All
        </CategoryButton>
        {GENERATOR_CATEGORIES.map((category) => (
          <CategoryButton
            active={category.id === categoryId}
            key={category.id}
            onClick={() => setCategoryId(category.id)}
          >
            {category.label}
          </CategoryButton>
        ))}
      </nav>

      {entries.length === 0 ? (
        <section
          aria-live="polite"
          className="rounded-lg border border-dashed p-6"
        >
          <h2 className="font-medium">No generators found</h2>
          <p className="mt-1 text-muted-foreground text-sm">
            Try another search or select a different category.
          </p>
        </section>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {entries.map((entry) => (
            <li key={entry.typeId}>
              <a
                className="block rounded-lg border p-4 transition-colors hover:bg-muted"
                href={`/generators/${entry.typeId}`}
              >
                <p className="font-medium">{entry.displayName}</p>
                <p className="mt-1 text-muted-foreground text-sm">
                  {entry.description}
                </p>
                <p className="mt-3 text-muted-foreground text-xs">
                  {entry.category} · {entry.tags.join(", ")}
                </p>
              </a>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function CategoryButton({
  active,
  children,
  onClick,
}: {
  readonly active: boolean;
  readonly children: string;
  readonly onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className="rounded border px-3 py-1.5 text-sm hover:bg-muted aria-pressed:bg-primary aria-pressed:text-primary-foreground"
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}
