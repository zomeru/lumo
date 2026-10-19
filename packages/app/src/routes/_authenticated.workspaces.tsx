import { createFileRoute } from "@tanstack/react-router";

import { WorkspacesPage } from "../features/workspaces/workspaces-page";
export const Route = createFileRoute("/_authenticated/workspaces")({ component: WorkspacesPage });
