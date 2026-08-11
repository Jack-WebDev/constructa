import { defineConfig } from "vitest/config";

const testFilePattern = "src/**/*.{test,spec}.{ts,tsx}";

export default defineConfig({
  test: {
    clearMocks: true,
    passWithNoTests: true,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage",
      reporter: ["text", "json-summary", "html"],
      include: [
        "apps/{api,cli,web}/src/**/*.{ts,tsx}",
        "packages/{core,env,exporters,generators,schema,sdk,ui}/src/**/*.{ts,tsx}",
      ],
      exclude: [
        "**/*.{test,spec}.{ts,tsx}",
        "**/*.d.ts",
        "**/routeTree.gen.ts",
      ],
    },
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: [
            `apps/{api,cli}/${testFilePattern}`,
            `packages/{core,env,exporters,generators,schema,sdk}/${testFilePattern}`,
            "scripts/**/*.{test,spec}.{js,mjs,ts}",
          ],
        },
      },
      {
        extends: true,
        test: {
          name: "web",
          environment: "jsdom",
          include: [
            `apps/web/${testFilePattern}`,
            `packages/ui/${testFilePattern}`,
          ],
        },
      },
    ],
  },
});
