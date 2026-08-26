import { Checkbox } from "@constructa/ui/components/checkbox";
import { Input } from "@constructa/ui/components/input";
import { Label } from "@constructa/ui/components/label";
import { Textarea } from "@constructa/ui/components/textarea";
import { useId } from "react";

export type DefinitionProperties = Readonly<Record<string, unknown>>;

type ControlProps = {
  readonly disabled?: boolean;
  readonly error?: string;
  readonly label: string;
  readonly name: string;
  readonly value: unknown;
  readonly onChange: (value: unknown) => void;
};

export function NumberControl({
  disabled,
  error,
  label,
  name,
  onChange,
  value,
}: ControlProps) {
  const id = useId();

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        aria-describedby={error === undefined ? undefined : `${id}-error`}
        aria-invalid={error === undefined ? undefined : true}
        disabled={disabled}
        id={id}
        inputMode="decimal"
        className="h-11 text-sm focus-visible:ring-2"
        name={name}
        onChange={(event) => onChange(parseNumberDraft(event.target.value))}
        type="number"
        value={formatDraft(value)}
      />
      {error === undefined ? null : (
        <p className="text-destructive text-xs" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

export function TextControl({
  disabled,
  error,
  label,
  name,
  onChange,
  value,
}: ControlProps) {
  const id = useId();

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        aria-describedby={error === undefined ? undefined : `${id}-error`}
        aria-invalid={error === undefined ? undefined : true}
        disabled={disabled}
        id={id}
        className="h-11 text-sm focus-visible:ring-2"
        name={name}
        onChange={(event) => onChange(event.target.value)}
        type="text"
        value={formatDraft(value)}
      />
      {error === undefined ? null : (
        <p className="text-destructive text-xs" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

export function BooleanControl({
  disabled,
  error,
  label,
  name,
  onChange,
  value,
}: ControlProps) {
  const id = useId();

  return (
    <div className="flex items-center gap-2">
      <Checkbox
        aria-describedby={error === undefined ? undefined : `${id}-error`}
        aria-invalid={error === undefined ? undefined : true}
        aria-label={label}
        checked={value === true}
        disabled={disabled}
        id={id}
        name={name}
        onCheckedChange={(checked) => onChange(checked === true)}
      />
      <Label htmlFor={id}>{label}</Label>
      {error === undefined ? null : (
        <p className="text-destructive text-xs" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

type SelectControlProps = ControlProps & {
  readonly options: readonly {
    readonly label: string;
    readonly value: string;
  }[];
};

export function SelectControl({
  disabled,
  error,
  label,
  name,
  onChange,
  options,
  value,
}: SelectControlProps) {
  const id = useId();

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select
        aria-describedby={error === undefined ? undefined : `${id}-error`}
        aria-invalid={error === undefined ? undefined : true}
        disabled={disabled}
        id={id}
        className="h-11 w-full rounded border border-input bg-transparent px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/80 dark:bg-input/30"
        name={name}
        onChange={(event) => onChange(event.target.value)}
        value={formatDraft(value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error === undefined ? null : (
        <p className="text-destructive text-xs" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

export function ListControl({
  disabled,
  error,
  label,
  name,
  onChange,
  value,
}: ControlProps) {
  const id = useId();

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        aria-describedby={
          error === undefined ? `${id}-hint` : `${id}-hint ${id}-error`
        }
        aria-invalid={error === undefined ? undefined : true}
        disabled={disabled}
        id={id}
        className="min-h-28 text-sm focus-visible:ring-2"
        name={name}
        onChange={(event) => onChange(parseJsonListDraft(event.target.value))}
        value={formatJsonListDraft(value)}
      />
      <p className="text-muted-foreground text-xs" id={`${id}-hint`}>
        Enter a JSON array. Values keep their JSON types.
      </p>
      {error === undefined ? null : (
        <p className="text-destructive text-xs" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

export function DateControl({
  disabled,
  error,
  label,
  name,
  onChange,
  value,
}: ControlProps) {
  const id = useId();

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        aria-describedby={error === undefined ? undefined : `${id}-error`}
        aria-invalid={error === undefined ? undefined : true}
        disabled={disabled}
        id={id}
        className="h-11 text-sm focus-visible:ring-2"
        name={name}
        onChange={(event) => onChange(event.target.value)}
        type="date"
        value={formatDraft(value)}
      />
      {error === undefined ? null : (
        <p className="text-destructive text-xs" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

function formatDraft(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
}

function parseNumberDraft(value: string): number | string {
  if (value.trim() === "") return value;
  const number = Number(value);
  return Number.isFinite(number) ? number : value;
}

function formatJsonListDraft(value: unknown): string {
  return Array.isArray(value)
    ? JSON.stringify(value, null, 2)
    : formatDraft(value);
}

function parseJsonListDraft(value: string): unknown {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : value;
  } catch {
    return value;
  }
}
