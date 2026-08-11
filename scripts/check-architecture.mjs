import { readdir, readFile } from "node:fs/promises";
import { dirname, extname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const runtimeDependencyPolicy = Object.freeze({
  "@constructa/api": ["@constructa/env", "constructa-sdk"],
  "@constructa/cli": ["@constructa/env", "constructa-sdk"],
  "@constructa/config": [],
  "constructa-core": ["constructa-schema"],
  "@constructa/env": [],
  "constructa-exporters": [],
  "constructa-generators": ["constructa-core", "constructa-schema"],
  "constructa-schema": [],
  "constructa-sdk": [
    "constructa-core",
    "constructa-exporters",
    "constructa-generators",
    "constructa-schema",
  ],
  "@constructa/ui": [],
  web: ["@constructa/env", "constructa-sdk", "@constructa/ui"],
});

const developmentOnlyDependencies = new Set(["@constructa/config"]);
const dependencyFields = [
  "dependencies",
  "optionalDependencies",
  "peerDependencies",
  "devDependencies",
];
const runtimeDependencyFields = dependencyFields.slice(0, -1);
const sourceExtensions = new Set([
  ".cjs",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".mts",
  ".ts",
  ".tsx",
]);
const ignoredDirectories = new Set([
  ".next",
  ".output",
  ".turbo",
  "coverage",
  "dist",
  "node_modules",
]);

function isPathWithin(parentDirectory, candidatePath) {
  const pathFromParent = relative(parentDirectory, candidatePath);
  return (
    pathFromParent === "" ||
    (!pathFromParent.startsWith("..") && !isAbsolute(pathFromParent))
  );
}

function isDevelopmentFile(filePath, packageDirectory) {
  const packageRelativePath = relative(packageDirectory, filePath);
  return (
    /(?:^|\/)(?:__tests__|test|tests)(?:\/|$)/u.test(packageRelativePath) ||
    /\.(?:config|spec|test)\.[cm]?[jt]sx?$/u.test(packageRelativePath)
  );
}

function packageNameFromSpecifier(specifier, workspacePackageNames) {
  return workspacePackageNames.find(
    (packageName) =>
      specifier === packageName || specifier.startsWith(`${packageName}/`),
  );
}

function collectModuleSpecifiers(sourceText, filePath) {
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
  );
  const imports = [];

  function recordStringLiteral(node) {
    if (node && ts.isStringLiteralLike(node)) {
      imports.push({
        line: sourceFile.getLineAndCharacterOfPosition(node.pos).line + 1,
        specifier: node.text,
      });
    }
  }

  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      recordStringLiteral(node.moduleSpecifier);
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument)
    ) {
      recordStringLiteral(node.argument.literal);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      recordStringLiteral(node.moduleReference.expression);
    } else if (
      ts.isCallExpression(node) &&
      node.arguments.length >= 1 &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (node.arguments.length === 1 &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === "require"))
    ) {
      recordStringLiteral(node.arguments[0]);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return imports;
}

async function findSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = resolve(directory, entry.name);
    if (entry.isDirectory() && !ignoredDirectories.has(entry.name)) {
      files.push(...(await findSourceFiles(entryPath)));
    } else if (entry.isFile() && sourceExtensions.has(extname(entry.name))) {
      files.push(entryPath);
    }
  }

  return files;
}

async function findWorkspacePackages(rootDirectory) {
  const packages = [];

  for (const workspaceDirectoryName of ["apps", "packages"]) {
    const workspaceDirectory = resolve(rootDirectory, workspaceDirectoryName);
    const entries = await readdir(workspaceDirectory, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const directory = resolve(workspaceDirectory, entry.name);
      const manifestPath = resolve(directory, "package.json");
      const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
      packages.push({ directory, manifest, manifestPath, name: manifest.name });
    }
  }

  return packages;
}

function declaredDependencyFields(manifest, dependencyName) {
  return dependencyFields.filter((field) => manifest[field]?.[dependencyName]);
}

function allowedDependencies(packageName, development) {
  const allowed = new Set(runtimeDependencyPolicy[packageName]);
  if (development) {
    for (const dependencyName of developmentOnlyDependencies) {
      allowed.add(dependencyName);
    }
  }
  return allowed;
}

function checkManifest(workspacePackage, workspacePackageNames, rootDirectory) {
  const errors = [];

  if (!(workspacePackage.name in runtimeDependencyPolicy)) {
    return [
      `${relative(rootDirectory, workspacePackage.manifestPath)}: no architecture policy is defined for ${workspacePackage.name}`,
    ];
  }

  for (const field of dependencyFields) {
    const dependencies = workspacePackage.manifest[field] ?? {};
    const allowed = allowedDependencies(
      workspacePackage.name,
      field === "devDependencies",
    );

    for (const dependencyName of Object.keys(dependencies)) {
      if (
        dependencyName !== workspacePackage.name &&
        workspacePackageNames.includes(dependencyName) &&
        !allowed.has(dependencyName)
      ) {
        errors.push(
          `${relative(rootDirectory, workspacePackage.manifestPath)}: ${workspacePackage.name} may not list ${dependencyName} in ${field}`,
        );
      }
    }
  }

  return errors;
}

function checkImport({
  filePath,
  importedPackage,
  line,
  rootDirectory,
  sourcePackage,
  specifier,
}) {
  const development = isDevelopmentFile(filePath, sourcePackage.directory);
  const displayPath = relative(rootDirectory, filePath);

  if (importedPackage.name === sourcePackage.name) {
    return [];
  }

  if (specifier.startsWith(".")) {
    return [
      `${displayPath}:${line}: cross-workspace relative import "${specifier}" bypasses the public API of ${importedPackage.name}`,
    ];
  }

  if (
    !allowedDependencies(sourcePackage.name, development).has(
      importedPackage.name,
    )
  ) {
    return [
      `${displayPath}:${line}: ${sourcePackage.name} may not import ${importedPackage.name}`,
    ];
  }

  const declaredFields = declaredDependencyFields(
    sourcePackage.manifest,
    importedPackage.name,
  );
  const usableFields = development ? dependencyFields : runtimeDependencyFields;
  if (!declaredFields.some((field) => usableFields.includes(field))) {
    const expectedField = development
      ? "dependencies or devDependencies"
      : "dependencies";
    return [
      `${displayPath}:${line}: ${sourcePackage.name} imports ${importedPackage.name}, but does not declare it in ${expectedField}`,
    ];
  }

  return [];
}

async function checkSourceImports(workspacePackages, rootDirectory) {
  const errors = [];
  const workspacePackageNames = workspacePackages
    .map(({ name }) => name)
    .sort((left, right) => right.length - left.length);

  for (const sourcePackage of workspacePackages) {
    const sourceFiles = await findSourceFiles(sourcePackage.directory);

    for (const filePath of sourceFiles) {
      const sourceText = await readFile(filePath, "utf8");
      const imports = collectModuleSpecifiers(sourceText, filePath);

      for (const { line, specifier } of imports) {
        let importedPackage;

        if (specifier.startsWith(".")) {
          const resolvedImport = resolve(dirname(filePath), specifier);
          importedPackage = workspacePackages.find(
            ({ directory, name }) =>
              name !== sourcePackage.name &&
              isPathWithin(directory, resolvedImport),
          );
        } else {
          const importedPackageName = packageNameFromSpecifier(
            specifier,
            workspacePackageNames,
          );
          importedPackage = workspacePackages.find(
            ({ name }) => name === importedPackageName,
          );
        }

        if (importedPackage) {
          errors.push(
            ...checkImport({
              filePath,
              importedPackage,
              line,
              rootDirectory,
              sourcePackage,
              specifier,
            }),
          );
        } else if (specifier.startsWith("@constructa/")) {
          errors.push(
            `${relative(rootDirectory, filePath)}:${line}: import "${specifier}" does not resolve to a workspace package`,
          );
        }
      }
    }
  }

  return errors;
}

export async function checkArchitecture(rootDirectory = repositoryRoot) {
  const workspacePackages = await findWorkspacePackages(rootDirectory);
  const workspacePackageNames = workspacePackages.map(({ name }) => name);
  const errors = workspacePackages.flatMap((workspacePackage) =>
    checkManifest(workspacePackage, workspacePackageNames, rootDirectory),
  );
  errors.push(...(await checkSourceImports(workspacePackages, rootDirectory)));
  return errors;
}

const invokedAsScript =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedAsScript) {
  const errors = await checkArchitecture();
  if (errors.length > 0) {
    console.error("Architecture boundary violations:\n");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
  } else {
    console.log("Architecture boundaries are valid.");
  }
}
