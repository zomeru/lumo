import { createFileRoute } from "@tanstack/react-router";

import { hrSearchSchema } from "../features/hr/hr-search";
import { OnboardingPage } from "../features/hr/onboarding-page";
export const Route = createFileRoute("/_authenticated/w/$workspaceId/hr-onboarding")({
  validateSearch: hrSearchSchema,
  component: function Page() {
    const { workspaceId } = Route.useParams();
    return <OnboardingPage workspaceId={workspaceId} />;
  },
});
