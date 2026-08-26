import { spawnSync } from "node:child_process";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = resolve(fileURLToPath(new URL("..", import.meta.url)));
const packageDirectories = [
  "packages/schema",
  "packages/core",
  "packages/generators",
  "packages/exporters",
  "packages/sdk",
];
const allowedRootFiles = new Set(["README.md", "package.json"]);

function run(command, arguments_, options = {}) {
  const result = spawnSync(command, arguments_, {
    cwd: options.cwd ?? rootDirectory,
    encoding: "utf8",
    env: { ...process.env, ...options.env },
  });

  if (result.error) throw result.error;
  if (result.status === 0) return result.stdout;

  throw new Error(
    `${command} ${arguments_.join(" ")} failed.\n${result.stdout}\n${result.stderr}`,
  );
}

function collectExportTargets(value, targets = []) {
  if (typeof value === "string") {
    if (value.startsWith(".")) targets.push(value.slice(2));
    return targets;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectExportTargets(item, targets);
    return targets;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value))
      collectExportTargets(item, targets);
  }
  return targets;
}

function assertPackageContents(packageInfo, manifest) {
  const files = new Set(packageInfo.files.map(({ path }) => path));
  const invalidFiles = [...files].filter(
    (path) => !path.startsWith("dist/") && !allowedRootFiles.has(path),
  );
  if (invalidFiles.length > 0) {
    throw new Error(
      `${manifest.name} includes files outside its public artifact: ${invalidFiles.join(", ")}`,
    );
  }

  const sourceFiles = [...files].filter((path) => path.startsWith("src/"));
  if (sourceFiles.length > 0) {
    throw new Error(
      `${manifest.name} includes source files: ${sourceFiles.join(", ")}`,
    );
  }

  const entryPoints = [
    manifest.main,
    manifest.types,
    ...collectExportTargets(manifest.exports),
  ]
    .filter(Boolean)
    .map((path) => path.replace(/^\.\//u, ""));
  const missingEntryPoints = entryPoints.filter((path) => !files.has(path));
  if (missingEntryPoints.length > 0) {
    throw new Error(
      `${manifest.name} exports files missing from its tarball: ${missingEntryPoints.join(", ")}`,
    );
  }
}

async function packPackages(artifactsDirectory) {
  const artifacts = [];

  for (const relativeDirectory of packageDirectories) {
    const directory = join(rootDirectory, relativeDirectory);
    const manifest = JSON.parse(
      await readFile(join(directory, "package.json"), "utf8"),
    );
    const output = run(
      "pnpm",
      ["pack", "--json", "--pack-destination", artifactsDirectory, "."],
      { cwd: directory },
    );
    const packageInfo = JSON.parse(output);

    assertPackageContents(packageInfo, manifest);
    artifacts.push({
      manifest,
      path: packageInfo.filename,
    });
  }

  return artifacts;
}

async function verifyConsumer(artifacts, consumerDirectory, npmCacheDirectory) {
  await writeFile(
    join(consumerDirectory, "package.json"),
    `${JSON.stringify({ name: "constructa-release-smoke-test", private: true, type: "module" })}\n`,
  );
  await writeFile(
    join(consumerDirectory, "runtime.mjs"),
    [
      'import { choice, generate, object } from "constructa-sdk";',
      'const definition = object({ role: choice(["admin", "member"]) });',
      'const value = generate(definition, { seed: "release-smoke-test" });',
      'if (value.role !== "admin" && value.role !== "member") throw new Error("Unexpected generated value");',
      "",
    ].join("\n"),
  );
  await writeFile(
    join(consumerDirectory, "index.mts"),
    [
      'import { choice, generate, type Infer } from "constructa-sdk";',
      'const definition = choice(["admin", "member"] as const);',
      "const value: Infer<typeof definition> = generate(definition);",
      'const expected: "admin" | "member" = value;',
      "void expected;",
      "",
    ].join("\n"),
  );
  await writeFile(
    join(consumerDirectory, "tsconfig.json"),
    `${JSON.stringify({ compilerOptions: { module: "NodeNext", moduleResolution: "NodeNext", noEmit: true, strict: true } }, null, 2)}\n`,
  );

  run(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      ...artifacts.map(({ path }) => path),
    ],
    { cwd: consumerDirectory, env: { npm_config_cache: npmCacheDirectory } },
  );
  run(
    process.execPath,
    [
      join(rootDirectory, "node_modules/typescript/bin/tsc"),
      "--project",
      "tsconfig.json",
    ],
    {
      cwd: consumerDirectory,
    },
  );
  run(process.execPath, ["runtime.mjs"], { cwd: consumerDirectory });
}

async function verifyProvenanceConfiguration() {
  const npmConfiguration = await readFile(
    join(rootDirectory, ".npmrc"),
    "utf8",
  );
  if (!/^provenance=true$/mu.test(npmConfiguration)) {
    throw new Error(".npmrc must enable npm provenance for supported releases");
  }
}

const temporaryDirectory = await mkdtemp(
  join(tmpdir(), "constructa-release-artifacts-"),
);

try {
  const artifactsDirectory = join(temporaryDirectory, "artifacts");
  const consumerDirectory = join(temporaryDirectory, "consumer");
  const npmCacheDirectory = join(temporaryDirectory, "npm-cache");
  await Promise.all([mkdir(artifactsDirectory), mkdir(consumerDirectory)]);

  await verifyProvenanceConfiguration();
  const artifacts = await packPackages(artifactsDirectory);
  await verifyConsumer(artifacts, consumerDirectory, npmCacheDirectory);
  await access(
    join(
      consumerDirectory,
      "node_modules",
      "constructa-sdk",
      "dist",
      "index.d.ts",
    ),
  );
  console.log(
    `Verified ${artifacts.length} npm package artifacts in a clean consumer.`,
  );
} finally {
  await rm(temporaryDirectory, { force: true, recursive: true });
}
