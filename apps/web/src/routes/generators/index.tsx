import { createFileRoute } from "@tanstack/react-router";

import { GeneratorCatalog } from "../../features/catalog/generator-catalog";

export const Route = createFileRoute("/generators/")({
  component: GeneratorCatalog,
});
