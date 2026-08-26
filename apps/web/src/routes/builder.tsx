import { createFileRoute } from "@tanstack/react-router";

import { BuilderShell } from "../features/builder/builder-shell";

export const Route = createFileRoute("/builder")({
  component: BuilderShell,
});
