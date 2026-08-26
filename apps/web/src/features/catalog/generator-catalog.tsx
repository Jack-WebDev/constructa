import { Badge } from "@constructa/ui/components/badge";
import { Button } from "@constructa/ui/components/button";
import { Card, CardContent } from "@constructa/ui/components/card";
import { Input } from "@constructa/ui/components/input";
import { Label } from "@constructa/ui/components/label";
import { ArrowUpRight, Search, Sparkles } from "lucide-react";
import { useState } from "react";

import { GENERATOR_CATEGORIES, searchGeneratorCatalog } from "./catalog";

export function GeneratorCatalog() {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string>();
  const entries = searchGeneratorCatalog(query, categoryId);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="fade-in slide-in-from-bottom-2 max-w-2xl animate-in duration-500">
        <p className="font-medium text-primary text-xs uppercase tracking-[0.18em]">
          Generator library
        </p>
        <h1 className="mt-3 font-semibold text-3xl tracking-[-0.035em] sm:text-5xl">
          Find your building blocks.
        </h1>
        <p className="mt-3 text-muted-foreground leading-7">
          Explore the built-in library, then take a generator straight into your
          next definition.
        </p>
      </div>

      <Card className="mt-8 rounded-2xl border-border/80 bg-card/75 py-0 shadow-black/5 shadow-xl">
        <CardContent className="p-3 sm:p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
            <Label className="sr-only" htmlFor="generator-search">
              Search generators
            </Label>
            <Input
              className="h-12 rounded-xl border-border/80 bg-background/50 pl-11 text-sm focus-visible:ring-2"
              id="generator-search"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, description, or tag"
              type="search"
              value={query}
            />
          </div>
          <nav
            aria-label="Generator categories"
            className="mt-3 flex gap-2 overflow-x-auto pb-1"
          >
            <CategoryButton
              active={categoryId === undefined}
              onClick={() => setCategoryId(undefined)}
            >
              All generators
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
        </CardContent>
      </Card>

      <div className="mt-8 flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          <span className="font-medium text-foreground">{entries.length}</span>{" "}
          {entries.length === 1 ? "generator" : "generators"} available
        </p>
        <Badge className="rounded-full px-2.5" variant="secondary">
          <Sparkles className="size-3" /> Built in
        </Badge>
      </div>

      {entries.length === 0 ? (
        <section
          aria-live="polite"
          className="mt-4 rounded-2xl border border-border/80 border-dashed bg-card/40 p-8 text-center"
        >
          <h2 className="font-medium text-lg">No generators found</h2>
          <p className="mt-1 text-muted-foreground text-sm">
            Try another search or select a different category.
          </p>
        </section>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {entries.map((entry) => (
            <li key={entry.typeId}>
              <a
                className="group block h-full rounded-2xl border border-border/80 bg-card/70 p-5 shadow-black/5 shadow-lg transition duration-200 hover:-translate-y-1 hover:border-primary/45 hover:bg-card"
                href={`/generators/${entry.typeId}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <Badge
                    className="rounded-full capitalize"
                    variant="secondary"
                  >
                    {entry.category}
                  </Badge>
                  <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" />
                </div>
                <p className="mt-5 font-semibold text-base">
                  {entry.displayName}
                </p>
                <p className="mt-1.5 text-muted-foreground text-sm leading-6">
                  {entry.description}
                </p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {entry.tags.map((tag) => (
                    <span
                      className="rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground"
                      key={tag}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
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
    <Button
      aria-pressed={active}
      className="h-8 shrink-0 rounded-lg border-border/80 px-3 text-xs aria-pressed:bg-primary aria-pressed:text-primary-foreground"
      onClick={onClick}
      type="button"
      variant={active ? "default" : "outline"}
    >
      {children}
    </Button>
  );
}
