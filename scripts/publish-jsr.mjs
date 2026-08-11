import { spawnSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const workspaceRoots = ["apps", "packages"];
const isDryRun = process.argv.includes("--dry-run");
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

if (!isDryRun) {
  if (!releaseTag) {
    throw new Error("Publishing requires a Changesets package tag via --tag");
  }

  selectedPackages = jsrPackages.filter(
    ({ packageJson }) =>
      `${packageJson.name}@${packageJson.version}` === releaseTag,
  );

  if (selectedPackages.length === 0) {
    console.log(`No JSR package matches ${releaseTag}; nothing to publish.`);
    process.exit(0);
  }
}

for (const { directory, packageJson, jsrConfig } of selectedPackages) {
  if (packageJson.private) {
    throw new Error(`${packageJson.name} has jsr.json but is marked private`);
  }

  if (
    jsrConfig.name !== packageJson.name ||
    jsrConfig.version !== packageJson.version
  ) {
    throw new Error(
      `${packageJson.name} has mismatched package.json and jsr.json metadata`,
    );
  }

  const args = ["publish"];

  if (isDryRun) {
    args.push("--dry-run");
  }

  console.log(
    `${isDryRun ? "Validating" : "Publishing"} ${packageJson.name}@${packageJson.version}`,
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
}

console.log(
  selectedPackages.length === 0
    ? "No JSR packages are configured yet."
    : `${isDryRun ? "Validated" : "Published"} ${selectedPackages.length} JSR package(s).`,
);
