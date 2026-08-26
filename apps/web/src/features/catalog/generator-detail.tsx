import { getCatalogEntry } from "./catalog";

export function GeneratorDetail({ typeId }: { readonly typeId: string }) {
  const entry = getCatalogEntry(typeId);

  if (entry === undefined) {
    return (
      <main className="container mx-auto max-w-3xl px-6 py-12">
        <section
          aria-labelledby="generator-not-found-title"
          className="rounded-lg border border-dashed p-6"
        >
          <h1 className="font-semibold text-2xl" id="generator-not-found-title">
            Generator not found
          </h1>
          <p className="mt-2 text-muted-foreground">
            No built-in generator is registered for “{typeId}”.
          </p>
          <a className="mt-4 inline-block underline" href="/generators">
            Browse generators
          </a>
        </section>
      </main>
    );
  }

  const configuration = Object.entries(entry.examples[0] ?? {}).filter(
    ([key]) => key !== "type",
  );

  return (
    <main className="container mx-auto max-w-3xl space-y-8 px-6 py-12">
      <div className="space-y-3">
        <a
          className="text-muted-foreground text-sm underline"
          href="/generators"
        >
          Browse generators
        </a>
        <p className="font-medium text-muted-foreground uppercase tracking-wider">
          {entry.category}
        </p>
        <h1 className="font-semibold text-4xl tracking-tight">
          {entry.displayName}
        </h1>
        <p className="text-lg text-muted-foreground">{entry.description}</p>
      </div>

      <section aria-labelledby="output-title">
        <h2 className="font-medium text-lg" id="output-title">
          Output
        </h2>
        <p className="mt-2 text-muted-foreground">
          Produces a value in the {entry.outputCategory} output category.
        </p>
      </section>

      <section aria-labelledby="configuration-title">
        <h2 className="font-medium text-lg" id="configuration-title">
          Configuration
        </h2>
        {configuration.length === 0 ? (
          <p className="mt-2 text-muted-foreground">
            This generator has no configuration.
          </p>
        ) : (
          <dl className="mt-2 grid gap-2 rounded-lg border p-4">
            {configuration.map(([key, value]) => (
              <div className="flex items-start justify-between gap-4" key={key}>
                <dt className="font-mono text-sm">{key}</dt>
                <dd className="max-w-[70%] break-all text-muted-foreground text-sm">
                  {formatExampleValue(value)}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <section aria-labelledby="examples-title">
        <h2 className="font-medium text-lg" id="examples-title">
          Examples
        </h2>
        {entry.examples.map((example, index) => (
          <pre
            className="mt-2 overflow-auto rounded-lg bg-muted p-4 text-sm"
            key={index}
          >
            <code>{JSON.stringify(example, null, 2)}</code>
          </pre>
        ))}
      </section>

      <section aria-labelledby="errors-title">
        <h2 className="font-medium text-lg" id="errors-title">
          Validation errors
        </h2>
        <p className="mt-2 text-muted-foreground">
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
