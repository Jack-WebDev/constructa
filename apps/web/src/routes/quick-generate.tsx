import { createFileRoute } from "@tanstack/react-router";

import { QuickGenerateShell } from "../features/quick-generate/quick-generate-shell";

export const Route = createFileRoute("/quick-generate")({
  component: QuickGenerateRoute,
});

function QuickGenerateRoute() {
  return <QuickGenerateShell />;
}
