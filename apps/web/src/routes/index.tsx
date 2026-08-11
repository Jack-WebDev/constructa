import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

function HomeComponent() {
  return (
    <main className="container mx-auto flex max-w-4xl flex-col gap-8 px-6 py-20">
      <div className="max-w-3xl space-y-5">
        <p className="font-medium text-muted-foreground uppercase tracking-wider">
          Constructa
        </p>
        <h1 className="font-semibold text-5xl tracking-tight">
          Build the generator you need.
        </h1>
        <p className="text-lg text-muted-foreground leading-8">
          Constructa is an open-source platform for combining small generators
          into reusable, structured data generators.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-lg border p-5">
          <h2 className="font-medium">Configure</h2>
          <p className="mt-2 text-muted-foreground text-sm">
            Describe generators with portable, serializable definitions.
          </p>
        </article>
        <article className="rounded-lg border p-5">
          <h2 className="font-medium">Compose</h2>
          <p className="mt-2 text-muted-foreground text-sm">
            Combine primitive generators into objects, arrays, and templates.
          </p>
        </article>
        <article className="rounded-lg border p-5">
          <h2 className="font-medium">Reuse</h2>
          <p className="mt-2 text-muted-foreground text-sm">
            Run the same definition through the web, library, API, or CLI.
          </p>
        </article>
      </section>
    </main>
  );
}
