import { Button } from "@constructa/ui/components/button";
import { Input } from "@constructa/ui/components/input";
import { Label } from "@constructa/ui/components/label";
import {
  AlignJustify,
  Box,
  CalendarDays,
  ChevronRight,
  FileText,
  Grid2X2,
  Hash,
  List,
  type LucideIcon,
  Search,
  ToggleLeft,
  Type,
} from "lucide-react";
import { useState } from "react";

import { GENERATOR_CATEGORIES, searchGeneratorCatalog } from "./catalog";

type CatalogLayout = "grid" | "list";
type CatalogSort = "default" | "category" | "name";

const GENERATOR_ICONS: Readonly<Record<string, LucideIcon>> = {
  array: AlignJustify,
  boolean: ToggleLeft,
  choice: List,
  date: CalendarDays,
  decimal: Hash,
  integer: Hash,
  object: Box,
  string: Type,
  template: FileText,
};

export function GeneratorCatalog() {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string>();
  const [layout, setLayout] = useState<CatalogLayout>("grid");
  const [sort, setSort] = useState<CatalogSort>("default");
  const entries = sortCatalogEntries(
    searchGeneratorCatalog(query, categoryId),
    sort,
  );

  return (
    <main className="app-page relative isolate min-h-[calc(100svh-4.25rem)] overflow-hidden bg-background px-4 py-10 sm:px-6 sm:py-11">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-20 bg-center bg-size-[100%_100%] opacity-95"
        style={{
          backgroundImage: 'url("/generators-bg.png")',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-background/30"
      />

      <div className="mx-auto max-w-360">
        <header className="max-w-3xl">
          <p className="font-semibold text-[11px] text-primary uppercase tracking-[0.18em]">
            Generator library
          </p>
          <h1 className="mt-2 font-serif text-4xl tracking-[-0.045em] sm:text-5xl">
            Find the right generator.
          </h1>
          <p className="mt-2 text-muted-foreground text-sm leading-6 sm:text-base">
            Browse built-in generators, understand their options, and choose one
            for your next definition.
          </p>
        </header>

        <section
          aria-label="Generator search and filters"
          className="mt-4 rounded-[14px] border border-border/80 bg-card/80 p-3 shadow-foreground/8 shadow-lg backdrop-blur-sm sm:p-4"
        >
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-foreground"
            />
            <Label className="sr-only" htmlFor="generator-search">
              Search generators
            </Label>
            <Input
              className="h-10 rounded-xl border-border/75 bg-background/45 pl-10 text-xs shadow-foreground/3 shadow-inner placeholder:text-muted-foreground/85 focus-visible:ring-1"
              id="generator-search"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search generators by name, description, or tag..."
              type="search"
              value={query}
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <nav
              aria-label="Generator categories"
              className="flex max-w-full gap-2 overflow-x-auto pb-0.5"
            >
              <CategoryButton
                active={categoryId === undefined}
                onClick={() => setCategoryId(undefined)}
              >
                All generators
              </CategoryButton>
              {GENERATOR_CATEGORIES.map((category) => (
                <CategoryButton
                  active={categoryId === category.id}
                  key={category.id}
                  onClick={() => setCategoryId(category.id)}
                >
                  {category.label}
                </CategoryButton>
              ))}
            </nav>

            <div className="ml-auto shrink-0">
              <Label className="sr-only" htmlFor="generator-sort">
                Sort generators
              </Label>
              <select
                className="h-8 rounded-lg border border-border/80 bg-background/45 px-3 pr-8 text-[11px] text-foreground shadow-sm outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring"
                id="generator-sort"
                onChange={(event) => setSort(toCatalogSort(event.target.value))}
                value={sort}
              >
                <option value="default">Sort by</option>
                <option value="name">Name</option>
                <option value="category">Category</option>
              </select>
            </div>
          </div>
        </section>

        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-muted-foreground text-sm">
            <span className="font-medium text-foreground">
              {entries.length}
            </span>{" "}
            {entries.length === 1 ? "generator" : "generators"} available
          </p>
          <fieldset className="flex items-center rounded-lg border-0 bg-card/75 p-1 shadow-sm">
            <legend className="sr-only">Catalog layout</legend>
            <LayoutButton
              active={layout === "grid"}
              icon={Grid2X2}
              label="Grid"
              onClick={() => setLayout("grid")}
            />
            <LayoutButton
              active={layout === "list"}
              icon={List}
              label="List"
              onClick={() => setLayout("list")}
            />
          </fieldset>
        </div>

        {entries.length === 0 ? (
          <section
            aria-live="polite"
            className="mt-4 rounded-xl border border-border/80 border-dashed bg-card/55 p-8 text-center shadow-sm"
          >
            <h2 className="font-serif text-xl">No generators found</h2>
            <p className="mt-1 text-muted-foreground text-sm">
              Try another search or select a different category.
            </p>
          </section>
        ) : (
          <ul
            className={`mt-3 grid gap-3 ${
              layout === "grid"
                ? "sm:grid-cols-2 lg:grid-cols-3"
                : "grid-cols-1"
            }`}
          >
            {entries.map((entry) => (
              <li key={entry.typeId}>
                <GeneratorCard entry={entry} layout={layout} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function GeneratorCard({
  entry,
  layout,
}: {
  readonly entry: ReturnType<typeof searchGeneratorCatalog>[number];
  readonly layout: CatalogLayout;
}) {
  const Icon = GENERATOR_ICONS[entry.typeId] ?? FileText;

  return (
    <a
      className={`group relative flex min-h-37.5 overflow-hidden rounded-xl border border-border/80 bg-card/78 p-4 shadow-foreground/7 shadow-md backdrop-blur-[2px] transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        layout === "list" ? "items-center gap-4" : "gap-4"
      }`}
      href={`/generators/${entry.typeId}`}
    >
      <span className="grid size-13.25 shrink-0 place-items-center rounded-xl bg-secondary/75 text-secondary-foreground">
        <Icon aria-hidden="true" className="size-6" strokeWidth={1.8} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="w-fit rounded-full bg-secondary/90 px-2 py-0.5 text-[10px] text-secondary-foreground capitalize">
          {entry.category}
        </span>
        <h2 className="mt-1 font-serif text-[17px] leading-5 tracking-tight">
          {entry.displayName}
        </h2>
        <p className="mt-1 line-clamp-2 text-[12px] text-muted-foreground leading-4">
          {entry.description}
        </p>
        <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
          {entry.tags.map((tag) => (
            <span
              className="rounded-full bg-muted/75 px-2 py-1 text-[9px] text-muted-foreground"
              key={tag}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
      <ChevronRight
        aria-hidden="true"
        className="absolute top-4 right-3.5 size-4 text-foreground transition-transform group-hover:translate-x-0.5"
        strokeWidth={1.8}
      />
    </a>
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
      className="h-8 rounded-lg border-border/80 bg-background/40 px-3 text-[10px] shadow-sm hover:bg-secondary/80 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
      onClick={onClick}
      type="button"
      variant="outline"
    >
      {children}
    </Button>
  );
}

function LayoutButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  readonly active: boolean;
  readonly icon: LucideIcon;
  readonly label: string;
  readonly onClick: () => void;
}) {
  return (
    <Button
      aria-pressed={active}
      className="h-7 rounded-md px-2 text-[10px] text-muted-foreground hover:bg-secondary hover:text-foreground aria-pressed:bg-primary/10 aria-pressed:text-primary"
      onClick={onClick}
      type="button"
      variant="ghost"
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {label}
    </Button>
  );
}

function sortCatalogEntries(
  entries: ReturnType<typeof searchGeneratorCatalog>,
  sort: CatalogSort,
): ReturnType<typeof searchGeneratorCatalog> {
  if (sort === "default") return entries;

  return [...entries].sort((left, right) => {
    if (sort === "category") {
      return (
        left.category.localeCompare(right.category) ||
        left.displayName.localeCompare(right.displayName)
      );
    }
    return left.displayName.localeCompare(right.displayName);
  });
}

function toCatalogSort(value: string): CatalogSort {
  if (value === "name" || value === "category") return value;
  return "default";
}
