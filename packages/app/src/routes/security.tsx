import { createFileRoute } from "@tanstack/react-router";

import { SecurityPage } from "../features/public/information-pages";

export const Route = createFileRoute("/security")({
  component: SecurityPage,
});
