<div align="center">

# CONSTRUCTA

### *Build the generator you need.*

<p>
  <img src="https://img.shields.io/badge/status-early--development-EF4444?style=for-the-badge&labelColor=1a1a2e" alt="Status" />
  <img src="https://img.shields.io/badge/license-MIT-F59E0B?style=for-the-badge&labelColor=1a1a2e" alt="License" />
  <img src="https://img.shields.io/badge/node-22%2B-22C55E?style=for-the-badge&logo=node.js&logoColor=white&labelColor=1a1a2e" alt="Node" />
  <img src="https://img.shields.io/badge/pnpm-10.32.1-6366F1?style=for-the-badge&logo=pnpm&logoColor=white&labelColor=1a1a2e" alt="pnpm" />
</p>

**Constructa is a toolkit for creating reusable data generators from small, composable building blocks.**

<sub>Generate a number. Generate a UUID. Pick from a list. Or combine them into anything you need.</sub>

<br>

[**⚡ Why Constructa**](#-why-constructa) •
[**🧩 What Can You Build**](#-what-can-you-build) •
[**📦 Install**](#-install) •
[**🛠️ Built-in Generators**](#️-built-in-generators) •
[**🗺️ Roadmap**](#️-where-is-constructa-going) •
[**🤝 Contributing**](#-contributing)

</div>

<br>

```text
User
├── id          → UUID
├── age         → Integer(18, 65)
├── role        → Choice(admin, member, viewer)
└── active      → Boolean
```

**into:**

```json
{
  "id": "289b71e6-...",
  "age": 32,
  "role": "member",
  "active": true
}
```

The same idea scales from generating **one value** to generating **entire datasets**.

> [!TIP]
> Instead of searching for a generator that already exists, compose the one you need.

<br>

## ⚡ Why Constructa?

Most generator tools are collections of predefined utilities:

```text
Random Number Generator
Random Date Generator
Random UUID Generator
Random Name Generator
...
```

That works until you need something specific.

Suppose you need test customers shaped like this:

```json
{
  "id": "usr_...",
  "age": 27,
  "plan": "pro",
  "active": true
}
```

With Constructa, **each field is simply another generator**:

```json
{
  "type": "object",
  "fields": {
    "id": { "type": "uuid" },
    "age": { "type": "integer", "min": 18, "max": 65 },
    "plan": { "type": "choice", "values": ["free", "pro", "enterprise"] },
    "active": { "type": "boolean" }
  }
}
```

Constructa executes the definition and gives you the result.

| ❌ Without Constructa | ✅ With Constructa |
| --- | --- |
| A special-purpose `customerGenerator` | Generators composed from generators |
| A giant collection of unrelated tools | One small, reusable set of building blocks |

<br>

## 🧩 What can you build?

Anything that can be described using Constructa's building blocks.

```text
Primitive                     Composite

Integer ───────┐
Decimal ───────┤
Boolean ───────┤
Choice ────────┼──────▶ Object
String ────────┤        Array
Date ──────────┤        Template
UUID ──────────┘
```

That can become:

<table>
<tr>
<td>🧑‍💻 Test users</td>
<td>🗄️ Database fixtures</td>
<td>📡 Mock API responses</td>
</tr>
<tr>
<td>🛒 Product catalogs</td>
<td>🌱 Seed data</td>
<td>🧪 QA datasets</td>
</tr>
<tr>
<td>👥 Random teams</td>
<td>🎮 Character generators</td>
<td>❓ Quiz data</td>
</tr>
<tr>
<td colspan="3">🧠 Custom domain-specific generators</td>
</tr>
</table>

Because generator definitions are plain data, they can eventually be saved, shared, versioned, exported, and executed anywhere Constructa runs.

<br>

## 🔍 Quick example

**A simple generator:**

```json
{
  "type": "integer",
  "min": 1,
  "max": 100
}
```

**A composed generator:**

```json
{
  "type": "object",
  "fields": {
    "id": { "type": "uuid" },
    "score": { "type": "integer", "min": 0, "max": 100 },
    "status": { "type": "choice", "values": ["pending", "active", "disabled"] }
  }
}
```

**Output:**

```json
{
  "id": "7e21b456-...",
  "score": 84,
  "status": "active"
}
```

The object generator does not know how UUIDs, integers, or choices work. **It asks Constructa to execute its child generators.** That is what makes the system extensible.

<br>

## 📦 Install

> [!NOTE]
> Constructa is currently in **early development**.

**Requirements**

- Node.js 22+
- pnpm 10.32.1 or a compatible Corepack-managed version

```bash
# Clone the repository
git clone https://github.com/Jack-WebDev/constructa.git
cd constructa

# Install dependencies
pnpm install

# Start the development environment
pnpm dev
```

The web application runs at:

```text
http://localhost:3001
```

> [!WARNING]
> Public packages are still evolving and should not yet be considered stable.

<br>

## 🎨 Use Constructa

Constructa is being built around two ways of working.

<table>
<tr>
<td width="50%" valign="top">

### ⚡ Quick Generate

Need one value? Pick a generator, configure it, and generate.

```text
Integer

Min     1
Max     100

[ Generate ]

47
```

You should not need to understand schemas or composition just to generate a simple value.

</td>
<td width="50%" valign="top">

### 🧱 Visual Generator Builder

Need something more specific? Compose generators visually:

```text
Customer

├── id
│   └── UUID
│
├── age
│   └── Integer
│       ├── min: 18
│       └── max: 80
│
├── plan
│   └── Choice
│       ├── free
│       ├── pro
│       └── enterprise
│
└── active
    └── Boolean
```

Then generate one record or thousands of them.

</td>
</tr>
</table>

> The goal is to make composition available **without requiring users to write code**.

<br>

## 🛠️ Built-in generators

The initial generator library is deliberately small.

| 🔹 Primitive | 🔷 Composite |
| --- | --- |
| Integer | Object |
| Decimal | Array |
| Boolean | Template |
| Choice | |
| String | |
| Date | |
| UUID | |

> Constructa is not trying to win by having the longest list of generators. The goal is to make generators useful **together**.

<br>

## 🔐 Can I trust it?

Constructa is open source and available under the [MIT License](LICENSE).

**Generator definitions are treated as data, not executable JavaScript.**

A definition like:

```json
{
  "type": "integer",
  "min": 1,
  "max": 10
}
```

describes what Constructa should execute rather than injecting arbitrary code into the engine.

Constructa is also designed so that the generation engine remains **independent from the web interface**. Core generation behavior can therefore be tested without depending on React, forms, routes, or other UI concerns.

🛡️ Security vulnerabilities should be reported privately according to [SECURITY.md](SECURITY.md).

<br>

## 🗺️ Where is Constructa going?

The current focus is the generator engine and visual builder.

The longer-term idea is simple:

<div align="center">

> ### 🎯 Define a generator once. Run it anywhere

</div>

```text
                    Generator Definition
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
             Web           SDK           CLI
                            │
                            ▼
                           API
```

A generator created visually should eventually be usable from JavaScript:

```ts
const users = generate(userGenerator, {
  count: 100,
});
```

from the terminal:

```bash
constructa generate user --count 100
```

or through an API without rewriting its definition.

**Planned capabilities include:**

<table>
<tr>
<td>

- 🎲 Seeded & deterministic generation
- 📊 Bulk datasets
- 📤 JSON, CSV, JSON Lines & SQL exports
- 💾 Saved generators
- 🔗 Generator sharing
- 🏷️ Generator versioning

</td>
<td>

- 🔀 References between generated fields
- 📄 Templates
- ⚙️ Limited conditional generation
- ♻️ Reusable generator presets
- 📚 JavaScript/TypeScript SDK
- 💻 CLI

</td>
<td>

- 🌐 Public API
- 🌍 Community generators
- 🔌 Integrations
- 🧰 Sandboxed plugins

</td>
</tr>
</table>

> These are long-term directions, not promises for the current release.

<br>

## 📊 Project status

Constructa is in **early development**.

The immediate goal is to prove the core composition model:

```text
Small generators
       +
Small generators
       +
Small generators
       │
       ▼
Useful custom generator
```

🎯 The first major milestone is an engine capable of executing nested generator definitions without composite generators needing to understand the implementation of their children.

<br>

## 🧑‍💻 Development

```bash
# Install dependencies
pnpm install

# Start the development environment
pnpm dev

# Start only the web application
pnpm dev:web
```

**Useful commands**

```bash
pnpm build
pnpm check
pnpm check-types
pnpm check:architecture
pnpm test
pnpm test:coverage
```

📘 For package responsibilities and dependency rules, see [ARCHITECTURE.md](ARCHITECTURE.md).

🚢 For release details, see [RELEASING.md](RELEASING.md).

<br>

## 🤝 Contributing

Contributions are welcome!

Bug reports, feature proposals, documentation improvements, and code contributions are all useful while Constructa is still taking shape.

Read [CONTRIBUTING.md](CONTRIBUTING.md) before starting substantial work.

Community participation is governed by the [Code of Conduct](CODE_OF_CONDUCT.md).

<br>

## 📄 License

Constructa is available under the [MIT License](LICENSE).

<br>

<div align="center">

**Constructa is not trying to become the website with the most generators.**

### It is trying to become the system you use when the generator you need does not exist yet

<sub>🧬 Small generators. Composed well.</sub>

</div>
