import { createFileRoute } from "@tanstack/react-router";

import { GeneratorDetail } from "../../features/catalog/generator-detail";

export const Route = createFileRoute("/generators/$typeId")({
  component: GeneratorDetailRoute,
});

function GeneratorDetailRoute() {
  const { typeId } = Route.useParams();
  return <GeneratorDetail typeId={typeId} />;
}
