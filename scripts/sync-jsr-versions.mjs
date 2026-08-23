import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const workspaceRoots = ["apps", "packages"];

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

  if (jsrConfig.imports) {
    for (const [name, specifier] of Object.entries(jsrConfig.imports)) {
      if (!specifier.startsWith("jsr:@constructa/")) {
        continue;
      }

      const match = specifier.match(/^jsr:(@constructa\/[^@]+)@/);

      if (!match) {
        continue;
      }

      const dependencyName = match[1];

      // JSR name -> npm workspace name
      const npmPackageName = dependencyName.replace(
        "@constructa/",
        "constructa-",
      );

      const version = versionsByPackageName.get(npmPackageName);

      if (!version) {
        continue;
      }

      const nextSpecifier = `jsr:${dependencyName}@^${version}`;

      if (specifier !== nextSpecifier) {
        jsrConfig.imports[name] = nextSpecifier;
        changed = true;
      }
    }
  }

  if (!changed) {
    continue;
  }

  await writeFile(jsrConfigPath, `${JSON.stringify(jsrConfig, null, 2)}\n`);

  synchronizedCount += 1;
}

console.log(`Synchronized ${synchronizedCount} JSR package config(s).`);
