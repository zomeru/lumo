import { createFileRoute } from "@tanstack/react-router";

import { LegalPage } from "../features/public/information-pages";

export const Route = createFileRoute("/privacy")({
  component: () => <LegalPage document="privacy" />,
});
