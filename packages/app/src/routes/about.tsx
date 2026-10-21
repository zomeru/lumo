import { createFileRoute } from "@tanstack/react-router";

import { AboutPage } from "../features/public/information-pages";

export const Route = createFileRoute("/about")({
  component: AboutPage,
});
