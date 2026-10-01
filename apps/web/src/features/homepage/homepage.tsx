import { Badge } from "@constructa/ui/components/badge";
import { Button } from "@constructa/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@constructa/ui/components/card";
import {
  boolean,
  choice,
  generate,
  integer,
  object,
  uuid,
} from "constructa-sdk";
import {
  ArrowRight,
  Blocks,
  Braces,
  Check,
  Code2,
  Database,
  Eye,
  FlaskConical,
  Globe2,
  Layers3,
  Leaf,
  Play,
  Plus,
  TerminalSquare,
} from "lucide-react";
import { useState } from "react";

const EMPLOYEE_DEFINITION = object({
  id: uuid(),
  employeeNumber: integer({ min: 1000, max: 9999 }),
  role: choice(["Engineer", "Designer", "Product manager"]),
  active: boolean(),
});

const EMPLOYEE_PREVIEW = generate(EMPLOYEE_DEFINITION, {
  seed: "homepage",
});

const EMPLOYEE_OUTPUT = JSON.stringify(
  {
    ...EMPLOYEE_PREVIEW,
    joinDate: "2024-05-12",
    department: "Product",
  },
  null,
  2,
);

const COMPOSITION_STEPS = [
  { label: "UUID", value: "id" },
  { label: "Integer", value: "employeeNumber" },
  { label: "Choice", value: "role" },
  { label: "Boolean", value: "active" },
  { label: "Date", value: "joinDate" },
  { label: "String", value: "department" },
] as const;

const FEATURES = [
  {
    icon: Blocks,
    title: "Compose visually",
    description:
      "Start with a blank generator and add only the fields you need.",
    action: "Open builder",
    href: "/builder",
  },
  {
    icon: Braces,
    title: "Portable by design",
    description:
      "Choose a built-in generator, understand its options, and reuse it anywhere.",
    action: "Browse generators",
    href: "/generators",
  },
  {
    icon: Layers3,
    title: "Ready to reuse",
    description:
      "Generate a sample value before you add it to a larger definition.",
    action: "Browse generators",
    href: "/generators",
  },
] as const;

const CAPABILITIES = [
  [Globe2, "Web app"],
  [Braces, "SDK"],
  [Code2, "API"],
  [TerminalSquare, "CLI"],
  [FlaskConical, "Tests"],
  [Database, "Data pipelines"],
] as const;

export function Homepage() {
  return (
    <main className="app-page min-h-screen overflow-hidden bg-background text-foreground">
      <section
        aria-labelledby="homepage-title"
        className="relative border-border border-b"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,color-mix(in_srgb,var(--primary)_6%,transparent),transparent_30%),radial-gradient(circle_at_80%_30%,color-mix(in_srgb,var(--chart-2)_6%,transparent),transparent_32%)]" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16 lg:py-24">
          <div className="fade-in slide-in-from-bottom-4 animate-in duration-700">
            <Badge
              variant="outline"
              className="rounded-full border-border/70 bg-secondary px-3 py-1 text-secondary-foreground"
            >
              <Leaf className="size-3" />
              Composed. Typed. Reliable.
            </Badge>

            <div className="mt-8 max-w-xl">
              <h1
                aria-label="Generate what you need."
                id="homepage-title"
                className="font-serif text-5xl leading-[0.98] tracking-[-0.045em] sm:text-6xl lg:text-[4.8rem]"
              >
                Generate
                <br />
                what{" "}
                <span className="relative inline-block font-normal text-primary italic">
                  you
                  <svg
                    aria-hidden="true"
                    className="absolute -bottom-3 left-0 h-3 w-full"
                    viewBox="0 0 160 14"
                    preserveAspectRatio="none"
                  >
                    <path
                      d="M3 10C48 2 106 2 157 8"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeWidth="3"
                    />
                  </svg>
                </span>{" "}
                need.
              </h1>

              <p className="mt-7 max-w-lg text-base text-muted-foreground leading-7 sm:text-lg sm:leading-8">
                Build reusable generators for fixtures, test data, and product
                workflows—then produce dependable data whenever you need it.
              </p>
            </div>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button
                render={<a href="/builder" />}
                size="lg"
                className="h-12 rounded-xl border-primary px-7 text-sm shadow-lg shadow-primary/15 hover:bg-primary-hover"
              >
                Start Building
                <ArrowRight className="size-4" />
              </Button>

              <Button
                render={<a href="/quick-generate" />}
                size="lg"
                variant="outline"
                className="h-12 rounded-xl border-border bg-card/70 px-7 text-foreground text-sm hover:bg-secondary"
              >
                <Play className="size-4" />
                Quick Generate
              </Button>
            </div>

            <div className="mt-9 flex flex-wrap gap-x-7 gap-y-3 text-muted-foreground text-xs">
              {[
                "Start with built-in generators",
                "Keep definitions portable",
                "Catch invalid settings early",
              ].map((item) => (
                <span key={item} className="flex items-center gap-2">
                  <span className="grid size-4 place-items-center rounded-full border border-success/70">
                    <Check className="size-2.5 text-success" />
                  </span>
                  {item}
                </span>
              ))}
            </div>
          </div>

          <CompositionDemo />
        </div>
      </section>

      <section className="relative">
        <div className="pointer-events-none absolute inset-0 bg-muted/70" />

        <div className="relative mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
          <div className="mb-7 text-center">
            <p className="font-semibold text-[11px] text-success uppercase tracking-[0.18em]">
              <Check className="mr-1 inline size-3" />
              One clear workflow
            </p>

            <h2 className="mt-2 font-serif text-3xl tracking-[-0.035em] sm:text-4xl">
              From idea to{" "}
              <em className="font-normal text-primary">useful data.</em>
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {FEATURES.map(
              ({ action, description, href, icon: Icon, title }) => (
                <Card
                  key={title}
                  className="app-interactive-card group rounded-2xl border border-border bg-card/85 py-0 shadow-foreground/5 shadow-lg"
                >
                  <CardHeader className="p-6">
                    <span className="mb-5 grid size-12 place-items-center rounded-full bg-accent text-accent-foreground">
                      <Icon className="size-5" />
                    </span>

                    <CardTitle className="text-base text-card-foreground">
                      {title}
                    </CardTitle>

                    <CardDescription className="mt-1 max-w-xs text-muted-foreground text-sm leading-6">
                      {description}
                    </CardDescription>

                    <a
                      href={href}
                      className="mt-4 inline-flex items-center gap-1.5 font-medium text-primary text-xs transition group-hover:gap-2.5"
                    >
                      {action}
                      <ArrowRight className="size-3.5" />
                    </a>
                  </CardHeader>
                </Card>
              ),
            )}
          </div>

          <Capabilities />
        </div>
      </section>
    </main>
  );
}

function CompositionDemo() {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">(
    "idle",
  );

  async function copyPreview() {
    try {
      await navigator.clipboard.writeText(EMPLOYEE_OUTPUT);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }
  }

  return (
    <section
      aria-labelledby="composition-demo-title"
      className="fade-in zoom-in-95 relative animate-in duration-700 lg:delay-150"
    >
      <div className="absolute -inset-8 -z-10 rounded-4xl bg-chart-4/15 blur-3xl" />

      <Card className="overflow-hidden rounded-2xl border border-border bg-card/95 py-0 shadow-2xl shadow-foreground/15">
        <CardHeader className="border-border/80 border-b px-5 py-5 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold text-[11px] text-success uppercase tracking-[0.18em]">
                Compose primitives
              </p>

              <h2
                id="composition-demo-title"
                className="mt-1 font-serif text-2xl tracking-[-0.02em]"
              >
                Employee generator
              </h2>
            </div>

            <div className="hidden items-center gap-2 sm:flex">
              <span className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-muted/60 px-3 text-xs">
                <Braces className="size-3.5" />
                JSON
              </span>

              <span className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-muted/60 px-3 text-xs">
                <Eye className="size-3.5" />
                Preview
              </span>
            </div>
          </div>

          <CardDescription className="text-muted-foreground text-sm">
            Small, focused generators become a structured reusable object.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-5 sm:p-6">
          <ol
            aria-label="Primitive generators"
            className="grid gap-2 sm:grid-cols-2"
          >
            {COMPOSITION_STEPS.map((step, index) => (
              <li
                key={step.value}
                className="flex items-center gap-3 rounded-lg border border-border/80 bg-muted/60 px-3 py-2.5"
              >
                <span className="grid size-5 place-items-center rounded-full bg-secondary font-semibold text-[10px] text-secondary-foreground">
                  {index + 1}
                </span>

                <span className="font-medium text-sm">{step.label}</span>

                <code className="ml-auto text-muted-foreground text-xs">
                  {step.value}
                </code>
              </li>
            ))}
          </ol>

          <a
            href="/builder"
            className="mt-3 flex h-10 items-center justify-center gap-2 rounded-lg border border-primary/60 border-dashed font-medium text-primary text-xs transition hover:bg-primary/10"
          >
            <Plus className="size-3.5" />
            Add field
          </a>

          <div className="mt-4 rounded-xl border border-border bg-muted p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-success text-xs">
                GENERATED EMPLOYEE
              </p>

              <button
                type="button"
                aria-describedby="copy-status"
                className="rounded-md border border-border bg-card px-2.5 py-1 text-[10px] text-muted-foreground transition hover:bg-secondary"
                onClick={copyPreview}
              >
                {copyStatus === "copied" ? "Copied" : "Copy JSON"}
              </button>
            </div>

            <p
              aria-live="polite"
              className="sr-only"
              id="copy-status"
              role="status"
            >
              {copyStatus === "copied"
                ? "Employee JSON copied to clipboard."
                : copyStatus === "error"
                  ? "Unable to copy employee JSON."
                  : ""}
            </p>

            <pre className="mt-3 overflow-x-auto text-foreground/80 text-xs leading-5 sm:text-sm">
              {EMPLOYEE_OUTPUT}
            </pre>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function Capabilities() {
  return (
    <section className="mt-5 overflow-hidden rounded-2xl bg-chart-2 text-primary-foreground shadow-chart-2/20 shadow-xl">
      <div className="grid md:grid-cols-[260px_1fr]">
        <div className="border-background/25 px-6 py-5 md:border-r">
          <h2 className="font-serif text-xl">Built for modern teams</h2>

          <p className="mt-1 max-w-48 text-primary-foreground/75 text-xs leading-5">
            Use Constructa everywhere your data flows.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          {CAPABILITIES.map(([Icon, label]) => (
            <div
              key={label}
              className="flex min-h-20 items-center justify-center gap-2 border-background/20 px-4 text-primary-foreground/90 text-xs [&:not(:last-child)]:border-r"
            >
              <Icon className="size-5 text-accent" />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
