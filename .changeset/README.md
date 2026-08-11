# Changesets

Changesets record user-facing changes to publishable Constructa packages.

Run `pnpm changeset` in a feature branch, select the affected packages, choose the appropriate semantic version bump, and write a concise summary for package users. Commit the generated Markdown file with the change.

Changesets are not required for changes that cannot affect a published package, such as private application code, repository maintenance, or internal documentation.

The release workflow collects committed changesets into a version pull request. Merging that pull request publishes the updated packages to npm and creates GitHub releases. Packages that also contain a `jsr.json` file are subsequently published to JSR from their GitHub release.
