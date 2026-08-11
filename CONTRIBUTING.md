# Contributing to Constructa

Thank you for considering a contribution to Constructa. Contributions of code, documentation, bug reports, design feedback, and product ideas are welcome.

## Before you start

- Read and follow the [Code of Conduct](CODE_OF_CONDUCT.md).
- Search existing issues before opening a new one.
- Open an issue before starting a substantial change so the approach can be discussed early.
- Keep pull requests focused. Unrelated changes should be submitted separately.

Constructa is in early development, and some public interfaces and schemas may change. Discuss substantial architectural changes in an issue before implementation.

## Development setup

You will need Node.js 22 or newer and pnpm 10.32.1.

```bash
git clone <your-fork-url>
cd constructa
corepack enable
pnpm install
pnpm run dev
```

The web application runs at [http://localhost:3001](http://localhost:3001).

Copy an application's `.env.example` file to `.env` when local environment variables are required. Never commit credentials or other secrets.

## Repository layout

```text
apps/web        Web application
apps/cli        Command-line application scaffold
apps/api        Public API scaffold
packages/schema Portable generator definitions
packages/core   Generator registry and execution engine
packages/generators Built-in generator implementations
packages/exporters Output serialization and export formats
packages/sdk    Developer-facing API
packages/ui     Shared UI components and styles
packages/env    Environment validation
packages/config Shared TypeScript configuration
```

## Making a change

1. Fork the repository and create a branch from the default branch.
2. Make the smallest coherent change that solves the problem.
3. Add or update tests when behavior changes.
4. Add a changeset when a publishable package's user-facing behavior changes.
5. Update public documentation when behavior, configuration, or architecture changes.
6. Run the local checks.
7. Open a pull request using the repository template.

Use clear branch names such as `fix/integer-range-validation` or `feat/object-generator`.

## Local checks

Run these commands before opening a pull request:

```bash
pnpm run check
pnpm run check-types
pnpm run test
pnpm run build
```

`pnpm run check` includes the architecture boundary validation. Use `pnpm run check:fix` to apply safe Biome formatting and lint fixes.

Tests live beside the source they exercise and use `.test.ts` or `.test.tsx` filenames. Node is the default environment for engine, API, and CLI tests; web and UI tests run in jsdom. New behavior should include focused tests in the relevant application or package.

## Changesets

Changes to publishable packages should normally include a changeset:

```bash
pnpm changeset
```

Choose the affected packages and the appropriate semantic version bump, then describe the change for package users. Commit the generated `.changeset/*.md` file with your pull request. Changesets are not required for private applications, internal maintenance, or documentation-only changes.

See [RELEASING.md](RELEASING.md) for the complete package release process.

## Code guidelines

- Preserve the separation between the generator engine and its user interfaces.
- Represent generator definitions as serializable data.
- Prefer registration and composition over hard-coded type branching.
- Return structured validation and execution errors where practical.
- Do not introduce arbitrary execution of user-provided code.
- Follow the existing TypeScript and Biome configuration.
- Avoid adding dependencies when a small, maintainable implementation is sufficient.

## Commits and pull requests

Write concise, imperative commit messages. Conventional Commit prefixes such as `feat:`, `fix:`, `docs:`, and `chore:` are encouraged but not required.

A good pull request:

- Explains the problem and the chosen solution
- Links related issues
- Describes how the change was tested
- Includes screenshots for visible UI changes
- Calls out breaking changes, migrations, or follow-up work
- Contains no unrelated formatting or generated-file changes

Maintainers may ask for changes before merging. A contribution may be declined if it conflicts with the product direction, duplicates planned work, creates avoidable maintenance cost, or cannot be supported safely.

## Reporting security issues

Do not disclose security vulnerabilities in public issues. Follow the private reporting process in [SECURITY.md](SECURITY.md).

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
