import { spawnSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const workspaceRoots = ["apps", "packages"];
const isDryRun = process.argv.includes("--dry-run");
const allowDirty = process.argv.includes("--allow-dirty");
const releaseTagIndex = process.argv.indexOf("--tag");
const releaseTag =
  releaseTagIndex === -1 ? undefined : process.argv[releaseTagIndex + 1];

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function findJsrPackages() {
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
        const jsrConfig = await readJson(join(directory, "jsr.json"));
        packages.push({ directory, packageJson, jsrConfig });
      } catch (error) {
        if (error.code !== "ENOENT") {
          throw error;
        }
      }
    }
  }

  return packages;
}

const jsrPackages = await findJsrPackages();
let selectedPackages = jsrPackages;

if (releaseTag) {
  selectedPackages = jsrPackages.filter(
    ({ packageJson }) =>
      `${packageJson.name}@${packageJson.version}` === releaseTag,
  );

  if (selectedPackages.length === 0) {
    console.log(`No JSR package matches ${releaseTag}; nothing to publish.`);
    process.exit(0);
  }
}

selectedPackages = orderPackagesByJsrDependencies(selectedPackages);

let processedCount = 0;

for (const { directory, packageJson, jsrConfig } of selectedPackages) {
  if (packageJson.private) {
    throw new Error(`${packageJson.name} has jsr.json but is marked private`);
  }

  if (jsrConfig.version !== packageJson.version) {
    throw new Error(
      `${packageJson.name} has mismatched package.json and jsr.json versions`,
    );
  }

  if (!isDryRun && isJsrVersionPublished(jsrConfig)) {
    console.log(
      `Skipping ${jsrConfig.name}@${jsrConfig.version}; already published on JSR.`,
    );
    continue;
  }

  const args = ["publish"];

  if (isDryRun) {
    args.push("--dry-run");
  }

  if (allowDirty) {
    args.push("--allow-dirty");
  }

  console.log(
    `${isDryRun ? "Validating" : "Publishing"} ${jsrConfig.name}@${jsrConfig.version} from ${packageJson.name}`,
  );
  const result = spawnSync("jsr", args, {
    cwd: directory,
    shell: process.platform === "win32",
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  processedCount += 1;
}

console.log(
  selectedPackages.length === 0
    ? "No JSR packages are configured yet."
    : `${isDryRun ? "Validated" : "Published"} ${processedCount} JSR package(s).`,
);

function isJsrVersionPublished(jsrConfig) {
  const result = spawnSync(
    "jsr",
    ["info", `${jsrConfig.name}@${jsrConfig.version}`],
    {
      shell: process.platform === "win32",
      stdio: "ignore",
    },
  );

  return result.status === 0;
}

/**
 * Publishes local JSR dependencies before their dependents. Changesets updates
 * version ranges before this script runs, so filesystem ordering is not enough:
 * JSR must be able to resolve each updated dependency at publish time.
 */
function orderPackagesByJsrDependencies(packages) {
  const packagesByJsrName = new Map(
    packages.map((workspacePackage) => [
      workspacePackage.jsrConfig.name,
      workspacePackage,
    ]),
  );
  const states = new Map();
  const ordered = [];

  const visit = (workspacePackage, trail = []) => {
    const packageName = workspacePackage.jsrConfig.name;
    const state = states.get(packageName);

    if (state === "visited") return;
    if (state === "visiting") {
      throw new Error(
        `Circular local JSR dependency: ${[...trail, packageName].join(" -> ")}`,
      );
    }

    states.set(packageName, "visiting");
    for (const specifier of Object.values(
      workspacePackage.jsrConfig.imports ?? {},
    )) {
      const dependencyName = getJsrPackageName(specifier);
      const dependency =
        dependencyName === undefined
          ? undefined
          : packagesByJsrName.get(dependencyName);
      if (dependency !== undefined) {
        visit(dependency, [...trail, packageName]);
      }
    }
    states.set(packageName, "visited");
    ordered.push(workspacePackage);
  };

  for (const workspacePackage of packages) {
    visit(workspacePackage);
  }

  return ordered;
}

function getJsrPackageName(specifier) {
  if (typeof specifier !== "string" || !specifier.startsWith("jsr:")) {
    return undefined;
  }

  const versionSeparator = specifier.lastIndexOf("@");
  return versionSeparator <= 4
    ? undefined
    : specifier.slice(4, versionSeparator);
}
