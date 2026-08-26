import {
  BUILT_IN_GENERATOR_CATALOG,
  type BuiltInGeneratorCatalogEntry,
} from "constructa-sdk";

export type GeneratorCategory = {
  readonly id: string;
  readonly label: string;
};

export const GENERATOR_CATEGORIES: readonly GeneratorCategory[] = Object.freeze(
  Array.from(
    new Set(BUILT_IN_GENERATOR_CATALOG.map((entry) => entry.category)),
    (id) => ({ id, label: titleCase(id) }),
  ).sort((left, right) => left.id.localeCompare(right.id)),
);

export function searchGeneratorCatalog(
  query: string,
  categoryId?: string,
): readonly BuiltInGeneratorCatalogEntry[] {
  const normalizedQuery = normalizeSearchQuery(query);
  return BUILT_IN_GENERATOR_CATALOG.filter(
    (entry) => categoryId === undefined || entry.category === categoryId,
  )
    .map((entry) => ({ entry, rank: searchRank(entry, normalizedQuery) }))
    .filter(
      (
        candidate,
      ): candidate is {
        readonly entry: BuiltInGeneratorCatalogEntry;
        readonly rank: number;
      } => candidate.rank !== undefined,
    )
    .sort(
      (left, right) =>
        left.rank - right.rank ||
        left.entry.displayName.localeCompare(right.entry.displayName),
    )
    .map((candidate) => candidate.entry);
}

export function normalizeSearchQuery(query: string): string {
  return query.trim().toLocaleLowerCase();
}

export function getCatalogEntry(
  typeId: string,
): BuiltInGeneratorCatalogEntry | undefined {
  return BUILT_IN_GENERATOR_CATALOG.find((entry) => entry.typeId === typeId);
}

function searchRank(
  entry: BuiltInGeneratorCatalogEntry,
  query: string,
): number | undefined {
  if (query === "") return 0;

  const name = entry.displayName.toLocaleLowerCase();
  if (name === query) return 0;
  if (name.startsWith(query)) return 1;
  if (name.includes(query)) return 2;
  if (entry.tags.some((tag) => tag.toLocaleLowerCase().includes(query))) {
    return 3;
  }
  if (entry.description.toLocaleLowerCase().includes(query)) return 4;
  return undefined;
}

function titleCase(value: string): string {
  return value.replace(/\b\w/gu, (character) => character.toUpperCase());
}
