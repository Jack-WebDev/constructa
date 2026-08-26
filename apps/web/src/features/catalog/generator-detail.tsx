import { Badge } from "@constructa/ui/components/badge";
import { Card, CardContent, CardHeader } from "@constructa/ui/components/card";
import { ArrowLeft, ArrowRight, Braces, Sparkles } from "lucide-react";

import { getCatalogEntry } from "./catalog";

export function GeneratorDetail({ typeId }: { readonly typeId: string }) {
  const entry = getCatalogEntry(typeId);

  if (entry === undefined) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
        <section
          aria-labelledby="generator-not-found-title"
          className="rounded-2xl border border-dashed bg-card/50 p-8 text-center"
        >
          <h1 className="font-semibold text-2xl" id="generator-not-found-title">
            Generator not found
          </h1>
          <p className="mt-2 text-muted-foreground">
            No built-in generator is registered for “{typeId}”.
          </p>
          <a
            className="mt-5 inline-flex items-center gap-1 text-primary text-sm hover:underline"
            href="/generators"
          >
            <ArrowLeft className="size-4" /> Browse generators
          </a>
        </section>
      </main>
    );
  }

  const configuration = Object.entries(entry.examples[0] ?? {}).filter(
    ([key]) => key !== "type",
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <a
        className="inline-flex items-center gap-1 text-muted-foreground text-sm transition-colors hover:text-primary"
        href="/generators"
      >
        <ArrowLeft className="size-4" /> Generator library
      </a>
      <section className="mt-5 rounded-2xl border border-border/80 bg-card/70 p-6 shadow-black/5 shadow-xl sm:p-8">
        <Badge className="rounded-full capitalize" variant="secondary">
          {entry.category}
        </Badge>
        <div className="mt-5 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <h1 className="font-semibold text-4xl tracking-[-0.035em] sm:text-5xl">
              {entry.displayName}
            </h1>
            <p className="mt-3 max-w-2xl text-muted-foreground leading-7">
              {entry.description}
            </p>
          </div>
          <a
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 font-medium text-primary-foreground text-xs shadow-lg shadow-primary/15 transition-transform hover:-translate-y-0.5 hover:bg-primary/80"
            href="/quick-generate"
          >
            Try it <ArrowRight className="size-4" />
          </a>
        </div>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <Card className="rounded-2xl border-border/80 bg-card/70 py-0 shadow-black/5 shadow-lg">
          <CardHeader className="border-border/70 border-b px-5 py-4">
            <h2
              className="flex items-center gap-2 font-medium text-base"
              id="output-title"
            >
              <Sparkles className="size-4 text-primary" /> Output
            </h2>
          </CardHeader>
          <CardContent className="p-5">
            <p className="text-muted-foreground text-sm leading-6">
              Produces a value in the {entry.outputCategory} output category.
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/80 bg-card/70 py-0 shadow-black/5 shadow-lg">
          <CardHeader className="border-border/70 border-b px-5 py-4">
            <h2
              className="flex items-center gap-2 font-medium text-base"
              id="configuration-title"
            >
              <Braces className="size-4 text-primary" /> Configuration
            </h2>
          </CardHeader>
          <CardContent className="p-5">
            {configuration.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                This generator has no configuration.
              </p>
            ) : (
              <dl className="grid gap-2">
                {configuration.map(([key, value]) => (
                  <div
                    className="flex items-start justify-between gap-4 rounded-lg bg-muted/50 px-3 py-2.5"
                    key={key}
                  >
                    <dt className="font-mono text-primary text-xs">{key}</dt>
                    <dd className="max-w-[70%] break-all text-right font-mono text-muted-foreground text-xs">
                      {formatExampleValue(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-5 rounded-2xl border-border/80 bg-card/70 py-0 shadow-black/5 shadow-lg">
        <CardHeader className="border-border/70 border-b px-5 py-4">
          <h2 className="font-medium text-base" id="examples-title">
            Examples
          </h2>
        </CardHeader>
        <CardContent className="p-5">
          {entry.examples.map((example, index) => (
            <pre
              className="overflow-auto rounded-xl border border-border/70 bg-background/45 p-4 text-xs leading-6 sm:text-sm"
              key={index}
            >
              <code>{JSON.stringify(example, null, 2)}</code>
            </pre>
          ))}
        </CardContent>
      </Card>

      <section className="mt-5 rounded-xl border border-border/60 bg-muted/35 px-4 py-3">
        <h2 className="font-medium text-sm" id="errors-title">
          Validation errors
        </h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Invalid definitions are rejected by the shared parser with a stable
          error kind, code, and path.
        </p>
      </section>
    </main>
  );
}

function formatExampleValue(value: unknown): string {
  return JSON.stringify(value) ?? "undefined";
}
