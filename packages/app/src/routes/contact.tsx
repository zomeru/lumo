import { createFileRoute } from "@tanstack/react-router";

import { ContactPage } from "../features/public/information-pages";

export const Route = createFileRoute("/contact")({
  component: ContactPage,
});
