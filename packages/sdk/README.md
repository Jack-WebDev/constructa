# `constructa-sdk`

`constructa-sdk` is the public, factory-first API for portable data generators.
Normal usage needs no registry, executor, or explicit generic parameters.

```ts
import { generate, integer } from "constructa-sdk";

const age = generate(integer({ min: 18, max: 65 }));
```

Definitions are JSON-compatible data. The same definition can be generated in
the SDK, saved as a versioned document, imported into the web Builder, and run
again there.

## Start with factories and `generate()`

```ts
import { choice, generate, integer, object, uuid } from "constructa-sdk";

const employee = object({
  id: uuid(),
  age: integer({ min: 18, max: 65 }),
  role: choice(["engineer", "designer"]),
});

const value = generate(employee);
// { id: string, age: number, role: "engineer" | "designer" }
```

Every `generate()` call validates through the built-in registry. A definition
is not a generated value: save definitions when you need portability.

## Built-ins

| Factory | Configuration and constraints | Output | Portable form |
| --- | --- | --- | --- |
| `uuid()` | No configuration. | `string` | `{ type: "uuid" }` |
| `boolean()` | No configuration. | `boolean` | `{ type: "boolean" }` |
| `integer({ min, max })` | Inclusive safe-integer bounds; `min <= max`. | `number` | `{ type: "integer", min, max }` |
| `decimal({ min, max, precision })` | Inclusive finite bounds and non-negative safe-integer precision. | `number` | `{ type: "decimal", min, max, precision }` |
| `string({ length, charset })` | Non-negative safe-integer length; charset is `alphabetic`, `numeric`, `alphanumeric`, or `hex`. | `string` | `{ type: "string", length, charset }` |
| `date({ min, max })` | Inclusive ISO calendar-date bounds; `min <= max`. | ISO date `string` | `{ type: "date", min, max }` |
| `choice(values)` | Non-empty JSON-value array; duplicates are retained as weighted entries. | literal union when known | `{ type: "choice", values }` |
| `array(item, { length })` | One item generator and non-negative safe-integer length. This is one generated array, not a bulk request. | `Infer<typeof item>[]` | `{ type: "array", item, length }` |
| `object(fields)` | Record of field names to generators; objects and arrays can nest. | mapped object type | `{ type: "object", fields }` |
| `template(source)` | Object-local `{field}` references must exist, be acyclic, and resolve to scalar values. | `string` | `{ type: "template", source }` |

All shown options are required: there are no hidden range, length, or
precision defaults. Factory validation throws structured errors with `kind`,
`code`, and `path`. For untrusted JSON, use `safeParseDocument()`.

```ts
import {
  array, boolean, choice, date, decimal, generate, object, string, template,
} from "constructa-sdk";

const profile = object({
  active: boolean(),
  rating: decimal({ min: 0, max: 5, precision: 1 }),
  joined: date({ min: "2024-01-01", max: "2024-12-31" }),
  code: string({ length: 6, charset: "hex" }),
  labels: array(choice(["new", "verified"]), { length: 2 }),
  name: choice(["Ada", "Grace"]),
  greeting: template("Hello {name}"),
});

generate(profile);
```

## Types and inference

`Infer<>` captures a definition's output type. Factory calls require no
explicit generics; literal choices remain literals, and object/array inference
is recursive.

```ts
import { array, choice, type Infer, object } from "constructa-sdk";

const team = object({
  role: choice(["admin", "member"] as const),
  tags: array(choice(["new", "verified"] as const), { length: 2 }),
});
type Team = Infer<typeof team>;
```

Dynamic JSON cannot preserve TypeScript literals at compile time. It is still
validated at runtime and generates JSON-compatible values.

## Documents, parsing, and serialization

Use a **definition** with `generate()`. Use a versioned **document** for files,
transport, and untrusted input.

```ts
import { generate, safeParseDocument, serializeDocument } from "constructa-sdk";

const source: unknown = {
  schemaVersion: 1,
  name: "Employee",
  definition: { type: "integer", min: 1, max: 10 },
};
const parsed = safeParseDocument(source);
if (!parsed.success) {
  for (const issue of parsed.issues) console.error(issue.kind, issue.code, issue.path);
} else {
  const value = generate(parsed.value.definition);
  const canonicalJson = serializeDocument(parsed.value);
}
```

`serializeDocument()` emits sorted canonical JSON with a trailing newline. It
serializes documents only, never generated values or UI state.

## Seeds and errors

```ts
import { generate, integer } from "constructa-sdk";

const definition = integer({ min: 1, max: 100 });
const first = generate(definition, { seed: "fixture-v1" });
const second = generate(definition, { seed: "fixture-v1" });
// first === second
```

Seed replay is compatible only with the same Constructa execution algorithm and
implementation version; use it for fixtures and replay, not as a permanent
cross-version data-format guarantee. Trusted factory calls and `generate()`
throw structured errors. Use `safeParseDocument()` for non-throwing validation
and match errors by `kind`, `code`, and segment `path`, not message text.

## Advanced extension

`createEngine({ registry?, random?, limits? })`, `createRegistry()`, and
`defineGenerator()` are advanced APIs for trusted application developer code.
A custom registry replaces the built-in registry and is snapshotted by an
engine. Do not accept executable generator implementations from hosted JSON or
untrusted transport input: portable documents contain data only.
