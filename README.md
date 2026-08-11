# Constructa

Constructa is an open-source, extensible platform for building reusable data generators from small, composable building blocks.

Instead of offering a collection of unrelated tools for generating numbers, dates, UUIDs, names, or passwords, Constructa treats **generation as a common abstraction**. A simple generator can produce one value, while multiple generators can be combined to produce complete objects, lists, templates, and synthetic datasets.

The goal is to make simple generation tasks immediate while allowing more advanced generators to be built without writing code.

> Use the generators Constructa provides to build the generator you need.

## The core idea

Every generator accepts a portable configuration and produces an output. For example:

```json
{
  "type": "integer",
  "min": 18,
  "max": 65
}
```

Primitive generators can then be composed into structured generators:

```json
{
  "type": "object",
  "fields": {
    "id": {
      "type": "uuid"
    },
    "age": {
      "type": "integer",
      "min": 18,
      "max": 65
    },
    "department": {
      "type": "choice",
      "values": ["Engineering", "Finance", "Sales"]
    },
    "active": {
      "type": "boolean"
    }
  }
}
```

That definition could produce:

```json
{
  "id": "289b71e6-...",
  "age": 32,
  "department": "Engineering",
  "active": true
}
```

Generator definitions are represented as data so that the same definition can eventually be saved, shared, versioned, exported, and executed through every Constructa interface.

## Who it is for

Constructa is intended for:

- Developers creating fixtures, seed data, mock API responses, and sample datasets
- QA engineers generating test records, boundary cases, and predefined input combinations
- Casual users who need quick values such as numbers, dates, colors, choices, or passwords
- Writers and educators creating prompts, characters, exercises, groups, and example data

## Product experience

Constructa will provide two primary ways to work:

### Quick Generate

Choose a built-in generator, configure it, and get a result immediately. Users should not need to understand composition to generate a simple value.

### Visual Generator Builder

Build custom generators by adding fields, selecting generator types, configuring them, and nesting generators. The builder will provide validation and live result previews without requiring users to write code.

## MVP

The MVP is focused on answering one question:

> Can users build useful generators by combining smaller generators?

The initial generator library is expected to include:

- Primitive generators: Integer, Decimal, Boolean, Choice, String, Date, and UUID
- Composite generators: Object, Array, and Template

The first important milestone is an engine that can execute a nested object definition without the object generator needing to know how its child generators work. A web playground and visual builder will then expose that engine to users.

Authentication, persistence, sharing, and large generator libraries are intentionally secondary to proving the composition model.

## Design principles

- **Everything is a generator.** Primitive values and complex records use the same conceptual model.
- **Small generators compose.** Basic generators should act as reusable building blocks.
- **Simple things stay simple.** Advanced capabilities should not add friction to quick generation.
- **Configuration is data.** Definitions should be serializable and portable rather than tied to UI state.
- **The engine is UI-agnostic.** Core generation behavior must not depend on React, routes, forms, or other web concerns.
- **Registration over branching.** New generator types should be addable without rewriting the execution engine.
- **Definitions are safe by default.** The platform will not execute arbitrary user-provided JavaScript.

## Long-term vision

Constructa is intended to grow into a general-purpose generation engine with several connected interfaces:

```text
                         Generator Core
                               │
             ┌─────────────────┼─────────────────┐
             │                 │                 │
             ▼                 ▼                 ▼
         Web Builder        Library             API
                                                   │
                                      ┌────────────┴────────────┐
                                      ▼                         ▼
                                     CLI                   Integrations
```

A generator created visually in the web application should eventually be executable through the JavaScript library, public API, or CLI without changing its definition.

Long-term capabilities include:

- Saving, editing, duplicating, and versioning generators
- Sharing private, unlisted, and public generators
- Bulk generation and JSON, CSV, JSON Lines, SQL, and other export formats
- Seeded randomness for deterministic fixtures and reproducible datasets
- References between generated fields, templates, and limited conditional generation
- Prebuilt templates for customers, products, employees, orders, and other common datasets
- A supported SDK, public API, and command-line interface
- Community templates, integrations, and a carefully sandboxed plugin ecosystem

The long-term product succeeds when users stop searching for a website with a specific generator and instead use Constructa to build exactly what they need.

## Architecture direction

The generation system is planned as independent layers:

```text
Web application / CLI / API
            │
            ▼
      Developer SDK
            │
            ▼
      Generator Core
  registry, validation,
 execution, context, errors
            │
            ▼
    Generator Modules
```

The project uses a TypeScript monorepo so the schema, engine, generators, and user interfaces can evolve independently while sharing types and behavior.

See [ARCHITECTURE.md](ARCHITECTURE.md) for package responsibilities and dependency rules.

## Project status

Constructa is in early development. The repository currently contains the application scaffolding; the generator engine and builder described above are being developed incrementally.

## Contributing

Constructa welcomes bug reports, feature proposals, documentation improvements, and code contributions. Read [CONTRIBUTING.md](CONTRIBUTING.md) before starting substantial work.

All community participation is governed by the [Code of Conduct](CODE_OF_CONDUCT.md). Please report security vulnerabilities privately according to [SECURITY.md](SECURITY.md).

## Repository structure

```text
constructa/
├── apps/
│   ├── web/          # React and TanStack Start web application
│   ├── cli/          # Command-line application (early scaffold)
│   └── api/          # Future public API scaffold
├── packages/
│   ├── schema/       # Portable generator definitions and validation types
│   ├── core/         # Registry and UI-agnostic execution engine
│   ├── generators/   # Built-in primitive and composite generators
│   ├── exporters/    # JSON, CSV, JSON Lines, and other output formats
│   ├── sdk/          # Stable developer-facing package
│   ├── config/       # Shared TypeScript configuration
│   ├── env/          # Environment configuration
│   └── ui/           # Shared UI components and styles
└── examples/         # Future public API and CLI examples
```

Future-facing packages are intentionally private placeholders. They will become publishable only after their public contracts, tests, documentation, build output, and registry metadata are ready.

## Development

### Prerequisites

- Node.js 22 or newer
- pnpm 10.32.1 or a compatible version managed through Corepack

Install dependencies:

```bash
pnpm install
```

Start the development environment:

```bash
pnpm run dev
```

The web application is available at [http://localhost:3001](http://localhost:3001).

### Available scripts

- `pnpm run dev` — start all applications in development mode
- `pnpm run dev:web` — start only the web application
- `pnpm run build` — build all applications and packages
- `pnpm run check-types` — run TypeScript checks across the monorepo
- `pnpm run check` — check formatting, linting, and architecture boundaries
- `pnpm run check:architecture` — validate workspace manifests and imports against the documented dependency graph
- `pnpm run check:fix` — apply safe Biome formatting and lint fixes
- `pnpm run test` — run all unit tests once with Vitest
- `pnpm run test:watch` — run Vitest in watch mode
- `pnpm run test:coverage` — run tests and generate a coverage report
- `pnpm changeset` — describe a user-facing package change
- `pnpm run changeset:status` — inspect pending package releases
- `pnpm run prepare` — initialize Git hooks

## Package releases

Constructa uses Changesets as the source of package versions and changelogs. Publishable packages will be released to npm, and packages with a `jsr.json` configuration will also be released to JSR.

See [RELEASING.md](RELEASING.md) for the release process and registry setup requirements.

## Technology

The current application foundation includes TypeScript, React, TanStack Start, TanStack Router, Tailwind CSS, shadcn/ui, Turborepo, tsdown, Vitest, Biome, and pnpm workspaces.

## License

Constructa is available under the [MIT License](LICENSE).
