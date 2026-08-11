import type { UserConfig } from "tsdown";

export const libraryConfig = {
  clean: true,
  deps: {
    neverBundle: true,
  },
  dts: {
    sourcemap: true,
  },
  entry: ["src/index.ts"],
  failOnWarn: true,
  format: ["esm"],
  platform: "neutral",
  publint: true,
  sourcemap: true,
  target: "es2022",
} satisfies UserConfig;

export const cliConfig = {
  ...libraryConfig,
  dts: false,
  fixedExtension: false,
  platform: "node",
  target: "node22",
} satisfies UserConfig;
