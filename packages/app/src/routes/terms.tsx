import { createFileRoute } from "@tanstack/react-router";

import { LegalPage } from "../features/public/information-pages";

export const Route = createFileRoute("/terms")({
  component: () => <LegalPage document="terms" />,
});
