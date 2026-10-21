import { createFileRoute } from "@tanstack/react-router";

import { OnboardingPage } from "../features/hr/onboarding-page";
export const Route = createFileRoute("/_authenticated/w/$workspaceId/hr-onboarding")({
  component: function Page() {
    const { workspaceId } = Route.useParams();
    return <OnboardingPage workspaceId={workspaceId} />;
  },
});
