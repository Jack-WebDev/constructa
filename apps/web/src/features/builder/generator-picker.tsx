import { Button } from "@constructa/ui/components/button";
import { Input } from "@constructa/ui/components/input";
import { BUILT_IN_GENERATOR_CATALOG } from "constructa-sdk";
import { Search } from "lucide-react";
import { useState } from "react";

type GeneratorPickerProps = {
  readonly onSelect: (typeId: string) => void;
  readonly selectedType?: string;
};

const categoryLabels: Record<string, string> = {
  composition: "Structure",
  numeric: "Numbers",
  primitive: "Common",
};

/** An intent-first catalog picker; generator IDs never leak into the UI. */
export function GeneratorPicker({
  onSelect,
  selectedType,
}: GeneratorPickerProps) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const options = BUILT_IN_GENERATOR_CATALOG.filter((entry) => {
    if (normalizedQuery === "") return true;
    return [entry.displayName, entry.description, ...entry.tags].some((value) =>
      value.toLowerCase().includes(normalizedQuery),
    );
  });

  return (
    <section aria-labelledby="generator-picker-title" className="mt-5">
      <div>
        <h3 className="font-medium text-sm" id="generator-picker-title">
          What should this field contain?
        </h3>
        <p className="mt-1 text-muted-foreground text-xs">
          Choose a generator. You can adjust its settings afterwards.
        </p>
      </div>
      <div className="relative mt-3">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Search generators"
          className="pl-9"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search generators…"
          type="search"
          value={query}
        />
      </div>
      {options.length === 0 ? (
        <p className="mt-4 border border-dashed p-4 text-muted-foreground text-sm">
          No generators match “{query}”. Try a broader search.
        </p>
      ) : (
        <div className="mt-4 space-y-5">
          {[...new Set(options.map((option) => option.category))].map(
            (category) => {
              const categoryOptions = options.filter(
                (option) => option.category === category,
              );
              return (
                <section key={category}>
                  <h4 className="font-medium text-[11px] text-muted-foreground uppercase tracking-[0.14em]">
                    {categoryLabels[category] ?? category}
                  </h4>
                  <ul className="mt-2 grid gap-1">
                    {categoryOptions.map((option) => (
                      <li key={option.typeId}>
                        <Button
                          aria-pressed={option.typeId === selectedType}
                          className="h-auto w-full justify-start px-3 py-2.5 text-left data-[pressed=true]:border-primary data-[pressed=true]:bg-primary/5"
                          onClick={() => onSelect(option.typeId)}
                          type="button"
                          variant="outline"
                        >
                          <span className="min-w-0">
                            <span className="block font-medium text-sm">
                              {option.displayName}
                            </span>
                            <span className="mt-0.5 block whitespace-normal text-muted-foreground text-xs">
                              {option.description}
                            </span>
                          </span>
                        </Button>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            },
          )}
        </div>
      )}
    </section>
  );
}
