import { createFileRoute } from "@tanstack/react-router";

import { CookiePage } from "../features/public/information-pages";

export const Route = createFileRoute("/cookies")({
  component: CookiePage,
});
