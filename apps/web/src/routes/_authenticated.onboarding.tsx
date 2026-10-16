import { createFileRoute } from "@tanstack/react-router";

import { OnboardingPage } from "@/features/workspaces/onboarding-page";
export const Route = createFileRoute("/_authenticated/onboarding")({ component: OnboardingPage });
