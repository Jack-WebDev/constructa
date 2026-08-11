import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { checkArchitecture } from "./check-architecture.mjs";

const fixtureDirectories = [];

async function createPackage(rootDirectory, path, manifest, source) {
  const packageDirectory = join(rootDirectory, path);
  await mkdir(join(packageDirectory, "src"), { recursive: true });
  await writeFile(
    join(packageDirectory, "package.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  await writeFile(join(packageDirectory, "src/index.ts"), source);
}

async function createFixture({
  coreSource = "export {};",
  schemaManifest = {},
}) {
  const rootDirectory = await mkdtemp(
    join(tmpdir(), "constructa-architecture-"),
  );
  fixtureDirectories.push(rootDirectory);
  await mkdir(join(rootDirectory, "apps"));
  await mkdir(join(rootDirectory, "packages"));
  await createPackage(rootDirectory, "apps/web", { name: "web" }, "export {};");
  await createPackage(
    rootDirectory,
    "packages/schema",
    { name: "constructa-schema", ...schemaManifest },
    "export {};",
  );
  await createPackage(
    rootDirectory,
    "packages/core",
    {
      name: "constructa-core",
      dependencies: { "constructa-schema": "workspace:*" },
    },
    coreSource,
  );
  return rootDirectory;
}

afterEach(async () => {
  await Promise.all(
    fixtureDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("architecture boundary check", () => {
  it("accepts imports in the documented dependency direction", async () => {
    const rootDirectory = await createFixture({
      coreSource: 'export type {} from "constructa-schema";',
    });

    await expect(checkArchitecture(rootDirectory)).resolves.toEqual([]);
  });

  it("rejects a deliberately forbidden dependency and import", async () => {
    const rootDirectory = await createFixture({
      schemaManifest: {
        dependencies: { "constructa-core": "workspace:*" },
      },
    });
    await writeFile(
      join(rootDirectory, "packages/schema/src/index.ts"),
      'import "constructa-core";',
    );

    const errors = await checkArchitecture(rootDirectory);

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          "constructa-schema may not list constructa-core in dependencies",
        ),
        expect.stringContaining(
          "constructa-schema may not import constructa-core",
        ),
      ]),
    );
  });

  it("rejects relative imports that bypass another workspace public API", async () => {
    const rootDirectory = await createFixture({
      coreSource: 'export type {} from "../../schema/src/index.ts";',
    });

    await expect(checkArchitecture(rootDirectory)).resolves.toEqual([
      expect.stringContaining("cross-workspace relative import"),
    ]);
  });

  it("rejects applications importing SDK internals directly", async () => {
    const rootDirectory = await createFixture({});
    await writeFile(
      join(rootDirectory, "apps/web/src/index.ts"),
      'type Core = import("constructa-core").Core;',
    );

    await expect(checkArchitecture(rootDirectory)).resolves.toEqual([
      expect.stringContaining("web may not import constructa-core"),
    ]);
  });
});
