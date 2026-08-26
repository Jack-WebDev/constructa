import { Label } from "@constructa/ui/components/label";
import { BUILT_IN_GENERATOR_CATALOG } from "constructa-sdk";

import type { DefinitionProperties } from "../editor/controls";
import {
  type EditorValidationIssue,
  getGeneratorEditor,
} from "../editor/registry";

type ArrayFieldEditorProps = {
  readonly definition: DefinitionProperties;
  readonly issues: readonly EditorValidationIssue[];
  readonly onChange: (definition: DefinitionProperties) => void;
};

/** Edits the single item definition owned by one portable array generator. */
export function ArrayFieldEditor({
  definition,
  issues,
  onChange,
}: ArrayFieldEditorProps) {
  const item = asDefinitionProperties(definition.item);
  const itemType = getGeneratorType(item);
  const ItemEditor =
    itemType === undefined ? undefined : getGeneratorEditor(itemType)?.Editor;
  const itemIssues = issues.flatMap((issue) =>
    issue.path[0] === "item" ? [{ ...issue, path: issue.path.slice(1) }] : [],
  );

  function selectItemGenerator(typeId: string) {
    const entry = BUILT_IN_GENERATOR_CATALOG.find(
      (candidate) => candidate.typeId === typeId,
    );
    const example = entry?.examples[0];
    if (example === undefined) return;
    onChange({ ...definition, item: structuredClone(example) });
  }

  return (
    <section aria-labelledby="array-item-title" className="mt-4 border-t pt-4">
      <h4 className="font-medium" id="array-item-title">
        Array item
      </h4>
      <p className="mt-1 text-muted-foreground text-sm">
        This configures each value in one generated array, not a bulk generation
        request.
      </p>
      <div className="mt-3 grid gap-1.5">
        <Label htmlFor="array-item-generator">Array item generator</Label>
        <select
          className="h-11 w-full rounded border border-input bg-transparent px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/80 dark:bg-input/30"
          id="array-item-generator"
          onChange={(event) => selectItemGenerator(event.target.value)}
          value={itemType ?? ""}
        >
          {BUILT_IN_GENERATOR_CATALOG.map((entry) => (
            <option key={entry.typeId} value={entry.typeId}>
              {entry.displayName}
            </option>
          ))}
        </select>
      </div>
      {ItemEditor === undefined ? (
        <p className="mt-3" role="alert">
          The array item generator is not available.
        </p>
      ) : (
        <div className="mt-3">
          <ItemEditor
            definition={item}
            issues={itemIssues}
            onChange={(properties) =>
              onChange({ ...definition, item: properties })
            }
          />
        </div>
      )}
    </section>
  );
}

function asDefinitionProperties(value: unknown): DefinitionProperties {
  return typeof value === "object" && value !== null
    ? (value as DefinitionProperties)
    : {};
}

function getGeneratorType(
  definition: DefinitionProperties,
): string | undefined {
  return typeof definition.type === "string" ? definition.type : undefined;
}
