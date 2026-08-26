<div align="center">

# CONSTRUCTA

### *Build the generator you need.*

<p>
  <img src="https://img.shields.io/badge/status-early--development-EF4444?style=for-the-badge&labelColor=1a1a2e" alt="Status" />
  <img src="https://img.shields.io/badge/license-MIT-F59E0B?style=for-the-badge&labelColor=1a1a2e" alt="License" />
  <img src="https://img.shields.io/badge/node-22%2B-22C55E?style=for-the-badge&logo=node.js&logoColor=white&labelColor=1a1a2e" alt="Node" />
  <img src="https://img.shields.io/badge/pnpm-10.32.1-6366F1?style=for-the-badge&logo=pnpm&logoColor=white&labelColor=1a1a2e" alt="pnpm" />
</p>

**Constructa is a type-safe toolkit for building reusable data generators from small, composable building blocks.**

Generate one value. Compose complete data models. Reuse the same generator wherever Constructa runs.

<br>

[**Why Constructa?**](#why-constructa) ·
[**Type Safety**](#type-safety-without-the-ceremony) ·
[**Composition**](#composition-is-the-point) ·
[**Portable Definitions**](#portable-by-design) ·
[**Visual Builder**](#visual-builder) ·
[**Getting Started**](#getting-started) ·
[**Roadmap**](#roadmap)

</div>

---

## The idea in 30 seconds

Instead of manually assembling generated values:

```ts
const user = {
  id: generateUuid(),
  age: generateAge(),
  role: generateRole(),
  active: generateBoolean(),
};
```

Constructa lets you describe the generator itself:

```ts
const user = object({
  id: uuid(),

  age: integer({
    min: 18,
    max: 65,
  }),

  role: choice([
    "admin",
    "member",
    "viewer",
  ]),

  active: boolean(),
});

const result = generate(user);
```

TypeScript can infer the result:

```ts
{
  id: string;
  age: number;
  role: "admin" | "member" | "viewer";
  active: boolean;
}
```

And Constructa generates values such as:

```json
{
  "id": "289b71e6-...",
  "age": 32,
  "role": "member",
  "active": true
}
```

**No duplicated output interface. No explicit generics. No casts. No manual registry setup.**

```text
UUID ─────┐
Integer ──┤
Choice ───┼──────▶ User Generator
Boolean ──┘
```

> Instead of searching for a generator that already exists, compose the one you need.

> [!NOTE]
> Constructa is still in early development. The public API shown in this README represents the intended developer experience and may change while the architecture is being finalized.

---

# Why Constructa?

Libraries can already generate numbers, names, UUIDs, dates, addresses, and hundreds of other values.

The problem becomes more interesting when you need to generate **your data**.

Suppose your application uses:

```ts
{
  id: string;
  age: number;
  plan: "free" | "pro" | "enterprise";
  active: boolean;
}
```

Generating each individual value is easy.

The useful abstraction is the complete reusable generator:

```ts
const customer = object({
  id: uuid(),

  age: integer({
    min: 18,
    max: 65,
  }),

  plan: choice([
    "free",
    "pro",
    "enterprise",
  ]),

  active: boolean(),
});
```

Now `customer` describes how to generate that data.

It can be:

* executed;
* composed into another generator;
* nested;
* reused;
* serialized;
* visually represented;
* saved in the future;
* executed repeatedly in the future;
* consumed by other Constructa interfaces.

Constructa is built around that abstraction.

| Traditional generation                            | Constructa                                       |
| ------------------------------------------------- | ------------------------------------------------ |
| Call generators individually                      | Compose generators into reusable models          |
| Assemble objects manually                         | Describe the generated object once               |
| Maintain output types separately                  | Infer output types from the generator            |
| Generation logic lives in application code        | Generator definitions can remain portable data   |
| Custom structures require custom generation logic | Structures are composed from existing generators |
| Code and visual tooling use separate concepts     | Code and UI share the same generator model       |

---

# Type safety without the ceremony

Type safety should come from information you already provided.

Constructa should not make you repeat yourself.

Consider:

```ts
const status = choice([
  "pending",
  "processing",
  "complete",
]);

const result = generate(status);
```

The intended inferred type is:

```ts
"pending" | "processing" | "complete"
```

not:

```ts
string
```

And you should not need:

```ts
as const
```

for an ordinary inline choice.

The same idea applies recursively:

```ts
const user = object({
  id: uuid(),

  status: choice([
    "pending",
    "active",
    "disabled",
  ]),

  profile: object({
    age: integer({
      min: 18,
      max: 80,
    }),

    active: boolean(),
  }),
});
```

TypeScript should infer:

```ts
{
  id: string;

  status:
    | "pending"
    | "active"
    | "disabled";

  profile: {
    age: number;
    active: boolean;
  };
}
```

If you need the type itself:

```ts
type User = Infer<typeof user>;
```

The goal is simple:

> **Provide information once. Let Constructa carry it through the rest of the API.**

Normal usage should not require:

```ts
object<User>({...});

generate<User>(user);

result as User;
```

---

# Composition is the point

Constructa is deliberately not trying to win by having the longest list of generators.

Its main idea is that **small generators become much more useful when they compose cleanly**.

```text
Primitive generators

Integer
Decimal
Boolean
Choice
String
Date
UUID

        │
        ▼

Composite generators

Object
Array
Template

        │
        ▼

Your generators

Customer
Employee
Product
Order
Fixture
Mock Response
Dataset
Anything else you can describe
```

For example:

```ts
const address = object({
  city: choice([
    "Johannesburg",
    "Cape Town",
    "Durban",
  ]),

  postalCode: string({
    length: 4,
    charset: "numeric",
  }),
});

const customer = object({
  id: uuid(),

  age: integer({
    min: 18,
    max: 80,
  }),

  address,
});
```

The output shape is inferred recursively:

```ts
{
  id: string;
  age: number;

  address: {
    city:
      | "Johannesburg"
      | "Cape Town"
      | "Durban";

    postalCode: string;
  };
}
```

A generator can therefore be as small as:

```ts
uuid();
```

or as structured as:

```text
Order
├── id
│   └── UUID
│
├── customer
│   └── Object
│       ├── id
│       │   └── UUID
│       └── tier
│           └── Choice
│
├── items
│   └── Array
│       └── Object
│           ├── productId
│           │   └── UUID
│           ├── quantity
│           │   └── Integer
│           └── price
│               └── Decimal
│
└── status
    └── Choice
```

Both still follow the same generator model.

---

# Portable by design

The TypeScript API is intended to be the ergonomic way developers author generators.

Underneath it, Constructa uses portable generator definitions.

For example:

```ts
integer({
  min: 18,
  max: 65,
});
```

corresponds conceptually to:

```json
{
  "type": "integer",
  "min": 18,
  "max": 65
}
```

A composed generator:

```ts
const user = object({
  id: uuid(),

  age: integer({
    min: 18,
    max: 65,
  }),

  role: choice([
    "admin",
    "member",
    "viewer",
  ]),
});
```

can be represented as data:

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
    "role": {
      "type": "choice",
      "values": [
        "admin",
        "member",
        "viewer"
      ]
    }
  }
}
```

This distinction matters.

```text
TypeScript API
      │
      ▼
Portable Generator Definition
      │
      ▼
Constructa Engine
      │
      ├──────────▶ Web
      │
      ├──────────▶ Node.js
      │
      ├──────────▶ CLI
      │
      └──────────▶ API
```

The TypeScript API and JSON representation are not two different generator systems.

They are two ways of working with the same model.

That allows Constructa definitions to eventually be:

* saved;
* shared;
* versioned;
* imported;
* exported;
* visually edited;
* executed remotely;
* executed from a terminal.

Generator definitions are treated as **data**, not arbitrary executable JavaScript.

---

# One generator model, multiple ways to use it

Constructa is being designed around three primary experiences.

## TypeScript

For developers who want generators directly in application code:

```ts
const product = object({
  id: uuid(),

  price: decimal({
    min: 10,
    max: 1000,
    precision: 2,
  }),

  category: choice([
    "electronics",
    "books",
    "clothing",
  ]),

  inStock: boolean(),
});

const result = generate(product);
```

---

## Quick Generate

For users who just need a value.

```text
Integer

Minimum
[ 1 ]

Maximum
[ 100 ]

[ Generate ]

47
```

Using a primitive generator should not require understanding schemas, registries, composition, or execution internals.

---

## Visual Builder

For users who want to create structured generators without writing code.

```text
Customer

FIELDS

┌──────────────────────────────────────────────────┐
│ id            UUID                         ⋮     │
├──────────────────────────────────────────────────┤
│ age           Integer       18 — 65        ⋮     │
├──────────────────────────────────────────────────┤
│ plan          Choice        3 options       ⋮     │
├──────────────────────────────────────────────────┤
│ active        Boolean                       ⋮     │
└──────────────────────────────────────────────────┘

+ Add field
```

With a live preview:

```json
{
  "id": "84aa8d4f-...",
  "age": 29,
  "plan": "pro",
  "active": true
}
```

The Builder intentionally follows the same hierarchy as the code:

```ts
object({
  age: integer({
    min: 18,
    max: 65,
  }),
});
```

```text
Object
└── age
    └── Integer
        ├── Minimum: 18
        └── Maximum: 65
```

The goal is for moving between **TypeScript, JSON, and the visual Builder** to feel like working with the same system.

The web editor maps each built-in generator type to accessible, web-owned controls. Those controls update the same flat portable properties used by the TypeScript factories; final validation and execution still run through the shared Constructa engine.

Quick Generate is available at `/quick-generate` for an anonymous, one-off run. It uses the same portable definition and shared engine as every other Constructa surface.

The Choice editor accepts a JSON array, preserving values such as numbers, booleans, strings, objects, and duplicates exactly as entered. Weighted choices are not part of the initial portable generator definition.

Quick Generate also supports string length and character-set controls, inclusive ISO date bounds, and configuration-free UUID generation. Time-of-day and timezone controls are intentionally unavailable until supported by portable generator definitions.

Results use safe text for primitives and formatted JSON for structured values. Long previews remain scrollable and are truncated with a visible notice.

Successful previews can be copied as their formatted display value. Clipboard permission failures are shown safely without exposing browser error details.

Validation summaries and field errors use shared segment paths. Configuration and dependency errors explain what to correct, while system failures stay generic.

Browse built-in generators at `/generators`. The catalog has normalized search across names, descriptions, and tags, category filters, and stable detail URLs such as `/generators/integer`.

---

# What can you build?

Anything that can be described from Constructa's available building blocks.

Examples include:

| Development        | Testing              | General                  |
| ------------------ | -------------------- | ------------------------ |
| Mock API responses | QA datasets          | Random teams             |
| Database seed data | Fixtures             | Quiz data                |
| Test users         | Boundary datasets    | Character generators     |
| Product catalogs   | Reproducible samples | Custom domain generators |
| Demo records       | Synthetic records    | Structured random data   |

A customer generator:

```text
Customer
├── id
│   └── UUID
├── age
│   └── Integer(18, 80)
├── tier
│   └── Choice(free, premium)
└── active
    └── Boolean
```

A product generator:

```text
Product
├── id
│   └── UUID
├── price
│   └── Decimal
├── category
│   └── Choice
├── stock
│   └── Integer
└── active
    └── Boolean
```

Or something specific to your own application:

```text
Subscription
├── id
├── customer
├── plan
├── billingCycle
├── status
├── startedAt
└── metadata
```

You do not need Constructa to ship a special `SubscriptionGenerator`.

You compose it.

---

# How is this different from Faker?

[Faker](https://fakerjs.dev/) is excellent at generating individual pieces of realistic fake data such as names, addresses, companies, phone numbers, and internet data.

Constructa focuses on a different abstraction:

**reusable generation models.**

A typical fake-data workflow may repeatedly assemble records in application code:

```ts
const users = Array.from(
  { length: 100 },
  () => ({
    id: faker.string.uuid(),
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    email: faker.internet.email(),
  }),
);
```

Constructa's direction is to define the generator itself:

```ts
const user = object({
  id: uuid(),
  firstName: firstName(),
  lastName: lastName(),
  email: email(),
});
```

and then reuse that definition:

```ts
const users = generate(user, {
  count: 100,
});
```

This makes the generator something that can eventually be:

* inferred by TypeScript;
* serialized;
* visually edited;
* saved;
* shared;
* executed elsewhere.

Constructa does not need to reinvent every high-quality dataset maintained by specialized libraries.

Rich generators such as names, companies, addresses, and internet data may use libraries such as Faker internally in the future.

Those libraries remain implementation details behind Constructa's generator model.

> Constructa's goal is not to maintain the world's largest list of fake names. Its goal is to make generation itself composable.

---

# Built-in generators

The initial generator library is intentionally small.

## Primitive

| Generator | Produces                                   |
| --------- | ------------------------------------------ |
| Integer   | Whole numbers                              |
| Decimal   | Numeric values with configurable precision |
| Boolean   | `true` or `false`                          |
| Choice    | One value from a supplied collection       |
| String    | Character-based strings                    |
| Date      | Calendar dates                             |
| UUID      | UUID values                                |

## Composite

| Generator | Purpose                                    |
| --------- | ------------------------------------------ |
| Object    | Combine generators into structured objects |
| Array     | Generate arrays from another generator     |
| Template  | Build strings using generated values       |

Constructa is intentionally prioritizing **how well these generators compose** over the number of generators available.

---

# References

Structured data often contains fields that depend on other generated fields.

Constructa is designed to support references such as:

```ts
const user = object({
  firstName: firstName(),
  lastName: lastName(),

  email: template(
    "{firstName}.{lastName}@example.com",
  ),
});
```

Conceptually:

```text
firstName ──┐
            ├────▶ email
lastName ───┘
```

References are resolved as dependencies rather than relying on visual field order.

That means reordering fields should not silently change the meaning of a valid generator.

> [!NOTE]
> Reference functionality is part of the evolving composition architecture and may not yet be available in the current development build.

---

# Deterministic generation

Constructa is also designed around injected randomness rather than individual generators directly depending on global randomness.

This makes deterministic generation possible.

The intended API is:

```ts
generate(user, {
  seed: 12345,
});
```

A seed allows generation to be reproducible within the documented compatibility guarantees.

This is particularly useful for:

* tests;
* fixtures;
* debugging;
* reproducible datasets;
* bug reports.

> [!NOTE]
> Seeded generation is part of the planned execution model and may not yet be exposed publicly.

---

# Getting started

> [!WARNING]
> Constructa is currently in **early development**. It has not reached a stable public API and should be expected to change.

## Requirements

* Node.js 22+
* pnpm 10.32.1 or a compatible Corepack-managed version

Clone the repository:

```bash
git clone https://github.com/Jack-WebDev/constructa.git
cd constructa
```

Install dependencies:

```bash
pnpm install
```

Start the development environment:

```bash
pnpm dev
```

The web application runs at:

```text
http://localhost:3001
```

---

# Project status

Constructa is actively being built.

The immediate goal is not to ship hundreds of generators.

It is to prove that this works exceptionally well:

```text
Small generators
       +
Small generators
       +
Small generators
       │
       ▼
Reusable generator
```

The foundational milestones are:

```text
Portable definitions
        ↓
Type-safe authoring API
        ↓
Common execution engine
        ↓
Primitive generators
        ↓
Composition
        ↓
References
        ↓
Visual Builder
```

The architecture is considered successful when something like:

```ts
const employee = object({
  id: uuid(),

  age: integer({
    min: 18,
    max: 65,
  }),

  department: choice([
    "engineering",
    "finance",
    "sales",
  ]),

  active: boolean(),
});

const result = generate(employee);
```

can:

1. preserve its output type automatically;
2. execute through a common engine;
3. remain representable as portable data;
4. be composed into larger generators;
5. map naturally to the visual Builder.

---

# Roadmap

The current focus is intentionally narrow.

```text
Type-safe generator API
          ↓
Primitive generators
          ↓
Composition
          ↓
References
          ↓
Visual Builder
          ↓
Saved generators
          ↓
Bulk generation
```

Longer term, the same generator model should support:

```text
                 Generator Definition
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
      TypeScript        Web            CLI
                         │
                         ▼
                        API
```

Potential future capabilities include:

* deterministic seeded generation;
* bulk datasets;
* JSON and CSV exports;
* saved generators;
* generator sharing;
* document versioning;
* CLI execution;
* hosted API execution;
* richer domain generators;
* third-party integrations.

Advanced features such as conditional generation, transformations, plugins, and community distribution will only be introduced when the core generation model justifies them.

> These are directions, not promises for the current release.

---

# Architecture

Constructa keeps generation behavior independent from its interfaces.

```text
              Generator Definitions
                       │
                       ▼
              ┌────────────────┐
              │      Core      │
              │                │
              │ Registry       │
              │ Validation     │
              │ Execution      │
              │ Context        │
              │ Randomness     │
              │ References     │
              │ Errors         │
              └───────┬────────┘
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
      TypeScript      Web        Future
                                 CLI/API
```

The core engine does not need to know about:

* React;
* forms;
* buttons;
* routes;
* Tailwind;
* browser navigation.

Likewise, composite generators delegate child execution to the engine instead of implementing every child generator themselves.

This separation is what allows the same generation model to support multiple interfaces.

For package responsibilities and dependency rules, see [ARCHITECTURE.md](ARCHITECTURE.md).

---

# Development

Install dependencies:

```bash
pnpm install
```

Start the development environment:

```bash
pnpm dev
```

Start only the web application:

```bash
pnpm dev:web
```

## Useful commands

```bash
pnpm build
pnpm check
pnpm check-types
pnpm check:architecture
pnpm test
pnpm test:coverage
```

For release details, see [RELEASING.md](RELEASING.md).

---

# Contributing

Constructa is still taking shape, which makes this a useful time to contribute to its foundations.

Contributions are welcome in areas such as:

* generator implementations;
* type inference;
* composition behavior;
* validation;
* tests;
* Builder UX;
* documentation;
* bug reports;
* architecture discussions.

Read [CONTRIBUTING.md](CONTRIBUTING.md) before starting substantial work.

Security vulnerabilities should be reported privately according to [SECURITY.md](SECURITY.md).

Community participation is governed by the [Code of Conduct](CODE_OF_CONDUCT.md).

---

# License

Constructa is available under the [MIT License](LICENSE).

---

<div align="center">

### Build the generator you need.

**Small generators. Composed well.**

</div>
