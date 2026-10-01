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
  BookOpen,
  Box,
  Braces,
  CalendarDays,
  Code2,
  Copy,
  Eye,
  Hash,
  Hexagon,
  Layers3,
  MoreHorizontal,
  Play,
  Plus,
  Settings2,
  ShieldCheck,
  ToggleRight,
  Type,
  UsersRound,
  Zap,
} from "lucide-react";
import { useState } from "react";

const EMPLOYEE_DEFINITION = object({
  id: uuid(),
  employeeNumber: integer({ min: 1000, max: 9999 }),
  role: choice(["Engineer", "Designer", "Product manager"]),
  active: boolean(),
});

const EMPLOYEE_PREVIEW = generate(EMPLOYEE_DEFINITION, { seed: "homepage" });

const EMPLOYEE_OUTPUT = JSON.stringify(
  {
    ...EMPLOYEE_PREVIEW,
    startDate: "2024-05-12",
    department: "Product",
  },
  null,
  2,
);

const COMPOSITION_FIELDS = [
  { icon: Hexagon, name: "id", type: "Integer" },
  { icon: Hash, name: "employeeNumber", type: "String" },
  { icon: Blocks, name: "role", type: "Choice" },
  { icon: ToggleRight, name: "isActive", type: "Boolean" },
  { icon: CalendarDays, name: "startDate", type: "Date" },
  { icon: Type, name: "department", type: "String" },
] as const;

const BENEFITS = [
  {
    icon: Zap,
    title: "No login required",
    description: "Get started instantly",
  },
  { icon: ShieldCheck, title: "Open source", description: "Build and extend" },
  { icon: Box, title: "Works anywhere", description: "Web app and SDK" },
] as const;

const FEATURES = [
  {
    icon: Box,
    title: "Generate test data",
    description:
      "Create realistic, customised data for testing and development.",
    action: "Explore examples",
    href: "/quick-generate",
  },
  {
    icon: Code2,
    title: "Power it by design",
    description:
      "Define rich schemas and reuse them across projects and workflows.",
    action: "Learn how",
    href: "/builder",
  },
  {
    icon: Layers3,
    title: "Extend to more",
    description:
      "Build generators for your domain and keep dependable definitions close.",
    action: "Browse library",
    href: "/generators",
  },
] as const;

const CAPABILITIES = [
  [Braces, "Developer friendly"],
  [Layers3, "Type safe"],
  [Settings2, "Extensible"],
  [UsersRound, "Reusable"],
  [BookOpen, "Great documentation"],
] as const;

export function Homepage() {
  return (
    <main className="app-page overflow-hidden bg-background text-foreground">
      <Hero />
      <WorkflowSection />
    </main>
  );
}

function Hero() {
  return (
    <section
      aria-labelledby="homepage-title"
      className="relative isolate min-h-[480px] overflow-hidden border-border/60 border-b"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 bg-center bg-cover"
        style={{
          backgroundImage:
            'url("/Minimal%20Beige%20Botanical%20Still%20Life.png")',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 bg-background/35"
      />

      <div className="relative z-10 mx-auto grid max-w-[1050px] items-start gap-12 px-5 py-12 sm:px-8 sm:py-16 lg:min-h-[480px] lg:translate-x-12 lg:grid-cols-[400px_594px] lg:gap-14 lg:px-0 lg:py-0">
        <div className="max-w-xl lg:pt-10">
          <Badge className="rounded-full border-0 bg-secondary/85 px-4 py-1.5 font-medium text-[10px] text-secondary-foreground uppercase tracking-[0.18em]">
            Open source <span aria-hidden="true">•</span> Type safe{" "}
            <span aria-hidden="true">•</span> Customisable
          </Badge>

          <h1
            id="homepage-title"
            className="mt-7 font-serif text-5xl leading-[0.94] tracking-[-0.055em] sm:text-6xl lg:text-[4rem]"
          >
            Generate
            <br />
            what <em className="font-normal text-primary">you</em> need.
          </h1>

          <p className="mt-6 max-w-[30rem] text-base text-muted-foreground leading-7 sm:text-lg sm:leading-7">
            Build reusable generators for fixtures, test data, and product
            workflows — then produce dependable data whenever you need it.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              render={<a href="/builder" />}
              size="lg"
              className="h-12 rounded-xl px-7 text-sm shadow-lg shadow-primary/20 hover:bg-primary-hover"
            >
              Start building <ArrowRight className="size-4" />
            </Button>
            <Button
              render={<a href="/quick-generate" />}
              size="lg"
              variant="outline"
              className="h-12 rounded-xl border-border/90 bg-card/75 px-7 text-foreground text-sm shadow-sm hover:bg-card"
            >
              <Play className="size-3.5" /> Quick generate
            </Button>
          </div>

          <ul className="mt-8 grid gap-4 text-left sm:grid-cols-3 sm:gap-3">
            {BENEFITS.map(({ description, icon: Icon, title }) => (
              <li className="flex items-center gap-2.5" key={title}>
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
                  <Icon aria-hidden="true" className="size-3.5" />
                </span>
                <span className="min-w-0">
                  <span className="block whitespace-nowrap font-semibold text-[11px]">
                    {title}
                  </span>
                  <span className="block whitespace-nowrap text-[10px] text-muted-foreground">
                    {description}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <CompositionDemo />
      </div>
    </section>
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
    <section aria-labelledby="composition-demo-title" className="w-full">
      <Card className="overflow-hidden rounded-[18px] border-border/85 bg-card/95 py-0 shadow-foreground/10 shadow-xl">
        <CardHeader className="border-border/75 border-b px-5 py-5 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-semibold text-[10px] text-secondary-foreground uppercase tracking-[0.18em]">
                Compose primitives
              </p>
              <CardTitle
                className="mt-1 font-serif text-2xl tracking-[-0.03em] sm:text-[1.65rem]"
                id="composition-demo-title"
              >
                Employee generator
              </CardTitle>
            </div>
            <div className="hidden shrink-0 items-center gap-2 sm:flex">
              <span className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-muted/55 px-3 text-xs">
                <Braces aria-hidden="true" className="size-3.5" /> JSON
              </span>
              <span className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-muted/55 px-3 text-xs">
                <Eye aria-hidden="true" className="size-3.5" /> Preview
              </span>
            </div>
          </div>
          <CardDescription className="mt-1.5 max-w-lg text-muted-foreground text-sm">
            Small, focused generators become a structured reusable object.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-5 sm:p-6">
          <ol
            aria-label="Employee generator fields"
            className="grid gap-2 sm:grid-cols-2"
          >
            {COMPOSITION_FIELDS.map(({ icon: Icon, name, type }) => (
              <li
                className="flex h-10 items-center gap-2.5 rounded-lg border border-border/80 bg-muted/55 px-3"
                key={name}
              >
                <span className="grid size-5 place-items-center rounded-md bg-accent text-accent-foreground">
                  <Icon aria-hidden="true" className="size-3" />
                </span>
                <span className="min-w-0 flex-1 truncate text-[11px] text-foreground">
                  {name}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {type}
                </span>
                <MoreHorizontal
                  aria-hidden="true"
                  className="size-3.5 shrink-0 text-foreground"
                />
              </li>
            ))}
          </ol>

          <a
            className="mt-3 flex h-10 items-center justify-center gap-2 rounded-lg border border-primary/50 border-dashed font-medium text-primary text-xs hover:bg-primary/8"
            href="/builder"
          >
            <Plus aria-hidden="true" className="size-3.5" /> Add field
          </a>

          <div className="mt-3 rounded-xl bg-muted/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-[10px] text-secondary-foreground uppercase tracking-[0.16em]">
                Generated employee
              </p>
              <button
                aria-describedby="copy-status"
                className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-[10px] text-foreground shadow-sm hover:bg-secondary"
                onClick={copyPreview}
                type="button"
              >
                <Copy aria-hidden="true" className="size-3" />
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
            <JsonPreview />
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function JsonPreview() {
  return (
    <pre className="mt-3 overflow-x-auto font-mono text-[11px] leading-5 sm:text-xs">
      {EMPLOYEE_OUTPUT.split("\n").map((line, index) => (
        <span className="block min-w-max" key={`${index}-${line}`}>
          <span
            aria-hidden="true"
            className="mr-4 inline-block w-2 text-right text-muted-foreground/65"
          >
            {index + 1}
          </span>
          <JsonLine line={line} />
        </span>
      ))}
    </pre>
  );
}

function JsonLine({ line }: { readonly line: string }) {
  const match = /^(\s*)("[^"]+")(\s*:\s*)(.+?)(,?)$/.exec(line);
  if (match === null) return <>{line}</>;

  const [, indentation, key, separator, value, trailingComma] = match;
  const valueClassName = value.startsWith('"')
    ? "text-[#2f7161]"
    : value === "true" || value === "false" || value === "null"
      ? "text-[#745aa3]"
      : "text-[#2f78ae]";

  return (
    <>
      {indentation}
      <span className="text-[#b54d38]">{key}</span>
      <span className="text-foreground/75">{separator}</span>
      <span className={valueClassName}>{value}</span>
      <span className="text-foreground/75">{trailingComma}</span>
    </>
  );
}

function WorkflowSection() {
  return (
    <section className="relative bg-background px-5 pt-4 pb-3 sm:px-8 lg:px-0">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(ellipse_at_50%_0%,color-mix(in_srgb,var(--accent)_40%,transparent),transparent_70%)]"
      />
      <div className="relative mx-auto max-w-[1000px]">
        <header className="mx-auto max-w-2xl text-center">
          <p className="font-semibold text-[10px] text-secondary-foreground uppercase tracking-[0.2em]">
            A generator for every need
          </p>
          <h2 className="mt-2 font-serif text-3xl tracking-[-0.04em] sm:text-4xl">
            From idea to{" "}
            <em className="font-normal text-primary">useful data.</em>
          </h2>
          <p className="mt-2 text-muted-foreground text-sm leading-6">
            Create, customise and generate data for any context. Keep it simple
            or build something advanced.
          </p>
        </header>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {FEATURES.map(({ action, description, href, icon: Icon, title }) => (
            <Card
              className="group min-h-[124px] rounded-xl border-border/80 bg-card/90 py-0 shadow-foreground/5 shadow-lg transition-[border-color,box-shadow] hover:border-primary/35 hover:shadow-foreground/8 hover:shadow-xl"
              key={title}
            >
              <CardHeader className="grid h-full grid-cols-[44px_1fr] gap-3 p-4">
                <span className="grid size-11 place-items-center rounded-full bg-accent text-accent-foreground">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <div className="flex min-w-0 flex-col">
                  <CardTitle className="font-serif text-[15px] tracking-[-0.02em]">
                    {title}
                  </CardTitle>
                  <CardDescription className="mt-2 max-w-xs text-[10px] text-muted-foreground leading-3.5">
                    {description}
                  </CardDescription>
                  <a
                    className="mt-auto inline-flex items-center gap-1.5 pt-2 font-semibold text-[9px] text-primary uppercase tracking-wide group-hover:gap-2.5"
                    href={href}
                  >
                    {action}{" "}
                    <ArrowRight aria-hidden="true" className="size-3" />
                  </a>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>

        <Capabilities />
      </div>
    </section>
  );
}

function Capabilities() {
  return (
    <section className="mt-3 overflow-hidden rounded-xl bg-chart-2 text-primary-foreground shadow-chart-2/15 shadow-lg">
      <div className="grid md:grid-cols-[215px_1fr]">
        <div className="border-background/20 px-5 py-3 md:border-r">
          <h2 className="font-serif text-lg tracking-[-0.02em]">
            Built for modern teams
          </h2>
          <p className="mt-0.5 max-w-44 text-[10px] text-primary-foreground/80 leading-3">
            From local development to real-world use.
          </p>
        </div>
        <ul className="grid grid-cols-2 sm:grid-cols-5">
          {CAPABILITIES.map(([Icon, label]) => (
            <li
              className="flex min-h-18 items-center justify-center gap-2 border-background/20 px-2 text-center text-[10px] text-primary-foreground/90 [&:not(:last-child)]:border-r"
              key={label}
            >
              <Icon
                aria-hidden="true"
                className="size-4 shrink-0 text-accent"
              />
              <span>{label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
