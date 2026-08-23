import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const workspaceRoots = ["apps", "packages"];
const isCheck = process.argv.includes("--check");

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function findWorkspacePackages() {
  const packages = [];

  for (const root of workspaceRoots) {
    const entries = await readdir(root, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const directory = join(root, entry.name);

      try {
        const packageJson = await readJson(join(directory, "package.json"));

        packages.push({
          directory,
          packageJson,
        });
      } catch (error) {
        if (error.code !== "ENOENT") {
          throw error;
        }
      }
    }
  }

  return packages;
}

const workspacePackages = await findWorkspacePackages();

const versionsByPackageName = new Map(
  workspacePackages.map(({ packageJson }) => [
    packageJson.name,
    packageJson.version,
  ]),
);

const jsrPackagesByNpmName = new Map(
  (
    await Promise.all(
      workspacePackages.map(async ({ directory, packageJson }) => {
        try {
          return {
            packageJson,
            jsrConfig: await readJson(join(directory, "jsr.json")),
          };
        } catch (error) {
          if (error.code === "ENOENT") {
            return undefined;
          }

          throw error;
        }
      }),
    )
  )
    .filter(Boolean)
    .map(({ packageJson, jsrConfig }) => [packageJson.name, jsrConfig]),
);

let synchronizedCount = 0;

for (const { directory, packageJson } of workspacePackages) {
  const jsrConfigPath = join(directory, "jsr.json");

  let jsrConfig;

  try {
    jsrConfig = await readJson(jsrConfigPath);
  } catch (error) {
    if (error.code === "ENOENT") {
      continue;
    }

    throw error;
  }

  if (packageJson.private) {
    throw new Error(`${packageJson.name} has jsr.json but is marked private`);
  }

  let changed = false;

  if (jsrConfig.version !== packageJson.version) {
    jsrConfig.version = packageJson.version;
    changed = true;
  }

  const workspaceDependencies = {
    ...packageJson.dependencies,
    ...packageJson.optionalDependencies,
    ...packageJson.peerDependencies,
  };

  for (const dependencyName of Object.keys(workspaceDependencies)) {
    const dependencyJsrConfig = jsrPackagesByNpmName.get(dependencyName);
    const version = versionsByPackageName.get(dependencyName);

    if (!dependencyJsrConfig || !version) {
      continue;
    }

    const nextSpecifier = `jsr:${dependencyJsrConfig.name}@^${version}`;
    jsrConfig.imports ??= {};

    if (jsrConfig.imports[dependencyName] !== nextSpecifier) {
      jsrConfig.imports[dependencyName] = nextSpecifier;
      changed = true;
    }
  }

  if (!changed) {
    continue;
  }

  if (!isCheck) {
    await writeFile(jsrConfigPath, `${JSON.stringify(jsrConfig, null, 2)}\n`);
  }

  synchronizedCount += 1;
}

if (isCheck && synchronizedCount > 0) {
  throw new Error(
    `${synchronizedCount} JSR package config(s) need synchronization. Run node scripts/sync-jsr-versions.mjs.`,
  );
}

console.log(
  `${isCheck ? "Verified" : "Synchronized"} ${synchronizedCount} JSR package config(s).`,
);
