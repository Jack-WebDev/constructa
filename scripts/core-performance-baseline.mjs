import { createExecutor, createRegistry } from "../packages/core/dist/index.js";
import {
  choice,
  integer,
  object,
  registerChoiceGenerator,
  registerIntegerGenerator,
  registerObjectGenerator,
  registerTemplateGenerator,
  template,
} from "../packages/generators/dist/index.js";

const argument = process.argv.find((value) =>
  value.startsWith("--iterations="),
);
const iterations = Number(argument?.slice("--iterations=".length) ?? 10_000);
if (!Number.isSafeInteger(iterations) || iterations < 1) {
  throw new TypeError("--iterations must be a positive safe integer.");
}

const registry = createRegistry();
registerIntegerGenerator(registry);
registerChoiceGenerator(registry);
registerObjectGenerator(registry);
registerTemplateGenerator(registry);
const executor = createExecutor(registry);
const cases = {
  primitive: integer({ min: 1, max: 100 }),
  composite: object({
    id: integer({ min: 1, max: 100 }),
    role: choice(["admin", "member"]),
  }),
  reference: object({
    label: template("{name}-{name}"),
    name: choice(["Ada", "Lin"]),
  }),
};

const results = Object.entries(cases).map(([name, definition]) => {
  const beforeHeap = process.memoryUsage().heapUsed;
  const started = process.hrtime.bigint();
  for (let index = 0; index < iterations; index += 1) {
    executor.generate(definition, { seed: index });
  }
  const elapsedNanoseconds = Number(process.hrtime.bigint() - started);
  return {
    name,
    iterations,
    elapsedNanoseconds,
    nanosecondsPerOperation: Math.round(elapsedNanoseconds / iterations),
    heapDeltaBytes: process.memoryUsage().heapUsed - beforeHeap,
  };
});

process.stdout.write(
  `${JSON.stringify(
    {
      format: "constructa-core-performance-baseline/v1",
      node: process.version,
      iterations,
      results,
    },
    null,
    2,
  )}\n`,
);
