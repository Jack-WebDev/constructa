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
        packages.push({ directory, packageJson });
      } catch (error) {
        if (error.code !== "ENOENT") {
          throw error;
        }
      }
    }
  }

  return packages;
}

let synchronizedCount = 0;

for (const { directory, packageJson } of await findWorkspacePackages()) {
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

  if (jsrConfig.name !== packageJson.name) {
    throw new Error(
      `${jsrConfigPath} name (${jsrConfig.name}) does not match package.json (${packageJson.name})`,
    );
  }

  if (jsrConfig.version === packageJson.version) {
    continue;
  }

  jsrConfig.version = packageJson.version;
  await writeFile(jsrConfigPath, `${JSON.stringify(jsrConfig, null, 2)}\n`);
  synchronizedCount += 1;
}

console.log(`Synchronized ${synchronizedCount} JSR package version(s).`);
