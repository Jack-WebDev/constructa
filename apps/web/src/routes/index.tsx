import { createFileRoute } from "@tanstack/react-router";

import { Homepage } from "../features/homepage/homepage";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

function HomeComponent() {
  return <Homepage />;
}
