# Releasing Constructa packages

Constructa uses Changesets to version packages and publish matching releases to npm and JSR.

## Making a package publishable

Workspace packages remain private until their public API and distribution artifacts are ready. To opt a package into releases:

1. Set `private` to `false` in its `package.json`.
2. Give it a valid version and a unique npm package name.
3. Verify its compiled npm entrypoints, types, `files`, `exports`, and `publishConfig` metadata.
4. Add repository, homepage, and issue-tracker URLs after the public repository URL is known.
5. Verify its tsdown build produces the exact files included in the npm package.
6. If the package will also be published to JSR, add a `jsr.json` file with its JSR package name, the same version, explicit TypeScript entrypoints, and appropriate include/exclude rules. JSR package names may differ from npm package names.

Do not make a package public merely to test the release workflow. Registry versions are immutable.

## Adding a changeset

Every pull request that changes a published package's public behavior should include a changeset:

```bash
pnpm changeset
```

Select the affected packages, choose `patch`, `minor`, or `major`, and describe the change from a package user's perspective. Commit the generated file under `.changeset/`.

Changesets are normally unnecessary for private apps, tests, repository configuration, and internal-only refactors.

## Release flow

1. Changes are merged into `main` with their changeset files.
2. The release workflow creates or updates a **Version Packages** pull request.
3. That pull request applies package versions and changelogs. It also synchronizes versions into any matching `jsr.json` files.
4. Merging the version pull request publishes changed public packages to npm and creates package tags and GitHub releases.
5. Each GitHub release triggers the JSR workflow. If the released package contains `jsr.json`, the same version is published to JSR.

The npm and JSR workflows use GitHub OIDC trusted publishing. They should not require long-lived registry tokens.

## Registry setup

Before the first release:

- Confirm the selected npm package names are available or that the publishing account has access to them.
- Configure each npm package's trusted publisher for `.github/workflows/release.yml`.
- Configure each JSR package's GitHub publishing integration for this repository.
- Ensure every public package's repository URL exactly matches the final GitHub repository.
- Enable GitHub Actions to create pull requests in the repository settings.

## Local validation

Validate the repository and inspect pending releases with:

```bash
pnpm run check
pnpm run check-types
pnpm run test
pnpm run build
pnpm changeset status
```

After adding a `jsr.json` file, validate its JSR package without publishing:

```bash
pnpm release:jsr:dry-run
```

Local npm package contents can be inspected from the relevant package directory with `npm pack --dry-run`.
