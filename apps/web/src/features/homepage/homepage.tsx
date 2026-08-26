import { Button } from "@constructa/ui/components/button";
import {
  boolean,
  choice,
  generate,
  integer,
  object,
  uuid,
} from "constructa-sdk";

const EMPLOYEE_DEFINITION = object({
  id: uuid(),
  employeeNumber: integer({ min: 1000, max: 9999 }),
  role: choice(["Engineer", "Designer", "Product manager"]),
  active: boolean(),
});

const EMPLOYEE_PREVIEW = generate(EMPLOYEE_DEFINITION, { seed: "homepage" });

const COMPOSITION_STEPS = [
  { label: "UUID", value: "id" },
  { label: "Integer", value: "employeeNumber" },
  { label: "Choice", value: "role" },
  { label: "Boolean", value: "active" },
] as const;

export function Homepage() {
  return (
    <main className="container mx-auto max-w-6xl px-6 py-12 sm:py-20">
      <section
        aria-labelledby="homepage-title"
        className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]"
      >
        <div className="space-y-6">
          <p className="font-medium text-muted-foreground uppercase tracking-wider">
            Constructa
          </p>
          <div className="space-y-4">
            <h1
              className="font-semibold text-4xl tracking-tight sm:text-5xl"
              id="homepage-title"
            >
              Generate what you need.
            </h1>
            <p className="max-w-2xl text-lg text-muted-foreground leading-8">
              Build reusable data generators from simple building blocks. Define
              them once, compose them into structured data, and run the same
              definition wherever you need it.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button render={<a href="/builder" />} size="lg">
              Start Building
            </Button>
            <Button
              render={<a href="/quick-generate" />}
              size="lg"
              variant="outline"
            >
              Quick Generate
            </Button>
          </div>
        </div>

        <CompositionDemo />
      </section>

      <section className="mt-20 grid gap-4 md:grid-cols-3">
        <ValueProposition
          description="Start with portable definitions for the values your application needs."
          title="Configure"
        />
        <ValueProposition
          description="Combine primitives into objects and arrays that match your domain."
          title="Compose"
        />
        <ValueProposition
          description="Use one definition consistently in the web app, SDK, API, or CLI."
          title="Reuse"
        />
      </section>
    </main>
  );
}

function CompositionDemo() {
  return (
    <section
      aria-labelledby="composition-demo-title"
      className="rounded-lg border bg-muted/30 p-6 shadow-sm"
    >
      <div className="space-y-2">
        <p className="font-medium text-muted-foreground text-sm uppercase tracking-wider">
          Compose primitives
        </p>
        <h2 className="font-semibold text-2xl" id="composition-demo-title">
          Employee generator
        </h2>
        <p className="text-muted-foreground text-sm">
          Small generators become a structured, reusable object.
        </p>
      </div>

      <ol
        aria-label="Primitive generators"
        className="mt-6 grid gap-2 sm:grid-cols-2"
      >
        {COMPOSITION_STEPS.map((step) => (
          <li
            className="flex items-center justify-between rounded border bg-background px-3 py-2 text-sm"
            key={step.value}
          >
            <span className="font-medium">{step.label}</span>
            <code className="text-muted-foreground">{step.value}</code>
          </li>
        ))}
      </ol>

      <div
        aria-hidden="true"
        className="my-5 text-center text-2xl text-muted-foreground"
      >
        ↓
      </div>

      <div className="rounded border bg-background p-4">
        <p className="font-medium text-sm">Generated employee</p>
        <pre className="mt-3 overflow-x-auto text-muted-foreground text-sm">
          {JSON.stringify(EMPLOYEE_PREVIEW, null, 2)}
        </pre>
      </div>
    </section>
  );
}

function ValueProposition({
  description,
  title,
}: {
  readonly description: string;
  readonly title: string;
}) {
  return (
    <article className="rounded-lg border p-5">
      <h2 className="font-medium">{title}</h2>
      <p className="mt-2 text-muted-foreground text-sm">{description}</p>
    </article>
  );
}
